// OPR.0.4.6.FAC1 — the PURE role→seat selection policy (BR-1).
//
// THE PURITY CONTRACT (arch Q1 = guard B4, binding): this module is a
// pure function over an already-materialized fact array. It has ZERO
// runtime imports — no db, no clock, no randomness, no locale, no
// tmux/activity probes. The commit-4 import-audit test pins that this
// file never grows a `Date`/`Math.random`/`localeCompare`/async
// dependency: same candidate facts in → same seat out, on every
// process, every replay, every version.
//
// THE CLOSED FACT SET (arch Q1): role · nodeKind · lifecycleState ·
// runtime · pendingWorkCount (the sync pending-only SQL map) · the
// derived canonical coordinate. Nothing else may influence selection.
//
// GATE ORDER (guard B4, pinned): nodeKind === "agent" AND
// lifecycleState === "running" filter FIRST, then the managed-seat /
// coordinate gates, then runtime match, then capacity ordering.
//
// THE ONE STRING RULE (arch Q5 = guard B2): the seat identity used for
// BOTH the tiebreak key AND the recorded destination is the DERIVED
// canonical coordinate `{pod}-{member}@{rig}` — never a raw
// occupant-era session name. Adopted seats (raw tmux name ≠ derived
// coordinate) are EXCLUDED from the v1 candidate set LOUDLY with the
// named disqualifier `adopted_seat_not_role_resolvable_v1`
// (un-exclusion is a named follow-up carrying the delivery-duality
// test — planner2 §3.7).
//
// TIEBREAK (BR-1): ascending pendingWorkCount, then the coordinate by
// PLAIN CODEPOINT comparison (`<`), never localeCompare/natural sort —
// `driver10@rig < driver2@rig` is the pinned counterintuitive vector;
// "fixing" it into natural sort is a cross-version determinism break.
function verdictOf(c, disqualifier) {
    return {
        coordinate: c.coordinate,
        logicalId: c.logicalId,
        disqualifier,
        facts: {
            role: c.role,
            lifecycleState: c.lifecycleState,
            runtime: c.runtime,
            pendingWorkCount: c.pendingWorkCount,
        },
    };
}
/**
 * Select the seat for `role` from the candidate facts. Pure; order of
 * the input array never affects the outcome (commit-4 permutation
 * vector).
 *
 * `harness` = the step's WF-2 pin: when set, a qualified seat must run
 * exactly that runtime; when absent, any AGENT runtime qualifies (the
 * nodeKind gate already excludes infrastructure/terminal).
 */
export function selectRoleSeat(input) {
    const disqualified = [];
    const qualified = [];
    for (const c of input.candidates) {
        // Infrastructure/terminal nodes are not agent seats — schema
        // rejects role on them; they are silently out of scope (never
        // listed: a terminal server is not an actionable candidate).
        if (c.nodeKind !== "agent")
            continue;
        if (c.role !== input.role) {
            disqualified.push(verdictOf(c, "role_not_declared"));
            continue;
        }
        if (c.lifecycleState !== "running") {
            disqualified.push(verdictOf(c, `not_live(lifecycleState=${c.lifecycleState})`));
            continue;
        }
        // The v1 managed-seat scope pin (arch Q5): an adopted seat's
        // raw-name/derived-name delivery duality is the handover-stranding
        // hazard — excluded LOUDLY, visible in every candidates output.
        if (c.coordinate === null) {
            disqualified.push(verdictOf(c, "coordinate_underivable"));
            continue;
        }
        if (c.rawSessionName !== null && c.rawSessionName !== c.coordinate) {
            disqualified.push(verdictOf(c, "adopted_seat_not_role_resolvable_v1"));
            continue;
        }
        if (input.harness !== undefined && c.runtime !== input.harness) {
            disqualified.push(verdictOf(c, `runtime_mismatch(${c.runtime ?? "unknown"}≠${input.harness})`));
            continue;
        }
        qualified.push(c);
    }
    // Capacity ordering: least unclaimed backlog first; tiebreak by the
    // coordinate, PLAIN codepoint ascending (driver10@rig < driver2@rig).
    qualified.sort((a, b) => {
        if (a.pendingWorkCount !== b.pendingWorkCount) {
            return a.pendingWorkCount - b.pendingWorkCount;
        }
        const ka = a.coordinate;
        const kb = b.coordinate;
        return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
    return {
        seat: qualified[0]?.coordinate ?? null,
        disqualified,
        qualified: qualified.map((c) => ({
            coordinate: c.coordinate,
            logicalId: c.logicalId,
            pendingWorkCount: c.pendingWorkCount,
        })),
    };
}
//# sourceMappingURL=workflow-role-resolver.js.map