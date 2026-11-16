// OPR.0.5.5.19 — THE FORMAL ACTIVITY TAXONOMY: the declared state language every surface
// renders from (TUI, `rig ps`, node-inventory). Three orthogonal axes plus derived
// diagnoses, ratified at product/from-openrig.dev/taxonomy-agent-state-ADDENDUM-2026-08-26.md
// (founder ruling 22:00Z); reconciliation vs herdr/omnigent lives in
// docs/reference/agent-state-taxonomy.md — the doc CITES the addendum, never forks it.
//
// BINDING EXCLUSIONS (SPEC mini-req 1, adversarially held — verdict 1229a4b7):
//  - attention and needs-input are NEVER values of the activity enum. needs-input rides
//    as a count + short reason phrase (the omnigent pending_elicitations_count +
//    blocked_on shape); attention stays in its own machinery (attentionCount).
//  - UNKNOWN is a first-class honest value — the oracle saying "cannot tell", never an
//    error and never a guess. Unknown beats a confident wrong answer.
//  - Derived diagnoses (PARKED, HELD-is-not-parked, DONE-UNSEEN) are computed at read
//    time from the axes + the queue's obligation face; they are never stored as states.
//
// The addendum's human-facing activity list shows four values (working / idle /
// needs-input / unknown). The typed enum carries THREE: needs-input is derived for
// display from the count+reason fields via `deriveDisplayActivity` — the one bridge —
// so no store or transition ever holds "needs-input" as a state. That reconciliation
// is documented in the reference doc's addendum-mapping section.
import { agentAppOf } from "./built-in-runtimes.js";
export const ACTIVITY_VALUES = new Set([
    "working",
    "idle-at-prompt",
    "unknown",
]);
export const SESSION_PRESENCE_VALUES = new Set([
    "present",
    "detached",
    "exited",
    "absent",
]);
export const RESUMABILITY_VALUES = new Set([
    "live",
    "resumable",
    "context-walled",
]);
/** THE one bridge from the typed axes to the addendum's human-facing value. needs-input
 *  renders whenever the count is positive — visible needs-input evidence outranks a
 *  working self-report for THIS signal (herdr's arbitration cut) — without "needs-input"
 *  ever existing as a stored state. A non-taxonomy activity value refuses loudly: the
 *  surface-local vocabularies this slice retires must not leak back in through display. */
export function deriveDisplayActivity(activity, needsInput) {
    if (!ACTIVITY_VALUES.has(activity)) {
        throw new Error(`"${activity}" is not a taxonomy activity value (working | idle-at-prompt | unknown) — ` +
            `surface-local vocabulary must be mapped at its adapter, never rendered`);
    }
    if (needsInput.count > 0)
        return "needs-input";
    if (activity === "idle-at-prompt")
        return "idle";
    return activity;
}
export const EVIDENCE_RUNG_RANK = [
    "self-report",
    "lifecycle-hooks",
    "window-sampling",
];
// ── Per-runtime rung inventories (SPEC mini-reqs 4, 5, 7) — ONE data source; the
// adapters and the ingest auto-declaration both read these, never redefine them. ──
/** Claude Code: pid.json self-report ABOVE hooks for working/idle (r3 standing), the
 *  Stop/StopFailure hook pair (r2 standing), visible chrome (r4 standing), sampling
 *  floor (r1). All full-lifecycle → authoritative (the named CURRENT rungs). */
export const CLAUDE_ACTIVITY_RUNG_INVENTORY = {
    adapterId: "claude-code-adapter",
    runtime: "claude-code",
    rungs: [
        { rung: "self-report", lifecycleCoverage: "full", initialTrust: "authoritative" },
        { rung: "lifecycle-hooks", lifecycleCoverage: "full", initialTrust: "authoritative" },
        { rung: "needs-input-chrome", lifecycleCoverage: "full", initialTrust: "authoritative" },
        { rung: "window-sampling", lifecycleCoverage: "full", initialTrust: "authoritative" },
    ],
};
/** Codex 0.147: the four-event hook rung covers the turn lifecycle — a REAL authority
 *  CANDIDATE (AM-2: enters at TRIAL; production agreement promotes). NO pid.json analog
 *  (verified on-box) — its ladder tops out at hooks; sampling stays the floor. */
export const CODEX_ACTIVITY_RUNG_INVENTORY = {
    adapterId: "codex-runtime-adapter",
    runtime: "codex",
    rungs: [
        { rung: "lifecycle-hooks", lifecycleCoverage: "full", initialTrust: "trial" },
        { rung: "needs-input-chrome", lifecycleCoverage: "full", initialTrust: "authoritative" },
        { rung: "window-sampling", lifecycleCoverage: "full", initialTrust: "authoritative" },
    ],
};
/** The generic tmux floor: sampling only — exactly what an undeclared seat gets. */
export const TMUX_GENERIC_RUNG_INVENTORY = {
    adapterId: "tmux-generic",
    runtime: "tmux-generic",
    rungs: [{ rung: "window-sampling", lifecycleCoverage: "full", initialTrust: "authoritative" }],
};
/** A community agent app declares no activity signal. A changing screen reads working, decided by window
 *  sampling; a quiet screen reads unknown, never idle, since an app can sit quietly at a prompt or an approval. */
export const AGENT_APP_RUNG_INVENTORY = {
    adapterId: "agent-app",
    runtime: "agent-app",
    rungs: [{ rung: "window-sampling", lifecycleCoverage: "partial", initialTrust: "positive-only" }],
};
/** Resolve a runtime string to its rung inventory (the ingest auto-declaration path).
 *  Unknown runtimes get the generic floor — partial-coverage honesty by default. A seat launched for a community
 *  agent app (its session's recorded selection, still the node's runtime) gets that app's inventory. */
export function runtimeRungInventory(runtime, agentApp) {
    if (runtime === "claude-code")
        return CLAUDE_ACTIVITY_RUNG_INVENTORY;
    if (runtime === "codex")
        return CODEX_ACTIVITY_RUNG_INVENTORY;
    if (agentAppOf(agentApp, runtime))
        return AGENT_APP_RUNG_INVENTORY;
    return TMUX_GENERIC_RUNG_INVENTORY;
}
//# sourceMappingURL=activity-taxonomy.js.map