// Living Notes — the composed-review read contract (OPR.0.4.4.20, rebuilt
// per the CORRECTIVE REDESIGN of 2026-07-05).
//
// ONE contract, all consumers: the slice Review tab, the mission board's
// U5 row expansion, and the For-You expansion all read these shapes; the
// agents projection is scope-parameterized (slice:<id> | mission:<id> | rig)
// on the same contract — never a second endpoint.
//
// CORRECTIVE §3.1 — a slice review is ONE vertical stack of three sections:
// INTENT → PLAN → DELIVERED. The four parallel renderable structures the
// original build carried (sections / acceptance / join / compare) are
// DELETED, not demoted; the separate two-regime `green` field is REMOVED
// (§11) — its recorded-verdict rigor is the source of the per-deliverable
// `verified` signal.
//
// The composer that fills these shapes is PURE: same inputs (including the
// caller-supplied view-time facts like `nowIso` and `mainTip`) produce a
// byte-identical output. Every section names its SSOT and degrades to a
// declared value — never invented content.
// --- C1 header (ratified closed sets — Packet 1 FR-8; extending them is a
// convention change, not a code decision) ---
export const C1_ARTIFACT_TYPES = ["guard", "qa", "rev1-r1", "rev1-r2", "adjudication"];
export const C1_VERDICTS = ["CLEAR", "BLOCKING", "CONCERNING", "PASS", "NOT-CLEAR"];
export const GATE_ROLES = ["guard", "qa", "rev1-r1", "rev1-r2"];
// --- FR-3: derived phase (five-way, top-down precedence — KEEP) ---
export const REVIEW_PHASES = ["locked", "review", "building", "spec", "intent"];
/** BR-10 render vocabulary (SS14). Derivation names map 1:1; only the label differs. */
export const PHASE_LANE_LABELS = {
    intent: "INTENT",
    spec: "PLAN",
    building: "BUILD",
    review: "REVIEW",
    locked: "LOCKED",
};
//# sourceMappingURL=types.js.map