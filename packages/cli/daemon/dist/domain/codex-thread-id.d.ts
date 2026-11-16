export type CodexCaptureDiagnostic = {
    reason: "no_log_row" | "no_cli_thread" | "ambiguous_threads" | "sqlite_unreadable";
    count?: number;
};
export type CodexCaptureReporter = (diagnostic: CodexCaptureDiagnostic) => void;
/** F1 (B12's completion): may return a plain value (test stubs stay sync) or a Promise — every
 *  caller awaits it, and the DEFAULT is async so the per-PID `ps eww` spawn no longer blocks the
 *  event loop (measured live: 28.9s/15min of burst blocking inside the 8-attempt capture loops). */
export type ResolveHomeDirByPid = (pid: number) => Promise<string | undefined> | string | undefined;
export declare function defaultResolveHomeDirByPid(pid: number): Promise<string | undefined>;
export declare function readCodexThreadIdFromCandidateHomes(pid: number, candidateHomes: Array<string | undefined>, exists?: (path: string) => boolean, codexHome?: string): string | undefined;
/**
 * OPR.0.5.3.10 (addendum) — thread-id resolution WITHOUT the per-call PID-home
 * subprocess. The measured amplifier: 298 `codex_thread_id.resolve_home` spans
 * in the last 500 slow spans (mean 8.24s, max 36.72s) — a `ps eww` per pid,
 * per attempt, per tick, when nearly every codex seat's logs live under the
 * DEFAULT home.
 *
 * Order of costs:
 *   1. DEFAULT home first — a pure file/sqlite read, ZERO subprocess. Hit = done.
 *   2. Bounded PID-keyed cache of previously RESOLVED non-default homes — a
 *      pid's HOME does not change for the life of the process. Hit = file read.
 *   3. Only then the subprocess resolver — and its SUCCESS is cached (bounded,
 *      FIFO eviction). A FAILED resolution is never cached: the next call may
 *      retry (a dying `ps` under load must not poison the pid).
 */
export declare class CodexThreadIdResolver {
    private readonly opts;
    /** Bounded (pid,identity)→home cache of SUCCESSFUL resolutions — INCLUDING
     *  the default home (a stable default-home pid with no thread log must not
     *  re-run `ps eww` every poll). KEYED BY IDENTITY (r2 round-3): a reused
     *  pid carries a different startedAt, so it structurally MISSES the retired
     *  occupant's entry — no read-time mismatch check to get wrong, and a late
     *  stale-probe completion writes only its own key, never clobbering the
     *  newer occupant's.
     *
     *  SETTLED entries never time-expire (e91d7a94 — the expiry-herd fix): a
     *  probe that STARTED strictly after the identity's lstart second closed
     *  observed the FINAL occupant of this (pid, lstart) key — same-pid
     *  same-second reuse is impossible once the second passes, and a live
     *  process's HOME cannot change — so the answer is valid for the key's
     *  lifetime and is removed only by identity mismatch (a new key) or FIFO
     *  size eviction. Probe START time is the predicate, NOT completion time
     *  (orch-lead 22:39Z): a probe started inside the second can observe the
     *  retired occupant and complete after it. UNSETTLED entries — probe
     *  started inside the ambiguous second, unparseable identity, or
     *  identity-less callers — expire after homeTtlMs (r2-B1/W-5.3-1): the
     *  TTL is their staleness bound and the finite recovery path for the
     *  same-second collision. */
    private readonly homeByKey;
    /** In-flight home resolution, keyed by pid+IDENTITY (r2 round-3): a known
     *  identity must never join a probe belonging to a different or
     *  identity-less occupant — under the measured 8-36s probes a pid can be
     *  reused MID-PROBE, and pid-only coalescing handed the new occupant the
     *  retired occupant's answer before the completed-cache check could run.
     *  Same (pid, identity) still coalesces onto ONE subprocess; a failure
     *  rejects all waiters of that key and caches nothing. */
    private readonly inFlightByKey;
    constructor(opts?: {
        defaultHome?: string;
        /** Explicit provider root; never search another home's logs on a miss. */
        codexHome?: string;
        resolveHomeDirByPid?: ResolveHomeDirByPid;
        readFromLogs?: (pid: number, homeDir: string, report?: CodexCaptureReporter) => string | undefined;
        /** Bounded cache size; oldest-inserted evicts first. Default 256. */
        maxCachedPids?: number;
        /** Freshness bound for UNSETTLED cache entries — identity-less
         *  callers, unparseable identities, and probes that started inside
         *  the identity's ambiguous lstart second. Past it the pid re-probes;
         *  this is the finite recovery path for the same-second collision
         *  (W-5.3-1). Settled entries never consult it. Default 60s.
         *  (The former identityHomeTtlMs tier is gone — e91d7a94: ANY
         *  periodic expiry of settled entries synchronizes an unnecessary
         *  probe herd, measured live as resolve_home +20 in 1.5s.) */
        homeTtlMs?: number;
        /** Injectable clock (tests). */
        now?: () => number;
    });
    /**
     * Resolve a codex thread id for `pid`. IDENTITY IS REQUIRED (S10 follow-on, r1 owed item 3): the
     * identity's start time gates every log read, so a retired occupant's rows never resolve for a
     * reused pid. The ungated read — the pre-round-4 class S10 eliminated, safe today only by
     * call-graph discipline — is reachable ONLY via resolveUngatedLegacy, so a NEW identity-less
     * call site is a COMPILE error (the review-visible pin; see the codex-thread-id test).
     */
    resolve(pid: number, identity: string, report?: CodexCaptureReporter): Promise<string | undefined>;
    /**
     * EXPLICIT ungated escape hatch — reads WITHOUT the identity start-time gate (a reused pid can
     * match a retired occupant's rows). Use ONLY for genuinely identity-less callers (tests, adoption
     * paths that carry no census identity). Every new identity-less read must NAME this method; do
     * not re-open resolve() to an optional identity. By construction its cache entries can never be
     * SETTLED: it delegates with identity=undefined, so minTs is undefined, the settled predicate is
     * false, and every entry it writes stays bounded by homeTtlMs (60s) — see the settled-permanence
     * rule (e91d7a94) on the cache above.
     */
    resolveUngatedLegacy(pid: number, report?: CodexCaptureReporter): Promise<string | undefined>;
    private resolveWithDiagnostics;
    private resolveInternal;
    private cacheHome;
}
/** Parse `ps lstart` ("Sun Aug 23 19:30:00 2026", local time) to epoch
 *  SECONDS. The reader gates STRICTLY (`ts > startTs`, r2 round-6): lstart
 *  carries no subsecond component, so ownership of a row INSIDE the start
 *  second is undecidable — retired A can log at ts == B.startTs in the same
 *  second B reuses the pid. The ambiguous second fails CLOSED (honest
 *  INDETERMINATE; a genuinely-current same-second row resolves one poll
 *  later), rows after it resolve. Unparseable → undefined (the caller falls
 *  back to the ungated read rather than inventing a gate). */
export declare function lstartToMinTs(identity: string | undefined): number | undefined;
export declare function resolveCodexDbPaths(homeDir: string, kind: "logs" | "state", exists?: (path: string) => boolean, codexHome?: string): string[];
//# sourceMappingURL=codex-thread-id.d.ts.map