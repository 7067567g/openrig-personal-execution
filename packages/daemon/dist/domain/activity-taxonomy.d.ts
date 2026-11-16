/** Activity axis — what a present agent is doing. */
export type ActivityValue = "working" | "idle-at-prompt" | "unknown";
export declare const ACTIVITY_VALUES: ReadonlySet<string>;
/** Session axis — does a process exist. */
export type SessionPresenceValue = "present" | "detached" | "exited" | "absent";
export declare const SESSION_PRESENCE_VALUES: ReadonlySet<string>;
/** Resumability axis — orthogonal to both: revival optimism is never blended into
 *  reachability (the omnigent strict-liveness split). */
export type ResumabilityValue = "live" | "resumable" | "context-walled";
export declare const RESUMABILITY_VALUES: ReadonlySet<string>;
/** needs-input as COUNT + short reason phrase — never a status value. count=0 means
 *  none; reason is the short human phrase ("permission prompt", "usage limit",
 *  "classifier hold") naming WHY nothing is moving. */
export interface NeedsInput {
    count: number;
    reason: string | null;
}
/** The addendum's human-facing display value: the four-value list human surfaces show. */
export type DisplayActivityValue = "working" | "idle" | "needs-input" | "unknown";
/** THE one bridge from the typed axes to the addendum's human-facing value. needs-input
 *  renders whenever the count is positive — visible needs-input evidence outranks a
 *  working self-report for THIS signal (herdr's arbitration cut) — without "needs-input"
 *  ever existing as a stored state. A non-taxonomy activity value refuses loudly: the
 *  surface-local vocabularies this slice retires must not leak back in through display. */
export declare function deriveDisplayActivity(activity: string, needsInput: NeedsInput): DisplayActivityValue;
/** The named rungs, in ARBITRATION RANK order for the working/idle decision (top first).
 *  needs-input-chrome is special-cased: it outranks self-report for the needs-input
 *  signal ONLY, never for working/idle. window-sampling is the fallback floor. */
export type EvidenceRungId = "self-report" | "lifecycle-hooks" | "needs-input-chrome" | "window-sampling";
export declare const EVIDENCE_RUNG_RANK: readonly EvidenceRungId[];
/** AM-2 symmetric admission: a rung EARNS authority the way lower rungs retire.
 *  authoritative — consulted for state; trial — admitted by fixture pass, measured for
 *  agreement, NOT consulted; identity-only — usable for identity/resume refs only
 *  (partial-coverage honesty, and the AM-1 degradation target); positive-only — consulted
 *  only when it reports working, so its silence is unknown, never idle; absent — not staffed. */
export type RungTrust = "authoritative" | "trial" | "identity-only" | "positive-only" | "absent";
export interface RungDeclaration {
    rung: EvidenceRungId;
    /** herdr's cut: only full lifecycle coverage can ever be authoritative. */
    lifecycleCoverage: "full" | "partial" | "none";
    /** The trust the rung STARTS with on this adapter (promotion may raise trial). */
    initialTrust: RungTrust;
}
/** What an adapter declares about itself — arbitration ranks what each source can
 *  actually observe. Re-declared at every occupant swap (AM-1 corollary): a successor
 *  never inherits its predecessor's rung authority. */
export interface AdapterRungInventory {
    adapterId: string;
    runtime: "claude-code" | "codex" | "tmux-generic" | "agent-app";
    rungs: RungDeclaration[];
}
/** One piece of evidence an adapter reports into the oracle. Every rung's evidence is
 *  SELF-DATED except historically the hook rung — which is exactly why hook authority is
 *  time-bounded (AM-1): observedAt here is the ingest clock for hooks. */
export interface ActivityEvidence {
    seatNodeId: string;
    sessionName: string;
    rung: EvidenceRungId;
    /** Stable source id, e.g. "claude:pid-json", "codex:hooks", "tmux:window-activity". */
    sourceId: string;
    /** Monotonic per source — stale or reordered reports are dropped. */
    seq: number;
    observedAt: string;
    activity?: ActivityValue;
    needsInput?: NeedsInput;
    permissionRequest?: {
        id: string;
    };
}
/** A visible rung-health transition (AM-1): arbitration can never make a silently-dead
 *  source authoritative, and the degradation itself must be observable. */
export interface RungHealthEvent {
    seatNodeId: string;
    rung: EvidenceRungId;
    sourceId: string;
    from: RungTrust;
    to: RungTrust;
    reason: string;
    at: string;
}
/** The arbitrated, seat-keyed answer every surface renders from. */
export interface ArbitratedSeatState {
    seatNodeId: string;
    activity: ActivityValue;
    needsInput: NeedsInput;
    /** The authoritative needs-input evidence that supplied `needsInput`: its rung and when it
     *  was observed. Null when no rung answered and `needsInput` is only the default zero — a
     *  declared rung that never reported is not an observation that the seat is clear. */
    needsInputEvidence: {
        rung: EvidenceRungId;
        observedAt: string;
    } | null;
    /** Which rung decided `activity` — confidence made visible. */
    decidedBy: EvidenceRungId | null;
    /** Monotonic arbitrated-state sequence (wait-after-seq consumes it). */
    seq: number;
    changedAt: string;
    rungs: Array<{
        rung: EvidenceRungId;
        sourceId: string;
        trust: RungTrust;
        lastEvidenceAt: string | null;
    }>;
    /** The occupant swap is its OWN visible event, never an activity transition. */
    lastSwap: {
        generation: string;
        at: string;
    } | null;
}
/** Claude Code: pid.json self-report ABOVE hooks for working/idle (r3 standing), the
 *  Stop/StopFailure hook pair (r2 standing), visible chrome (r4 standing), sampling
 *  floor (r1). All full-lifecycle → authoritative (the named CURRENT rungs). */
export declare const CLAUDE_ACTIVITY_RUNG_INVENTORY: AdapterRungInventory;
/** Codex 0.147: the four-event hook rung covers the turn lifecycle — a REAL authority
 *  CANDIDATE (AM-2: enters at TRIAL; production agreement promotes). NO pid.json analog
 *  (verified on-box) — its ladder tops out at hooks; sampling stays the floor. */
export declare const CODEX_ACTIVITY_RUNG_INVENTORY: AdapterRungInventory;
/** The generic tmux floor: sampling only — exactly what an undeclared seat gets. */
export declare const TMUX_GENERIC_RUNG_INVENTORY: AdapterRungInventory;
/** A community agent app declares no activity signal. A changing screen reads working, decided by window
 *  sampling; a quiet screen reads unknown, never idle, since an app can sit quietly at a prompt or an approval. */
export declare const AGENT_APP_RUNG_INVENTORY: AdapterRungInventory;
/** Resolve a runtime string to its rung inventory (the ingest auto-declaration path).
 *  Unknown runtimes get the generic floor — partial-coverage honesty by default. A seat launched for a community
 *  agent app (its session's recorded selection, still the node's runtime) gets that app's inventory. */
export declare function runtimeRungInventory(runtime: string | null, agentApp?: string | null): AdapterRungInventory;
//# sourceMappingURL=activity-taxonomy.d.ts.map