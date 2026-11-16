export interface PinnedSeat {
    nodeId: string;
    sessionName: string;
    rigId: string;
    rigName: string;
    runtime: string | null;
    pinnedModel: string;
    /** Occupant generation (null = unknown; falls back to sessionName grain). */
    generation: string | null;
}
export interface ChannelOutcome {
    channel: "orchestrator" | "operator" | "oversight" | "slack";
    target: string | null;
    status: "delivered" | "failed" | "deferred" | "retained";
    detail?: string;
}
export interface ModelDivergenceProclamation {
    nodeId: string;
    sessionName: string;
    rigId: string;
    rigName: string;
    runtime: string | null;
    pinnedModel: string;
    effectiveModel: string;
    diagnosis: string | null;
    detectedAt: string;
    channels: ChannelOutcome[];
}
/** D-a — the effective read carries a NAMED reason on every no-answer outcome, and may be async
 *  (the current-generation join reads the live process table). */
export type EffectiveModelRead = {
    ok: true;
    model: string;
} | {
    ok: false;
    reason: string;
};
export interface ModelDivergenceMonitorDeps {
    /** Every running canonical seat carrying a model pin (the detector's whole population). */
    listPinnedSeats: () => PinnedSeat[];
    /** Per-runtime effective read via the CURRENT GENERATION's own record (D-a: never a name/token
     *  lookup that can silently cross a generation boundary). No-answer = named reason = pending.
     *  OPR.0.5.3.10 mini-req 1: `cycle`, when passed, carries the POLL-SCOPED process lister — one
     *  census for every seat in the pass, never a `ps` per seat. */
    readEffectiveModel: (seat: PinnedSeat, cycle?: {
        listProcesses: () => Promise<Array<{
            pid: number;
            ppid: number;
            command: string;
        }>>;
    }) => Promise<EffectiveModelRead> | EffectiveModelRead;
    /** OPR.0.5.3.10 — the shared census; when present, checkOnce() threads a cycle-scoped lister
     *  into every readEffectiveModel call (lazy: a pass with every seat settled spawns nothing). */
    processCensus?: {
        cycleLister(): () => Promise<Array<{
            pid: number;
            ppid: number;
            command: string;
        }>>;
    };
    /** In-daemon send to a session (the watchdog delivery seam). */
    sendToSession: (sessionName: string, message: string, occurrenceId?: string) => Promise<{
        ok: boolean;
        error?: string;
        outcome?: string;
    }>;
    /** The seat's own rig's orchestrator seats (session names). */
    resolveOrchSeats: (rigName: string) => string[];
    /** The configured operator seat (derived from config, never hardcoded). Null = unconfigured. */
    resolveOperatorSeat: () => string | null;
    /** The fleet oversight judgment seat (cross-host target), or null when unroutable. */
    resolveOversightSeat: () => string | null;
    /** Durable record of the proclamation + its per-channel outcomes. */
    recordProclamation: (p: ModelDivergenceProclamation) => void;
    /** Optional cause string when a rejection signal is known (diagnosis, NEVER the trigger). */
    diagnose?: (seat: PinnedSeat) => string | null;
    now?: () => Date;
    warn?: (message: string) => void;
}
export declare const SLACK_DEFERRAL_LINE = "human-via-Slack: deferred: M1 not landed";
/** Polls a pinned generation may stay signal-less before it is loudly named as unchecked. */
export declare const PENDING_VISIBILITY_POLLS = 10;
export declare function formatProclamation(p: Omit<ModelDivergenceProclamation, "channels">): string;
export declare class ModelDivergenceMonitor {
    private readonly deps;
    /** Generations already given their one verdict (match or proclaimed divergence). */
    private readonly settled;
    /** r1 B8 finding — OBSERVABLE PENDING: consecutive no-signal polls per generation. Detection
     *  silence is the failure class one layer under channel silence: a seat whose effective model
     *  never reads must be VISIBLE as never-checked, not skipped by a bare continue forever. */
    private readonly pendingPolls;
    private readonly pendingReasons;
    private readonly pendingWarned;
    private timer;
    private readonly warn;
    constructor(deps: ModelDivergenceMonitorDeps);
    startPolling(intervalMs: number): void;
    stop(): void;
    /** Pinned generations currently pending (no effective read yet) with their poll counts — the
     *  observable face of detection-pending (tests + any future status surface). */
    pendingSeats(): Array<{
        key: string;
        polls: number;
        reason: string | null;
    }>;
    /** One pass over the pinned population. Returns the proclamations fired this pass (for tests). */
    checkOnce(): Promise<ModelDivergenceProclamation[]>;
    /** One seat's check. Extracted so checkOnce can isolate a per-seat throw (defense-in-depth): a
     *  throw here is caught per seat and never aborts the pass. Pushes any proclamation into `fired`. */
    private checkSeat;
    private proclaim;
    private deliver;
}
/** Pin comparison: canonicalize the PIN through the one shipped alias map, then EXACT,
 *  case-insensitive, after trimming (f7dfca0c, founder-steered). History on record: exact was
 *  ruled at build; a seat reversed it to whole-token alias matching; r2 reversed THAT back
 *  because generic token containment lets one pin bless multiple distinct models ("codex"
 *  matched gpt-5.6-codex AND gpt-5.1-codex-mini). The landed remedy is the explicit
 *  provider-aware mapping r2's ruling allowed for: CANONICAL_MODEL_PINS
 *  (spec-validation-advisory.ts) is the SINGLE mapping home — spec validation nudges pins
 *  toward canonical ids with it, and this detector canonicalizes the pinned string through the
 *  same data before comparing. Never add a second map here, and never token containment: an
 *  unknown alias or a fallback model canonicalizes to itself and still diverges. Raw
 *  pinned/effective strings travel untouched in any proclamation. */
export declare function modelsMatch(pinned: string, effective: string): boolean;
//# sourceMappingURL=model-divergence-monitor.d.ts.map