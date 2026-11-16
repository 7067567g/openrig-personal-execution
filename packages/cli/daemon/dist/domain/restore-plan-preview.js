import { restoreRuntimeCompatibilityError } from "./restore-runtime-compatibility.js";
import { resolveActiveOccupantRow, resolveActiveSnapshotSession, deriveRehydrateSessionIdByNode, activeOccupantAmbiguityError, absentSeatResumeHistory, absentSeatResumeHistoryError } from "./active-occupant.js";
import { parseSqliteUtcMs } from "./sqlite-time.js";
import { effectiveRestorePolicy, isOrdinaryTerminalSeat } from "./restore-policy.js";
/** OPR.0.4.3.20 FR-6 — a present token whose last verification is older than this
 *  is surfaced as `stale` (age-based staleness — the "stale while running" signal
 *  that needs no probe). DELIVERY DEFAULT; pm confirms the exact value. */
export const RESUME_FRESHNESS_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour
/** OPR.0.4.3.20 FR-6 — compute a seat's token state (read-only). A present token
 *  whose probe failed (`not_resumable`/`inconclusive`) OR whose last-verified age
 *  is past the freshness threshold is `stale` — surfaced, never silently nulled. */
function tokenStateFor(latest, nowMs) {
    if (!latest || !latest.resumeToken) {
        return { tokenState: "missing", provenance: null, lastVerified: null };
    }
    const provenance = latest.resumeProvenance ?? null;
    const lastVerified = latest.resumeLastVerified ?? null;
    const probe = latest.resumeLastProbeStatus ?? null;
    if (probe === "not_resumable" || probe === "inconclusive") {
        return { tokenState: "stale", provenance, lastVerified };
    }
    if (!probe && !lastVerified) {
        return { tokenState: "unverified", provenance, lastVerified };
    }
    if (lastVerified) {
        // NaN (unparseable) skips the age check: an unreadable stamp is never stale-by-age.
        const verifiedMs = parseSqliteUtcMs(lastVerified);
        if (!Number.isNaN(verifiedMs) && nowMs - verifiedMs > RESUME_FRESHNESS_THRESHOLD_MS) {
            return { tokenState: "stale", provenance, lastVerified };
        }
    }
    return { tokenState: "present", provenance, lastVerified };
}
/** OPR.0.4.3.20 FR-6 — forecast the runtime prompt a resume WOULD hit, so it is
 *  an expected operator step, not a terminal surprise. Only meaningful when the
 *  seat would attempt a resume (has a token). */
function runtimePromptFor(runtime, tokenState) {
    if (tokenState === "missing")
        return undefined;
    if (runtime === "claude-code")
        return "expect the Claude session picker (full-session resume)";
    if (runtime === "codex")
        return "expect a Codex auth/update check before resume";
    return undefined;
}
/** Forecast one seat's restore action — mirrors the orchestrator's pre-launch
 *  classification (OPR.0.3.4.2) without touching anything. A fresh-listed
 *  seat (operation B, `--fresh <seat>`) forecasts `fresh-primed` BEFORE any
 *  resume-token logic, exactly as apply mode deliberately skips the resume. */
function intendedActionFor(resolution, freshRequested, seat, absentHistory) {
    // OPR.0.5.7.1 — a broken authoritative relation beats --fresh, exactly as
    // execution fails loudly before its fresh check: --fresh cannot override
    // A1 ambiguity.
    if (resolution.kind === "ambiguous") {
        return {
            intendedAction: "awaiting-decision",
            reason: activeOccupantAmbiguityError(resolution.candidateIds, resolution.detail),
        };
    }
    if (freshRequested) {
        return {
            intendedAction: "fresh-primed",
            reason: "listed in --fresh — apply would deliberately skip the resume (operation B)",
        };
    }
    // No occupant, but an earlier one left a resume token: apply stops for the same decision.
    if (resolution.kind === "none" && absentHistory.row) {
        return {
            intendedAction: "awaiting-decision",
            reason: absentSeatResumeHistoryError(absentHistory.logicalId, absentHistory.row.resumeType, absentHistory.rigName),
        };
    }
    const occupant = resolution.kind === "resolved" ? resolution.session : null;
    const policy = effectiveRestorePolicy(seat, occupant?.restorePolicy);
    const sourceRecorded = !!occupant?.resumeType && occupant.resumeType !== "none";
    if (policy === "resume_if_possible" && sourceRecorded && occupant?.resumeToken) {
        return { intendedAction: "resume-original" };
    }
    if (policy === "resume_if_possible" && occupant && (!sourceRecorded || !occupant.resumeToken)) {
        return {
            intendedAction: "awaiting-decision",
            reason: "Prior occupant has no usable native resume identity. No session will be started without a fresh-start decision.",
        };
    }
    return { intendedAction: "fresh-primed" };
}
/** Gather the session rows the preview forecasts from — the snapshot's
 *  captured sessions when one exists, otherwise the live rows an
 *  auto-rehydrate capture WOULD snapshot (read-only SELECT; the capture
 *  itself is a mutation and is never performed here). */
