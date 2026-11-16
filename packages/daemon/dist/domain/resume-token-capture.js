// OPR.0.4.3.04 B2 — the PURE, reusable resume-token DERIVE helper.
//
// This is the shared derivation core behind FR-3's adoption-boundary capture
// (ClaimService.captureResumeTokenOnAdoption) AND the seat-handover discovered-
// mode capture. It performs REUSE-ONLY, PURE READ derivation — no pane writes,
// no launch, no persistence, no event emission. The CALLER owns persistence
// (updateResumeToken) and event emission (captured / preserved / skipped), so
// each caller keeps its own provenance + audit semantics.
//
// The derived token is credential-class: it is NEVER logged, echoed, or placed
// in any returned message/error. Only the caller's redacted persistence path
// ever touches it. Honest failure = a structured skip reason (no token), never
// a fabricated value.
//
// FR-3's scope is UNCHANGED: this helper is derive-only and does not alter
// which lifecycle ops adopt. It only removes the duplication between the two
// derive sites the ruling asked us to share.
import { resumeTypeForRuntime, validateResumeToken } from "./resume-token-validation.js";
/**
 * A Claude sidecar outlives the process that wrote it (#421: a seat that keeps a user's own status
 * line never refreshes it). A sample taken before the pane's current Claude process started can
 * only come from an earlier process, so its session id is not this process's. True only when both
 * times are known; unknown never reads as stale.
 */
export async function isClaudeSidecarFromEarlierProcess(sampledAt, sessionName, claudeProcessStartedAt) {
    if (typeof sampledAt !== "string" || !claudeProcessStartedAt)
        return false;
    const sampled = Date.parse(sampledAt);
    if (Number.isNaN(sampled))
        return false;
    let startedAt;
    try {
        startedAt = await claudeProcessStartedAt(sessionName);
    }
    catch {
        return false;
    }
    // `ps` lstart is local time to the second, so a sample from the current process is never earlier.
    const started = startedAt ? Date.parse(startedAt) : Number.NaN;
    return !Number.isNaN(started) && sampled < started;
}
/**
 * Derive a runtime's resume token from live, read-only sources:
 *   claude-code → the status-line sidecar's session_id (a file read)
 *   codex       → the thread id derived from live pid-keyed logs
 *   pi          → the pi-runner state sidecar's sessionFile (a file read)
 *   omp         → the OMP runner state sidecar's sessionFile (separate root)
 * Returns a structured outcome; never throws for a missing/invalid token
 * (those are honest skips). ANY unexpected throw from a dependency is the
 * caller's to swallow (capture must never fail or block its lifecycle op).
 */
export async function deriveResumeToken(input, deps) {
    const resumeType = resumeTypeForRuntime(input.runtime);
    if (!resumeType)
        return { outcome: "exempt" }; // terminal / unknown — exempt, not a failure
    const runtime = input.runtime; // non-null: resumeType resolves only for supported runtimes
    let token;
    if (runtime === "claude-code") {
        if (!deps.contextUsageStore)
            return { outcome: "noop" }; // dep absent — silent no-op
        const sidecar = deps.contextUsageStore.readSidecar(input.sessionName);
        if (!sidecar.ok) {
            return { outcome: "skipped", reason: sidecar.reason === "parse_error" ? "parse_error" : "missing_sidecar" };
        }
        const sid = sidecar.data.session_id;
        if (typeof sid === "string" && sid.trim().length > 0)
            token = sid.trim();
        else
            return { outcome: "skipped", reason: "missing_sidecar" };
        if (await isClaudeSidecarFromEarlierProcess(sidecar.data.sampled_at, input.sessionName, deps.claudeProcessStartedAt)) {
            return { outcome: "skipped", reason: "stale_sidecar" };
        }
    }
    else if (runtime === "codex") {
        if (!deps.resumeTokenCapturer)
            return { outcome: "noop" }; // dep absent — silent no-op
        try {
            token = await deps.resumeTokenCapturer.captureCodexThreadId(input.sessionName);
        }
        catch {
            // Same reason the capture log gives; the exception text stays out of the event.
            return { outcome: "skipped", reason: "process_unreadable" };
        }
        if (!token)
            return { outcome: "skipped", reason: "probe_timeout" };
    }
    else if (runtime === "pi" || runtime === "omp" || runtime === "opencode" || runtime === "dsh") {
        const stateStore = runtime === "pi" ? deps.piRunnerStateStore
            : runtime === "omp" ? deps.ompRunnerStateStore
                : runtime === "opencode" ? deps.opencodeRunnerStateStore
                    : deps.dshRunnerStateStore;
        if (!stateStore)
            return { outcome: "noop" }; // dep absent — silent no-op
        const state = stateStore.readSessionFile(input.sessionName);
        if (!state.ok) {
            return { outcome: "skipped", reason: state.reason === "parse_error" ? "parse_error" : "missing_sidecar" };
        }
        if (state.sessionFile.trim().length > 0)
            token = state.sessionFile.trim();
        else
            return { outcome: "skipped", reason: "missing_sidecar" };
    }
    else {
        return { outcome: "noop" }; // resumeType set but runtime is not one we derive — defensive
    }
    // Defensive format validation before the caller persists — a malformed token
    // is an honest skip, never a bad write (validity-before-rank).
    const validation = validateResumeToken(runtime, token);
    if (!validation.ok)
        return { outcome: "skipped", reason: "invalid_token" };
    return { outcome: "captured", resumeType: validation.resumeType, token: validation.token };
}
//# sourceMappingURL=resume-token-capture.js.map