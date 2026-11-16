export interface FireRestoreOpts {
    /** Absolute path to the shipped compaction-restore-bridge.cjs (the caller resolves it
     *  from the installed plugin layout; fireRestore fails FAST if it is absent). */
    bridgeScriptPath: string;
    /** The seat's canonical session name — the marker key (identity). */
    sessionName: string;
    /** The seat's OWN authored transcript path — the SAME identity the compaction seam
     *  recorded on the marker (marker.transcriptPath). The bridge's R5 premise gate delivers
     *  ONLY when the delivery event's transcript_path MATCHES the marker's recorded
     *  compaction — the real SessionStart/UserPromptSubmit event carries it. Omitting it made
     *  the gate (correctly) refuse an identity-less event, so nothing was ever delivered. */
    transcriptPath: string;
    /** OPENRIG_HOME the seam reads the restore-pending marker under. */
    openrigHome: string;
    /** The seat's managed cwd (part of the hook payload). */
    cwd: string;
    /** The delivering hook event (SessionStart / UserPromptSubmit). Defaults to
     *  UserPromptSubmit — the bridge's own default and a real delivery trigger. */
    hookEventName?: string;
    /** Deterministic clock injection (an ISO instant) forwarded to the seam's stamps. */
    injectClockNow?: string;
}
export interface RestoreResult {
    /** The injected restore directive (hookSpecificOutput.additionalContext), or null when
     *  nothing was delivered (no pending marker, or the marker was already delivered). */
    additionalContext: string | null;
    /** Absolute path to the seat-keyed restore-pending marker the seam reads/stamps. */
    markerPath: string;
    /** True iff the bridge actually injected a restore directive this call. */
    delivered: boolean;
}
/** Loud, typed failure — a missing bridge or a non-zero bridge exit must fail, never a
 *  silent skip that leaves the seat looking restored when it was not. */
export declare class StubRestoreError extends Error {
    constructor(message: string);
}
/** Fire the real restore bridge for a stub seat and return the directive it injected. */
export declare function fireRestore(opts: FireRestoreOpts): RestoreResult;
//# sourceMappingURL=stub-restore.d.ts.map