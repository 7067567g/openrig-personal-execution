export interface LedgerExplorerRow {
    label: string;
    rigName: string;
    seatCount: number;
}
export interface LedgerExplorer {
    /** Always true here — this sidebar is fed from the ledger (the crash-cart one-JSON), not the daemon. */
    ledgerSourced: true;
    /** The honest marker shown on the sidebar (the founder's ledger-sourced honesty requirement). */
    note: string;
    rows: LedgerExplorerRow[];
}
/** The per-rig shape the ledger explorer reads — the crash-cart MODEL's foundOnHost (built from the
 *  SAME one-JSON discovery, so this is not a second read). */
export interface LedgerRigInput {
    name: string;
    seatCount: number;
}
/** Build the ledger-fed explorer from the model's rigs (the SAME one-JSON — no second read). */
export declare function buildLedgerExplorer(foundOnHost: LedgerRigInput[]): LedgerExplorer;
//# sourceMappingURL=ledger-explorer.d.ts.map