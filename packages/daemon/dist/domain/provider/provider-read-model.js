// Slice-04 (OPR.0.5.0.4) — the four-block ASSEMBLY (packet 3ffa3c22 §1, proof item 4).
// A PURE assembler over already-collected inputs (no CLI/auth I/O — collection is a separate
// seam). It emits real bound rows + explicit unbound rows (seat_with_no_account), computes
// same_account_on_n_seats ONLY from repeated real account IDs, attaches anomalies
// deterministically, preserves signals unchanged, and invents no IDs/boundAt/asOf.
export function assembleFourBlock(input) {
    const { accounts, rawBindings, signals, asOf } = input;
    // Group DISTINCT seat sessions by REAL account id (unbound/null-account seats never
    // contribute). A Set so duplicate raw rows for the same account+seat cannot inflate the count.
    const seatsByAccount = new Map();
    for (const rb of rawBindings) {
        if (rb.accountId === null)
            continue;
        const set = seatsByAccount.get(rb.accountId) ?? new Set();
        set.add(rb.seatSession);
        seatsByAccount.set(rb.accountId, set);
    }
    // A same_account_on_n_seats anomaly per account genuinely shared across >= 2 DISTINCT seats.
    const sharedAnomalyByAccount = new Map();
    for (const [accountId, seats] of seatsByAccount) {
        if (seats.size < 2)
            continue;
        const sortedSeats = [...seats].sort(); // deterministic
        sharedAnomalyByAccount.set(accountId, {
            kind: "same_account_on_n_seats",
            count: sortedSeats.length,
            seats: sortedSeats,
            evidence: `account ${accountId} bound on ${sortedSeats.length} seats: ${sortedSeats.join(", ")}`,
            asOf,
        });
    }
    const bindings = rawBindings.map((rb) => {
        if (rb.accountId === null) {
            const anomaly = {
                kind: "seat_with_no_account",
                seat: rb.seatSession,
                evidence: `seat ${rb.seatSession} in rig ${rb.rigName} has no bound account`,
                asOf,
            };
            // Non-empty tuple: the seat_with_no_account anomaly is required and always first.
            return {
                accountId: null,
                seatSession: rb.seatSession,
                rigName: rb.rigName,
                boundAt: null,
                bindingSource: null,
                anomalies: [anomaly],
            };
        }
        const shared = sharedAnomalyByAccount.get(rb.accountId);
        const anomalies = shared ? [shared] : [];
        return {
            accountId: rb.accountId,
            seatSession: rb.seatSession,
            rigName: rb.rigName,
            boundAt: rb.boundAt,
            bindingSource: rb.bindingSource,
            anomalies,
        };
    });
    return {
        accounts,
        bindings,
        signals, // preserved unchanged
        asOf,
    };
}
//# sourceMappingURL=provider-read-model.js.map