export type ExecDep = (cmd: string, args: string[]) => Promise<{
    stdout: string;
    exitCode: number;
}>;
export interface SearchResult {
    backend: "rg" | "grep" | "none";
    excerpts: string[];
    insufficient: boolean;
    noTranscriptDir?: boolean;
    error?: string;
}
/** One keyword hit from a seat-scoped search, labeled with the generation
 *  (tenure) segment it fell in — the segments are delimited by the
 *  `--- SESSION BOUNDARY … ---` markers a seat's log accumulates across tenures. */
export interface SeatHit {
    generation: number;
    text: string;
}
export type SeatDegradeReason = "capture_missing" | "capture_empty" | "capture_unreadable" | "boundary_only";
export interface SeatSearchResult {
    backend: "read" | "none";
    seat: string;
    /** count of tenure segments = (boundary markers seen) + 1 */
    generations: number;
    hits: SeatHit[];
    insufficient: boolean;
    /** honest-degraded signal — never a silent zero-hits that implies the seat never spoke */
    degraded?: {
        reason: SeatDegradeReason;
        message: string;
    };
    /** large-file advisory (pin 5) — surfaced, never a silent slow read */
    advisory?: string;
}
export interface ChatSearchResult {
    sender: string;
    body: string;
    createdAt: string;
}
interface HistoryQueryOpts {
    transcriptsRoot: string;
    exec: ExecDep;
    chatSearchFn?: (rigId: string, pattern: string) => ChatSearchResult[];
    /** root of per-session provider JSONL (Claude): ~/.claude/projects. Injectable for tests. */
    claudeProjectsRoot?: string;
}
export interface SessionSearchResult {
    backend: "rg" | "grep" | "none";
    token: string;
    found: boolean;
    path?: string;
    sizeBytes?: number;
    excerpts: string[];
    insufficient: boolean;
    degraded?: {
        reason: "session_not_found" | "unreadable";
        message: string;
    };
    advisory?: string;
}
export declare function extractKeywords(question: string): string[];
export declare class HistoryQuery {
    private readonly transcriptsRoot;
    private readonly exec;
    private readonly chatSearchFn?;
    private readonly claudeProjectsRoot;
    constructor(opts: HistoryQueryOpts);
    /** Locate a session's JSONL by token: `<projectsRoot>/<any-encoded-cwd>/<token>.jsonl`.
     *  Token alone is enough (we scan the encoded-cwd dirs) — the founder's "I have
     *  the token, go find something". Returns null when nothing matches. */
    private locateSessionFile;
    /**
     * L2 — search ONE session's JSONL by its token (read-only). Locates the file
     * under ~/.claude/projects/<encoded-cwd>/<token>.jsonl and greps it (rg→grep
     * fallback; streaming, so a large 100s-of-MB session file is safe). Honest:
     * a token with no session file returns session_not_found teaching, never a
     * silent empty; a large file surfaces an advisory (pin 5).
     */
    searchSession(sessionToken: string, question: string): Promise<SessionSearchResult>;
    search(rigName: string, question: string): Promise<SearchResult>;
    /**
     * L1 — seat-scoped, cross-generation transcript search. Scopes to ONE seat's
     * `<rig>/<sessionName>.log` (never the whole rig dir) and labels every hit with
     * the generation (tenure) it fell in — the generations are the segments between
     * `--- SESSION BOUNDARY … ---` markers the seat's log accumulates as agents come
     * and go. Cross-generation is the point: a hit from before and after a boundary
     * proves the search spans tenures. Honest-degraded (never a silent zero-hits):
     * a missing / empty / boundary-only transcript says so.
     */
    searchSeat(rigName: string, seatSessionName: string, question: string): Promise<SeatSearchResult>;
    private parseExcerpts;
    searchChat(rigId: string, question: string): ChatSearchResult[];
    private getLogFiles;
}
export {};
//# sourceMappingURL=history-query.d.ts.map