export interface FireCompactionOpts {
    /** Absolute path to the shipped precompact-hook.mjs (the caller resolves it from the
     *  installed plugin layout; fireCompaction fails FAST if it is absent). */
    hookScriptPath: string;
    /** The seat's canonical session name — the marker key (identity). */
    sessionName: string;
    /** OPENRIG_HOME the seam reads/writes the restore-pending marker under. */
    openrigHome: string;
    /** The seat's managed cwd (packet generation + transcript discovery). */
    cwd: string;
    /** An explicit JSONL transcript for deterministic packet generation (optional; absent
     *  falls back to the hook's own latest-transcript discovery). */
    transcriptPath?: string;
    /** Deterministic clock injection (an ISO instant) forwarded to the seam's stamps. */
    injectClockNow?: string;
}
export interface CompactionResult {
    /** Absolute path to the seat-keyed restore-pending marker the real seam wrote. */
    markerPath: string;
}
/** Loud, typed failure — a missing hook or a seam that produced no marker must fail,
 *  never a silent skip that leaves the seat looking compaction-clean. */
export declare class StubCompactionError extends Error {
    constructor(message: string);
}
/** Fire the real precompact seam for a stub seat and return the marker it wrote. */
export declare function fireCompaction(opts: FireCompactionOpts): CompactionResult;
//# sourceMappingURL=stub-compaction.d.ts.map