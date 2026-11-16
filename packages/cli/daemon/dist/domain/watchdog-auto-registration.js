import { parseSessionName, validateSessionName } from "./session-name.js";
const POLICY = "idle-gate-qitem";
const REGISTRAR = "daemon@kernel";
const TERMINAL_SESSION_STATUSES = new Set(["superseded", "detached", "exited"]);
export class WatchdogAutoRegistrationError extends Error {
    code;
    details;
    constructor(code, message, details) {
        super(`${code}: ${message}`);
        this.code = code;
        this.details = details;
        this.name = "WatchdogAutoRegistrationError";
    }
}
export function formatWatchdogRegistrationError(error) {
    const message = error instanceof Error ? error.message : String(error);
    const details = typeof error === "object" && error !== null && "details" in error
        ? error.details
        : undefined;
    return details === undefined ? message : `${message}; details=${JSON.stringify(details)}`;
}
/**
 * W2c's one structural seam: every canonical seat mint ensures its role-bound
 * idle-gate job, while startup only audits existing live-like seats. Core seat
 * creation remains fail-isolated from this additive supervision layer.
 */
export class WatchdogAutoRegistration {
    deps;
    warn;
    constructor(deps) {
        this.deps = deps;
        this.warn = deps.warn ?? ((message) => console.warn(message));
    }
    /** Named exclusions: flat legacy and noncanonical/external seats cannot own qitems. */
    isEligibleSessionName(sessionName) {
        return validateSessionName(sessionName) && parseSessionName(sessionName).kind === "canonical";
    }
    /**
     * A discovered handover may legitimately claim a noncanonical tmux name.
     * It is not eligible for a new role job, but the retired canonical target
     * must stop being deliverable. Terminal history lets a later canonical
     * occupant create a fresh active job; an operator-stopped row stays stopped.
     */
    reconcileHandover(nodeId, sessionName) {
        const row = this.deps.db.prepare(`SELECT n.id AS node_id, n.rig_id AS rig_id, r.name AS rig_name
         FROM nodes n LEFT JOIN rigs r ON r.id = n.rig_id
        WHERE n.id = ?`).get(nodeId);
        if (!row || row.rig_name === null) {
            throw new WatchdogAutoRegistrationError("target_mismatch", `watchdog handover topology missing for node_id="${nodeId}" session="${sessionName}"`, { nodeId, sessionName, actualRig: row?.rig_name ?? null });
        }
        const job = this.deps.jobsRepo.findAutoRegistration(POLICY, sessionName, null, this.canonicalAliases(nodeId, row.rig_name, sessionName));
        if (!job || job.state === "stopped")
            return job;
        this.deps.jobsRepo.markTerminal(job.jobId, "handover_noncanonical_successor");
        return this.deps.jobsRepo.getByIdOrThrow(job.jobId);
    }
    /**
     * B6 founder ruling — auto-registration is NOT default-on. A NEW job is created only when the
     * fleet opted in (`auto_register: "all"`) or this seat is named in `opt_in_sessions`. A seat that
     * ALREADY HAS a job keeps being maintained regardless: existing registered jobs survive the
     * default flip, and their alias refresh must not silently stop.
     */
    autoRegisterAllowed(sessionName) {
        // Trimmed at the enforcement seam: the validator accepts whitespace-padded enum values
        // (it validates the trimmed raw), so the gate must compare the same normalization — an
        // accepted " all " silently behaving as "off" is a config that lies.
        const mode = String(this.deps.settingsStore.resolveOne("policies.idle_gate_qitem.auto_register").value ?? "off").trim();
        if (mode === "all")
            return true;
        const optIn = String(this.deps.settingsStore.resolveOne("policies.idle_gate_qitem.opt_in_sessions").value ?? "");
        return optIn.split(",").map((s) => s.trim()).filter(Boolean).includes(sessionName);
    }
    ensure(nodeId, sessionName) {
        const topology = this.resolveTopology(nodeId, sessionName);
        if (!topology)
            return null;
        if (!this.autoRegisterAllowed(sessionName)) {
            const existing = this.deps.jobsRepo.findAutoRegistration(POLICY, sessionName, null, this.canonicalAliases(nodeId, topology.rig_name, sessionName));
            if (!existing)
                return null; // fresh seat, not opted in — no job, by ruling
        }
        const cadence = this.resolveCadence();
        return this.deps.jobsRepo.ensureAutoRegistration({
            policy: POLICY,
            specYaml: this.generatedSpec(sessionName, cadence.scan, cadence.activeWake),
            targetSession: sessionName,
            intervalSeconds: cadence.scan,
            scanIntervalSeconds: cadence.scan,
            activeWakeIntervalSeconds: cadence.activeWake,
            registeredBySession: REGISTRAR,
            targetGenerationUuid: null,
        }, this.canonicalAliases(nodeId, topology.rig_name, sessionName));
    }
    assertCoverage(nodeId, sessionName) {
        const topology = this.resolveTopology(nodeId, sessionName);
        if (!topology)
            return null;
        const job = this.deps.jobsRepo.findAutoRegistration(POLICY, sessionName, null, this.canonicalAliases(nodeId, topology.rig_name, sessionName));
        if (!job || job.targetSession !== sessionName) {
            // B6 — no job on a seat that is not opted in is the RULED default, not a
            // coverage failure; only an opted-in seat (or a stale-targeted job) pages.
            if (!job && !this.autoRegisterAllowed(sessionName))
                return null;
            throw new WatchdogAutoRegistrationError("missing", `watchdog auto-registration missing for node_id="${nodeId}" session="${sessionName}"`, {
                nodeId,
                sessionName,
                policy: POLICY,
                staleTargetSession: job?.targetSession ?? null,
                staleJobId: job?.jobId ?? null,
                staleState: job?.state ?? null,
            });
        }
        return job;
    }
    /** Audit every latest live-like seat at startup; never create or delete rows. */
    assertLiveSeatCoverage() {
        const rows = this.deps.db.prepare(`SELECT node_id, session_name, status
         FROM sessions
        ORDER BY created_at DESC, id DESC`).all();
        const seen = new Set();
        for (const row of rows) {
            if (seen.has(row.node_id))
                continue;
            seen.add(row.node_id);
            if (TERMINAL_SESSION_STATUSES.has(row.status))
                continue;
            if (!this.isEligibleSessionName(row.session_name))
                continue;
            try {
                // B6 — assertCoverage is gate-aware: a non-opted seat with no job returns
                // null (the ruled default) instead of warning at every startup audit.
                this.assertCoverage(row.node_id, row.session_name);
            }
            catch (error) {
                this.warn(`[watchdog-auto-registration] startup coverage FAILED for node_id="${row.node_id}" ` +
                    `session="${row.session_name}": ${formatWatchdogRegistrationError(error)}`);
            }
        }
    }
    resolveTopology(nodeId, sessionName) {
        if (!validateSessionName(sessionName))
            return null;
        const parsed = parseSessionName(sessionName);
        if (parsed.kind !== "canonical")
            return null;
        const row = this.deps.db.prepare(`SELECT n.id AS node_id, n.rig_id AS rig_id, r.name AS rig_name
         FROM nodes n LEFT JOIN rigs r ON r.id = n.rig_id
        WHERE n.id = ?`).get(nodeId);
        if (!row || row.rig_name === null || row.rig_name !== parsed.rig) {
            throw new WatchdogAutoRegistrationError("target_mismatch", `canonical seat topology mismatch for node_id="${nodeId}" session="${sessionName}"`, { nodeId, sessionName, parsedRig: parsed.rig, actualRig: row?.rig_name ?? null });
        }
        return row;
    }
    canonicalAliases(nodeId, rigName, currentSession) {
        const rows = this.deps.db.prepare(`SELECT session_name FROM sessions WHERE node_id = ? ORDER BY created_at ASC, id ASC`).all(nodeId);
        return [...new Set([...rows.map((row) => row.session_name), currentSession])].filter((candidate) => {
            if (!validateSessionName(candidate))
                return false;
            const parsed = parseSessionName(candidate);
            return parsed.kind === "canonical" && parsed.rig === rigName;
        });
    }
    resolveCadence() {
        return {
            scan: this.deps.settingsStore.resolveOne("policies.idle_gate_qitem.scan_interval_seconds").value,
            activeWake: this.deps.settingsStore.resolveOne("policies.idle_gate_qitem.active_wake_interval_seconds").value,
        };
    }
    generatedSpec(sessionName, scan, activeWake) {
        return `policy: ${POLICY}\n` +
            `generated_by: openrig-daemon\n` +
            `target:\n  session: ${sessionName}\n` +
            `interval_seconds: ${scan}\n` +
            `scan_interval_seconds: ${scan}\n` +
            `active_wake_interval_seconds: ${activeWake}\n`;
    }
}
//# sourceMappingURL=watchdog-auto-registration.js.map