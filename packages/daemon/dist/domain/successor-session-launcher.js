import { ulid } from "ulid";
import { seatEnvLaunchVars } from "./seat-env.js";
import { SEAT_PROJECT_DIR_ENV } from "./claude-core-plugin-env.js";
import { isAttentionRequiredReadinessCode } from "./runtime-adapter.js";
import { isShellForeground } from "./shell-classifier.js";
import { resolveReadinessTimeoutMs } from "./readiness-timeout.js";
import { SettingsStore } from "./user-settings/settings-store.js";
import { terminatePaneInPlace } from "./pane-cutover.js";
export class SuccessorSessionLauncher {
    tmuxAdapter;
    discoveryRepo;
    sessionEnv;
    runtimeSessionEnv;
    newId;
    runtimeAdapters;
    readinessTimeoutMs;
    readinessSettings;
    sleep;
    tmuxOptionDefaults;
    exitPollMs;
    exitTimeoutMs;
    constructor(tmuxAdapter, discoveryRepo, opts = {}) {
        this.tmuxAdapter = tmuxAdapter;
        this.discoveryRepo = discoveryRepo;
        this.sessionEnv = opts.sessionEnv ?? {};
        this.runtimeSessionEnv = opts.runtimeSessionEnv ?? {};
        this.newId = opts.newId ?? ulid;
        this.runtimeAdapters = opts.runtimeAdapters ?? {};
        this.readinessTimeoutMs = opts.readinessTimeoutMs;
        this.readinessSettings = opts.readinessSettings ?? new SettingsStore();
        this.sleep = opts.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
        this.tmuxOptionDefaults = opts.tmuxOptionDefaults ?? null;
        this.exitPollMs = opts.exitPollMs ?? 100;
        this.exitTimeoutMs = opts.exitTimeoutMs ?? 3_000;
    }
    /**
     * Create the unmanaged successor tmux session, launch it into a LIVE agent,
     * and record it as an active discovery candidate. The candidate satisfies the
     * discovered->commit guards: active (upsert sets status='active'), distinct
     * name, matching runtime hint, unmanaged (no binding/session claims it),
     * tmux-present (just created). The returned resume token (if any) is the
     * launch-scraped token the composer persists at commit (B2 for fresh).
     */
    async createSuccessor(input) {
        // CUTOVER MODEL (plan 411c43de): a SEAT = one durable tmux session; the successor takes over the
        // retiree's EXACT pane via respawn-pane, so the canonical session name is PRESERVED (no -h shuffle)
        // and native scrollback survives — predecessor history stays above the successor boot (the money
        // proof). The retiree exits in place; its provider session file is the durable wake target, so the
        // new unwind invariant is that a failed successor NEVER destroys that recoverable state.
        const departingSession = input.departingSessionName;
        // OpenRig identity env mirrors NodeLauncher.launchNode's pattern so the successor self-identifies +
        // reports activity like a launched seat. OPENRIG_SESSION_NAME is the PRESERVED canonical name.
        const env = compactEnv({
            OPENRIG_NODE_ID: input.node.id,
            OPENRIG_SESSION_NAME: departingSession,
            OPENRIG_RUNTIME: input.node.runtime ?? undefined,
            ...this.sessionEnv,
            ...(input.node.runtime ? this.runtimeSessionEnv[input.node.runtime] : undefined),
            ...seatEnvLaunchVars(input.node.seatEnv ?? {}),
            ...(input.node.seatProjectDir ? { [SEAT_PROJECT_DIR_ENV]: input.node.seatProjectDir } : {}),
            OPENRIG_OCCUPANT_GENERATION: input.occupantGeneration ?? undefined,
        });
        const cwd = input.node.cwd ?? undefined;
        // 1. Resolve the DEPARTING session's active pane — the retiree's pane we take over. A probe throw or
        //    an empty result is a structured resolve_pane failure BEFORE any respawn, so the seat is wholly
        //    untouched (still the live retiree; nothing to recover).
        let pane;
        try {
            const panes = await this.tmuxAdapter.listPanes(departingSession);
            pane = panes.find((p) => p.active) ?? panes[0];
        }
        catch (err) {
            return {
                ok: false,
                code: "pane_probe_failed",
                step: "resolve_pane",
                replacementStarted: false,
                message: `Could not probe tmux panes for departing session "${departingSession}": ${err instanceof Error ? err.message : String(err)}`,
            };
        }
        if (!pane) {
            return {
                ok: false,
                code: "pane_unresolved",
                step: "resolve_pane",
                replacementStarted: false,
                message: `Could not resolve a tmux pane for departing session "${departingSession}".`,
            };
        }
        // 2. Terminate the retiree IN PLACE, then respawn the now-dead pane WITHOUT -k so native scrollback
        //    survives (respawn-pane -k CLEARS the pane history — verified on tmux 3.6a; that would defeat the
        //    money-proof). The swap: set remain-on-exit so the pane survives the exit → graceful SIGTERM
        //    ("exits in place"; also protects the provider session state the successor's resume depends on) →
        //    bounded-timeout SIGKILL fallback (pinned degraded path) → respawn-pane (no -k) on the dead pane.
        const terminated = await this.terminateRetiree(pane.id);
        if (!terminated.ok) {
            return { ok: false, code: "retiree_not_terminated", step: "create_successor", message: terminated.message, replacementStarted: false };
        }
        input.onReplacementStarted?.();
        // KI-14: the respawn command must be EXPLICIT. `respawn-pane` without a command re-runs the
        // pane's creation (or last-respawn) command — the default shell only for createSession panes.
        // Adopted/hand-recovered panes carry a full harness invocation there (`codex … resume
        // <old-token>`), which is exactly how the 2026-08-22 wave's "fresh" successors booted 14-day-old
        // contexts. An explicit shell also resets the pane's respawn default, self-healing the pane.
        const blankShell = (await this.tmuxAdapter.getDefaultShell()) ?? "/bin/sh";
        const respawned = await this.tmuxAdapter.respawnPane(pane.id, blankShell, { cwd, env });
        if (!respawned.ok) {
            return {
                ok: false,
                code: respawned.code ?? "respawn_failed",
                step: "create_successor",
                replacementStarted: true,
                message: `Could not respawn the successor into pane "${pane.id}" of "${departingSession}": ${respawned.message ?? "respawn-pane failed"}`,
            };
        }
        // KI-14: VERIFY the blank slate before any launch. The fresh contract is a verified blank shell
        // or a loud refusal — never a launch driven into a resumed harness that then gets committed as a
        // fresh successor. One bounded retry absorbs the shell's spawn latency. On failure the seat is
        // preserved (unwind invariant: never killSession) and no discovery candidate exists yet.
        const blank = await this.verifyPaneIsBlankShell(pane.id, blankShell);
        if (!blank.ok) {
            return {
                ok: false,
                code: "successor_pane_not_blank",
                step: "create_successor",
                replacementStarted: true,
                message: `Fresh successor pane "${pane.id}" of "${departingSession}" is running "${blank.observed ?? "unknown"}" instead of a blank shell — refusing to launch into a non-blank pane. The pane's start command likely bakes in a harness invocation; recreate the pane (or hand over with --source discovered:<id>) and retry.`,
            };
        }
        // Ghost-stage (e) re-key: the retiring occupant's seat-name-keyed stores are invalidated so the
        // successor never inherits a ghost. That call is made ATOMICALLY at SeatHandoverService.commit()
        // (inside the rebind tx, where the retiring + successor names are in scope), per the ghost-stage
        // contract — NOT here at the swap, so it commits together with the rebind. See occupant-invalidator.ts.
        // 3. Route the successor through REAL runtime startup (launchHarness send-keys + readiness) so it
        //    becomes a LIVE, READY agent in the reused pane BEFORE it can be committed. UNWIND INVARIANT:
        //    on ANY launch/readiness failure we do NOT killSession the preserved seat — that would destroy
        //    the retiree's recoverable state. We return the structured failure and leave the re-wakeable
        //    shell in the pane; commit never runs, so the binding is not repointed.
        const started = await this.startAgent(input.node, departingSession, pane.id, cwd, input.forkSource, input.occupantGeneration);
        if (!started.ok) {
            return { ok: false, code: started.code, step: "start_agent", message: started.message, replacementStarted: true };
        }
        const discovered = this.discoveryRepo.upsertDiscoveredSession({
            tmuxSession: departingSession,
            tmuxPane: pane.id,
            // The hint equals the node's own runtime, so the commit-path runtime check always matches; null
            // runtime records as "unknown" (which the check skips).
            runtimeHint: (input.node.runtime ?? "unknown"),
            confidence: "high",
            cwd: input.node.cwd ?? undefined,
        });
        return {
            ok: true,
            discoveredId: discovered.id,
            tmuxSession: departingSession,
            tmuxPane: pane.id,
            resumeToken: started.resumeToken,
            resumeType: started.resumeType,
            appliedLaunch: started.appliedLaunch,
            ...(respawned.warnings ? { warnings: respawned.warnings } : {}),
        };
    }
    /**
     * B1 — launch the successor into a live, ready agent via the runtime adapter's
     * `launchHarness` + readiness probe (the same primitives StartupOrchestrator
     * drives), capturing the launch resume token. No session/binding is
     * registered — the successor stays unmanaged until commit. The token is NEVER
     * logged or placed in a returned message.
     */
    async startAgent(node, tmuxSession, tmuxPane, cwd, forkSource, launchGeneration) {
        const adapter = node.runtime ? this.runtimeAdapters[node.runtime] : undefined;
        if (!adapter) {
            return {
                ok: false,
                code: "successor_runtime_unsupported",
                message: `No runtime adapter for "${node.runtime ?? "unknown"}"; a live successor cannot be launched for this seat.`,
            };
        }
        // Transient binding for the adapter launch/readiness probe — the successor
        // is unmanaged, so there is no persisted binding row (id/updatedAt are inert
        // for the adapter; it reads tmuxSession/tmuxPane/cwd/model). 0.5.2-07 (model
        // fidelity): the SPEC-pinned model IS carried now — a successor is a continuity
        // edge of the same seat, so its launch must read the seat's spec, else the
        // running topology silently drifts from the founder-designed one at every
        // handover. (config profile is still a tracked follow-on.)
        const binding = {
            id: "",
            nodeId: node.id,
            attachmentType: "tmux",
            tmuxSession,
            tmuxWindow: null,
            tmuxPane,
            cmuxWorkspace: null,
            cmuxSurface: null,
            updatedAt: "",
            cwd: cwd ?? "",
            launchGeneration: launchGeneration ?? undefined,
            nonInterruptive: node.nonInterruptive,
            kernelAuthority: node.kernelAuthority,
            teamPermissionDefault: node.teamPermissionDefault,
            // Seam B: continuity — the successor launches at the departing seat's posture.
            ...(node.launchPosture ? { launchPosture: node.launchPosture } : {}),
            ...(node.permissionMode ? { permissionMode: node.permissionMode } : {}),
            // 0.5.2-07: the successor reads the seat's SPEC-pinned model (adapter emits -m/--model).
            model: node.model ?? undefined,
            // #75: the successor reads the seat's resolved effort (saved choice, else authored).
            effort: node.effort ?? undefined,
            // 0.5.2-07 A4-profile: the successor reads the seat's SPEC-pinned codex config profile (adapter emits -p).
            codexConfigProfile: node.codexConfigProfile ?? undefined,
        };
        let launch;
        try {
            launch = await adapter.launchHarness(binding, { name: tmuxSession, ...(forkSource ? { forkSource } : {}) });
        }
        catch (err) {
            return { ok: false, code: "successor_launch_failed", message: `Successor harness launch threw: ${err instanceof Error ? err.message : String(err)}` };
        }
        if (!launch.ok) {
            return { ok: false, code: "successor_launch_failed", message: `Successor harness launch failed: ${launch.error}` };
        }
        // Capture the launch-scraped resume token (never logged). Persisted by the
        // composer at commit with provenance "scrape" (B2, launched modes).
        let resumeToken;
        let resumeType;
        const trimmed = launch.resumeToken?.trim();
        if (trimmed) {
            resumeToken = trimmed;
            resumeType = launch.resumeType;
        }
        // OPR.0.4.3.04 rev2 code-review fix — checkReady/waitForReady can THROW after
        // createSession already succeeded (adapter/socket/permission errors rethrow).
        // A thrown exception must NOT reject createSuccessor before its kill/unwind
        // runs (that would LEAK the unmanaged successor + surface an unstructured 500).
        // Catch it here and return a STRUCTURED ok:false so the caller kills the
        // just-created session (killBestEffort) and fails loudly at step=start_agent —
        // exactly like a returned readiness failure.
        let readiness;
        try {
            readiness = await this.waitForReady(adapter, binding);
        }
        catch (err) {
            return {
                ok: false,
                code: "successor_readiness_failed",
                message: `Successor readiness probe threw: ${err instanceof Error ? err.message : String(err)}`,
            };
        }
        if (!readiness.ready) {
            return {
                ok: false,
                code: isAttentionRequiredReadinessCode(readiness.code) ? "successor_attention_required" : "successor_not_ready",
                message: `Successor did not become a ready agent: ${readiness.reason ?? "readiness timeout"}`,
            };
        }
        return { ok: true, resumeToken, resumeType, appliedLaunch: launch.appliedLaunch };
    }
    /**
     * Wait for harness readiness with exponential backoff (1s→2s→…→16s cap,
     * configured timeout (30s by default) — mirrors StartupOrchestrator.waitForReady.
     */
    async waitForReady(adapter, binding) {
        const timeoutMs = resolveReadinessTimeoutMs(this.readinessTimeoutMs, this.readinessSettings);
        const startTime = Date.now();
        let delay = 1000;
        const maxDelay = 16_000;
        while (true) {
            const result = await adapter.checkReady(binding);
            if (result.ready)
                return result;
            if (isAttentionRequiredReadinessCode(result.code))
                return result;
            const remaining = timeoutMs - (Date.now() - startTime);
            if (remaining <= 0) {
                return { ready: false, reason: `readiness timeout after ${timeoutMs / 1000}s: ${result.reason ?? "harness did not become interactive"}` };
            }
            await this.sleep(Math.min(delay, remaining));
            delay = Math.min(delay * 2, maxDelay);
        }
    }
    /**
     * Cutover: terminate the retiree occupant in its pane so the successor can respawn into it while
     * preserving scrollback (the shared in-place cutover, pane-cutover.ts). Returns which path terminated
     * the retiree, or a failure if it never became dead (then commit never runs).
     * (Graceful signal = SIGTERM as the desk-provisional default under build-ahead; dev-planner ratifies
     * the exact graceful mechanism — SIGTERM vs a runtime-specific quit — at their resume.)
     */
    async terminateRetiree(paneId) {
        return terminatePaneInPlace(this.tmuxAdapter, paneId, { pollMs: this.exitPollMs, timeoutMs: this.exitTimeoutMs, sleep: this.sleep });
    }
    /** KI-14: is the respawned pane's foreground a bare shell? A non-shell here means the pane booted
     *  a baked-in command (the resumed-old-context defect) or the respawn was ignored. Classification
     *  is the shared shell-classifier PLUS the basename of the shell this launcher itself selected
     *  (r2-B1: a configured tcsh/csh — or any configured default shell — is a valid blank; a
     *  hard-coded set here false-refused AFTER the destructive cutover). One bounded retry absorbs
     *  shell spawn latency; a null probe counts as unverified (refuse, never assume). */
    async verifyPaneIsBlankShell(paneId, expectedShell) {
        let observed = await this.tmuxAdapter.getPaneCommand(paneId);
        if (observed && isShellForeground(observed, expectedShell))
            return { ok: true };
        await this.sleep(this.exitPollMs);
        observed = await this.tmuxAdapter.getPaneCommand(paneId);
        if (observed && isShellForeground(observed, expectedShell))
            return { ok: true };
        return { ok: false, observed };
    }
    /**
     * Composer unwind for a successor that launched but failed downstream (context delivery or continuity
     * verify). CUTOVER INVARIANT: the successor occupies the retiree's PRESERVED pane, so cleanup NEVER
     * kills the session — that would destroy the seat's recoverable state. It only marks the discovery
     * candidate vanished; the re-wakeable shell stays in the pane and the seat is recoverable from its
     * provider session file. (`tmuxSession` is retained for signature stability + call-site logging.)
     */
    async cleanup(_tmuxSession, discoveredId) {
        if (discoveredId)
            this.discoveryRepo.markVanished([discoveredId]);
    }
}
function compactEnv(input) {
    const result = {};
    for (const [key, value] of Object.entries(input)) {
        if (typeof value === "string" && value.length > 0)
            result[key] = value;
    }
    return result;
}
//# sourceMappingURL=successor-session-launcher.js.map