export function collectPreviewSessionRows(db, rig, snapshot) {
    if (snapshot) {
        return (snapshot.data.sessions ?? []).map((s) => ({
            nodeId: s.nodeId,
            restorePolicy: s.restorePolicy ?? null,
            resumeType: s.resumeType ?? null,
            resumeToken: s.resumeToken ?? null,
            // OPR.0.4.3.20 FR-6 — degrade to null for snapshots serialized pre-45.
            resumeProvenance: s.resumeProvenance ?? null,
            resumeLastVerified: s.resumeLastVerified ?? null,
            resumeLastProbeStatus: s.resumeLastProbeStatus ?? null,
            id: s.id,
            status: s.status ?? null,
        }));
    }
    const nodeIds = rig.nodes.map((n) => n.id);
    if (nodeIds.length === 0)
        return [];
    const placeholders = nodeIds.map(() => "?").join(",");
    const rows = db.prepare(`SELECT id, node_id, restore_policy, resume_type, resume_token, resume_provenance, resume_last_verified, resume_last_probe_status, status FROM sessions WHERE node_id IN (${placeholders})`).all(...nodeIds);
    return rows.map((r) => ({
        nodeId: r.node_id,
        restorePolicy: r.restore_policy,
        resumeType: r.resume_type,
        resumeToken: r.resume_token,
        resumeProvenance: r.resume_provenance,
        resumeLastVerified: r.resume_last_verified,
        resumeLastProbeStatus: r.resume_last_probe_status,
        id: r.id,
        status: r.status,
    }));
}
/**
 * Forecast per-seat restore actions from current inventory and saved occupancy.
 * Report token state and guidance without launching or changing any sessions.
 */
export function buildRestorePlanPreview(rig, snapshot, sessionRows, freshLogicalIds, nowMs = Date.now(), recorded = {}) {
    // OPR.0.5.7.1 — the relation the resolution consumes: the snapshot's own
    // when previewing a snapshot; for the live no-snapshot case, the SAME
    // would-capture derivation SnapshotCapture uses (shared helper — the
    // sibling paths cannot drift).
    const relationMap = snapshot
        ? snapshot.data.activeSessionIdByNode
        : deriveRehydrateSessionIdByNode(sessionRows, rig.nodes.map((n) => n.id), recorded);
    const nodes = rig.nodes.map((node) => {
        const freshRequested = freshLogicalIds?.includes(node.logicalId) ?? false;
        const savedNodeId = snapshot?.data.nodes?.find(saved => saved.logicalId === node.logicalId)?.id ?? node.id;
        const resolution = snapshot
            ? resolveActiveSnapshotSession(snapshot.data, savedNodeId)
            : sessionRows.some((row) => row.nodeId === node.id)
                ? resolveActiveOccupantRow(sessionRows, relationMap, node.id)
                : { kind: "none" };
        const runtimeError = resolution.kind !== "ambiguous"
            ? restoreRuntimeCompatibilityError(node.runtime, snapshot?.data.nodeStartupContext?.[savedNodeId]?.runtime)
            : null;
        // The runtimes and recorded sessions restore reads the seat's policy through: the snapshot's own node, else the live one.
        const seat = {
            savedRuntime: snapshot?.data.nodes?.find(saved => saved.logicalId === node.logicalId)?.runtime ?? node.runtime,
            currentRuntime: node.runtime,
            recordedSessions: sessionRows.filter((row) => row.nodeId === savedNodeId),
        };
        const { intendedAction, reason } = runtimeError
            ? { intendedAction: "awaiting-decision", reason: runtimeError }
            : intendedActionFor(resolution, freshRequested, seat, { logicalId: node.logicalId, rigName: rig.rig.name, row: absentSeatResumeHistory(sessionRows, savedNodeId) });
        // OPR.0.4.3.20 FR-6 — per-seat token state (read-only), derived from the
        // RESOLVED occupant only — never from a historical row.
        const occupant = resolution.kind === "resolved" ? resolution.session : null;
        const { tokenState, provenance, lastVerified } = tokenStateFor(occupant, nowMs);
        const runtimePrompt = runtimePromptFor(node.runtime, tokenState);
        return {
            logicalId: node.logicalId,
            occupantSessionId: occupant?.id ?? null,
            hasHistory: sessionRows.some((row) => row.nodeId === savedNodeId),
            intendedAction,
            ...(reason ? { reason } : {}),
            tokenState,
            ...(provenance ? { provenance } : {}),
            ...(lastVerified ? { lastVerified } : {}),
            // no resumable token → restore needs an explicit --fresh (never
            // silent); runtime mismatches and broken relations cannot be resolved
            // by a fresh request, so --fresh must not be suggested as their remedy.
            // A terminal has no token to find and relaunches fresh on its own.
            freshRequired: runtimeError || resolution.kind === "ambiguous" ? false : tokenState === "missing" && !isOrdinaryTerminalSeat(seat),
            ...(runtimePrompt ? { runtimePrompt } : {}),
        };
    });
    return {
        status: "plan",
        mode: "restore",
        rigId: rig.rig.id,
        rigName: rig.rig.name,
        snapshot: snapshot ? { id: snapshot.id, kind: snapshot.kind, createdAt: snapshot.createdAt } : null,
        wouldCaptureCurrentState: snapshot === null,
        nodes,
        mutated: false,
    };
}
//# sourceMappingURL=restore-plan-preview.js.map