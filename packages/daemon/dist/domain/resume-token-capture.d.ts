import { type ResumeType } from "./resume-token-validation.js";
export interface ResumeTokenCaptureDeps {
    contextUsageStore?: {
        readSidecar(sessionName: string): {
            ok: true;
            data: {
                session_id?: string;
                sampled_at?: string;
            };
        } | {
            ok: false;
            reason: string;
        };
    } | null;
    /** Start time (`ps` lstart) of the Claude process now in the seat's pane, or null when unknown. */
    claudeProcessStartedAt?: ((sessionName: string) => Promise<string | null>) | null;
    resumeTokenCapturer?: {
        captureCodexThreadId(sessionName: string): Promise<string | undefined>;
    } | null;
    /** OPR.0.4.6.PI1 FR-6 — reads the pi-runner's session-state sidecar (the
     *  runner persists sessionFile/sessionId from RPC get_state; a file read,
     *  same posture as the claude-code status-line sidecar). */
    piRunnerStateStore?: {
        readSessionFile(sessionName: string): {
            ok: true;
            sessionFile: string;
        } | {
            ok: false;
            reason: string;
        };
    } | null;
    /** Reads the separately rooted OMP runner sidecar; never reads Pi seat state. */
    ompRunnerStateStore?: {
        readSessionFile(sessionName: string): {
            ok: true;
            sessionFile: string;
        } | {
            ok: false;
            reason: string;
        };
    } | null;
    /** OpenCode runner sidecar (sessionId from the JSON event stream). */
    opencodeRunnerStateStore?: {
        readSessionFile(sessionName: string): {
            ok: true;
            sessionFile: string;
        } | {
            ok: false;
            reason: string;
        };
    } | null;
    /** DSH headless runner sidecar (sessionId from the typed event stream). */
    dshRunnerStateStore?: {
        readSessionFile(sessionName: string): {
            ok: true;
            sessionFile: string;
        } | {
            ok: false;
            reason: string;
        };
    } | null;
}
export type ResumeTokenDeriveResult = 
/** Runtime has no resume token (terminal / unknown) — not a failure, no event. */
{
    outcome: "exempt";
}
/** A required derive dependency is absent (older wiring / test) — silent no-op. */
 | {
    outcome: "noop";
}
/** A live token was derived + format-validated. The caller persists it. */
 | {
    outcome: "captured";
    resumeType: ResumeType;
    token: string;
}
/** Derivation ran but produced no usable token — the caller emits a skip event. */
 | {
    outcome: "skipped";
    reason: "missing_sidecar" | "parse_error" | "probe_timeout" | "process_unreadable" | "invalid_token" | "stale_sidecar";
};
/**
 * A Claude sidecar outlives the process that wrote it (#421: a seat that keeps a user's own status
 * line never refreshes it). A sample taken before the pane's current Claude process started can
 * only come from an earlier process, so its session id is not this process's. True only when both
 * times are known; unknown never reads as stale.
 */
export declare function isClaudeSidecarFromEarlierProcess(sampledAt: unknown, sessionName: string, claudeProcessStartedAt: ResumeTokenCaptureDeps["claudeProcessStartedAt"]): Promise<boolean>;
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
export declare function deriveResumeToken(input: {
    runtime: string | null;
    sessionName: string;
}, deps: ResumeTokenCaptureDeps): Promise<ResumeTokenDeriveResult>;
//# sourceMappingURL=resume-token-capture.d.ts.map