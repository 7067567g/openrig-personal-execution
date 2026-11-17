import Database from "better-sqlite3";
import type { ContextUsage, ContextUnknownReason } from "./types.js";
/** Freshness threshold: samples older than this are considered stale for compact displays. */
export declare const FRESHNESS_THRESHOLD_MS = 600000;
export interface ContextUsageStoreOpts {
    stateDir: string;
    codexHomeDir?: string | null;
    /** Explicit CODEX_HOME. codexHomeDir above is the legacy OS-home input. */
    codexHome?: string;
    resolveOccupantBootAt?: (nodeId: string) => string | null;
}
interface SidecarRaw {
    context_window?: {
        context_window_size?: number;
        used_percentage?: number;
        remaining_percentage?: number;
        total_input_tokens?: number;
        total_output_tokens?: number;
        current_usage?: unknown;
    };
    session_id?: string;
    session_name?: string;
    /** Managed seat generation inherited by the status-line collector. Lets consumers distinguish
     *  a canonical occupant from a retained predecessor whose launch-time --name aliases the seat. */
    occupant_generation?: string;
    transcript_path?: string;
    /** Claude's statusline `cost.total_cost_usd`: a cumulative client-side estimate for the native session. */
    cost?: {
        total_cost_usd?: number | null;
    } | null;
    sampled_at?: string;
}
export declare class ContextUsageStore {
    readonly db: Database.Database;
    private stateDir;
    private codexHomeDir;
    private codexHome?;
    private readonly resolveOccupantBootAt?;
    constructor(db: Database.Database, opts: ContextUsageStoreOpts);
    /**
     * GHOST-STAGE (c-id): is this reading from a generation PRIOR to the node's live occupant?
     * A reading sampled strictly before the current occupant booted belongs to a retired tenure
     * (the frozen-88% specimen in the mixed-gen window after handover, where the name is reused so
     * session_mismatch cannot catch it). Returns false when boot time is UNKNOWN or the reading has
     * no sampled_at — the gate is inert (note-2: never treat unknown as stale), leaving
     * session_mismatch + freshness as the remaining guards. boot_at is SQLite datetime('now') (UTC,
     * no zone marker), so it is parsed as UTC; a bare Date.parse would read it as local time.
     */
    private isPriorGenerationReading;
    /** Get the sidecar file path for a session. */
    getSidecarPath(sessionName: string): string;
    /**
     * GHOST-STAGE (e) Class-A 2a: remove a retiring occupant's name-keyed context sidecar so a
     * same-name successor does not read the predecessor's frozen telemetry sample (the "gen-1 88%
     * resurfaced as a live threshold flag" specimen). Safe by TIMING — the cutover seam
     * (OccupantInvalidator) calls this inside SeatHandoverService.commit(), BEFORE the successor
     * writes its own sidecar. Missing file = no-op; best-effort (a leftover is caught downstream by
     * the freshness gate). NOTE: this is the DISK sidecar (name-keyed); the context_usage DB table is
     * node_id-keyed + already session_mismatch-gated, so it needs no invalidation here.
     */
    invalidateOccupantSidecar(sessionName: string): void;
    /** Read and parse a sidecar JSON file. Returns discriminated result. */
    readSidecar(sessionName: string): {
        ok: true;
        data: SidecarRaw;
    } | {
        ok: false;
        reason: "missing_sidecar" | "parse_error";
    };
    private readSidecarAt;
    /** Read sidecar and normalize into ContextUsage in one step. */
    readAndNormalize(sessionName: string): ContextUsage;
    /** Read the latest Codex token_count event for a thread and normalize it. */
    readCodexAndNormalize(input: {
        threadId: string | null | undefined;
        sessionName: string;
    }): ContextUsage;
    /** Resolve an explicitly selected native thread, even before its first token count. */
    readCodexTranscriptPath(threadId: string): string | null;
    /**
     * Read the OpenCode/DSH runner's per-seat `usage.json` sidecar and normalize it.
     *
     * The runner owns the fold (streaming tokens/cost → monotonic totals); this
     * read surface only maps the snapshot onto `ContextUsage`. `stateDir` is
     * OPENRIG_HOME, so the sidecar lives at
     * `OPENRIG_HOME/state/<runtime>/<sanitized-session>/usage.json`.
     *
     * Missing file → `missing_sidecar`; unparseable/incompatible sidecar →
     * `parse_error`. Neither is treated as a zero sample.
     */
    readCliAgentAndNormalize(input: {
        runtime: "opencode" | "dsh";
        sessionName: string;
        /** Optional explicit current-tenure fence. The DB-backed resolver below is
         * the production path; tests and future callers may inject it directly. */
        occupantGeneration?: string;
    }): ContextUsage;
    /** Resolve the live tenure for a seat name without importing SessionRegistry
     * (the store owns the same DB). Any failure is UNKNOWN, not a fabricated match. */
    private resolveOccupantGenerationForSession;
    /** Map a validated runner usage sidecar to the shared context-usage shape.
     * Missing token components remain null; they are never added as zero. */
    private normalizeCliAgentUsage;
    /** Normalize raw sidecar data into a ContextUsage record. */
    normalizeSample(raw: SidecarRaw | null): ContextUsage;
    /** Normalize a Codex token_count JSONL event into ContextUsage. */
    private normalizeCodexTokenCount;
    /** Persist a context usage record for a node. Upserts. */
    persist(nodeId: string, usage: ContextUsage): void;
    /** Get context usage for a single node. Session-aware: mismatched session returns unknown. */
    getForNode(nodeId: string, currentSessionName: string | null): ContextUsage;
    /** Batch get context usage for multiple nodes. Session-aware per entry. */
    getForNodes(entries: Array<{
        nodeId: string;
        currentSessionName: string | null;
    }>): Map<string, ContextUsage>;
    /** Create an unknown ContextUsage with an honest reason. */
    unknownUsage(reason: ContextUnknownReason): ContextUsage;
    /** Check if a sample timestamp is fresh. */
    private isFresh;
    /** Convert a DB row to a ContextUsage, applying freshness. */
    private rowToUsage;
    private normalizeCurrentUsage;
    private readCodexThread;
    private resolveCodexStateDbPaths;
    private readLatestCodexTokenCount;
    private readTail;
}
export {};
//# sourceMappingURL=context-usage-store.d.ts.map