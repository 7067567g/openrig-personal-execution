/** Build the ledger-fed explorer from the model's rigs (the SAME one-JSON — no second read). */
export function buildLedgerExplorer(foundOnHost) {
    return {
        ledgerSourced: true,
        note: "ledger-sourced · daemon down",
        rows: foundOnHost.map((r) => ({ label: `▦ ${r.name}`, rigName: r.name, seatCount: r.seatCount })),
    };
}
//# sourceMappingURL=ledger-explorer.js.map