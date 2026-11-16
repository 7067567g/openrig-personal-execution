export interface ProcessRow {
    pid: number;
    ppid: number;
    command: string;
    /** OPR.0.5.3.10 — the process start time (`ps lstart`), the identity half
     *  of pid+start-time: pid reuse changes it, so consumers can invalidate
     *  cached per-pid answers without another spawn. Optional: injected legacy
     *  rows without it fall back to the resolver's TTL bound. */
    startedAt?: string;
}
export interface CurrentGenerationDeps {
    getPanePid: (sessionTarget: string) => Promise<number | null>;
    listProcesses: () => Promise<ProcessRow[]>;
    /** Codex: thread id for a live codex pid (the logs join; async post-F1).
     *  `identity` = the census row's startedAt (pid+start-time reuse guard). */
    readThreadIdByPid: (pid: number, identity?: string) => Promise<string | undefined> | string | undefined;
}
export type CurrentRecordResolution = {
    ok: true;
    id: string;
} | {
    ok: false;
    reason: string;
};
export interface ClaudeOccupantRecordInput {
    sessionName: string;
    generation: string | null;
    occupantBootAt: string | null;
    binding: {
        tmuxSession: string | null;
        tmuxPane: string | null;
    } | null;
    identity: {
        verdict: string;
        sessionName: string | null;
        observedAt: string;
        evidence: {
            registeredPane: string | null;
            observedPid: number | null;
        };
    } | null;
    sidecar: {
        session_id?: string;
        session_name?: string;
        transcript_path?: string;
        sampled_at?: string;
        occupant_generation?: string;
    } | null;
}
export type ClaudeRecordSelection = {
    ok: true;
    id: string;
    path: string;
    source: "generation-sidecar" | "verified-pane-argument";
} | {
    ok: false;
    reason: string;
};
/** The pane process's Claude session-id LAUNCH ARGUMENT. It is authoritative only after the caller
 *  verifies the canonical binding and current pane identity. A current-generation sidecar may
 *  supersede it after a provider-internal session rollover. */
export declare function paneClaudeSessionIdArgument(sessionTarget: string, deps: Pick<CurrentGenerationDeps, "getPanePid" | "listProcesses">): Promise<CurrentRecordResolution>;
/**
 * Resolve a Claude record only after the canonical seat's current occupant is joined to its
 * registered pane and the pane's PID still matches the durable identity verdict. The pane's launch
 * argument is the legacy identity anchor. A generation-stamped sidecar may supersede it after a
 * provider-internal session rollover; an unstamped sidecar may locate files but cannot override it.
 */
export declare function resolveIdentityVerifiedClaudeRecord(input: ClaudeOccupantRecordInput, deps: Pick<CurrentGenerationDeps, "getPanePid" | "listProcesses">, isReadableRecord: (path: string) => boolean): Promise<ClaudeRecordSelection>;
/** The live codex occupant's thread id, via its own pid's log join — bypasses the stored resume
 *  token entirely (the stored token is exactly what went stale on the specimen class). */
export declare function resolveLiveCodexThreadId(sessionTarget: string, deps: CurrentGenerationDeps): Promise<CurrentRecordResolution>;
//# sourceMappingURL=current-generation-record.d.ts.map