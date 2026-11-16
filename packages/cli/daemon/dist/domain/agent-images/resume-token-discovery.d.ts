import type Database from "better-sqlite3";
export type DiscoveryRuntime = "claude-code" | "codex";
export interface DiscoveryResult {
    runtime: DiscoveryRuntime;
    /** Native conversation id (Claude resume_token / Codex thread_id /
     *  external_session_name for external-CLI Codex seats). null when
     *  the daemon can't surface one yet. */
    nativeId: string | null;
    /** PL-016 source-cwd behavior: source
     *  seat's resolved cwd from the nodes table. Captured here so
     *  SnapshotCapturer (and any future fork route) can persist it on
     *  the manifest without an additional query. null when the source
     *  node has no recorded cwd. */
    nodeCwd: string | null;
}
export interface DiscoveryFailure {
    code: "session_not_found" | "runtime_unsupported";
    message: string;
}
export type DiscoveryOutcome = {
    ok: true;
    result: DiscoveryResult;
} | {
    ok: false;
    failure: DiscoveryFailure;
};
export declare function discoverResumeToken(db: Database.Database, sourceSession: string): DiscoveryOutcome;
//# sourceMappingURL=resume-token-discovery.d.ts.map