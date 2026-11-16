// Crash-cart C3 — the one-click gate (founder rule, binding on ⏎). ⏎ is ONE keystroke IFF the restore
// plan is ZERO GENERATION (every seat resume-original). Daemon-DOWN, we compute the proxy from the C2
// read: a rig is fully recoverable when resumableCount == seatCount. Any rig with non-resumable seats
// makes ⏎ lead to a confirm screen naming those deltas — never a silent resume→fresh downgrade.
/** The confirm-screen message for a non-zero-generation restore. TRUTHFUL (r2 HIGH-2): the restore
 *  does NOT auto-fresh-prime — non-resumable seats land in the triage list AWAITING A DECISION
 *  (fresh-prime or skip). It NAMES the deltas (R7: no silent resume→fresh downgrade) and describes the
 *  decision that follows; it never promises an action the restore doesn't request. */
export function restoreConfirmMessage(deltas) {
    const names = deltas.map((d) => `${d.rigName} (${d.nonResumable}/${d.seatCount})`).join(", ");
    return `⏎ RESTORE: ${names} have seats that can't resume — they'll need a decision (fresh-prime or skip) in the triage list. Press ⏎ to proceed, Esc to cancel.`;
}
/** Evaluate the one-click gate over the C2 discovery's per-rig resumable/seat counts. */
export function evaluateOneClickGate(discovery) {
    const deltas = discovery.foundOnHost
        .filter((r) => r.resumableCount < r.seatCount)
        .map((r) => ({
        rigName: r.rigName,
        seatCount: r.seatCount,
        resumableCount: r.resumableCount,
        nonResumable: r.seatCount - r.resumableCount,
    }));
    return { zeroGeneration: deltas.length === 0, deltas };
}
//# sourceMappingURL=one-click-gate.js.map