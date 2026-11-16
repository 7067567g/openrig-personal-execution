import { ConfigStore } from "./config-store.js";
/**
 * Slice 15 (OPR.0.7.0.15) P1 — the short receipt a queue WRITE prints when the
 * `output.compact` switch is on. A CLI-side projection of the daemon's response:
 * the daemon's route shapes (and the payload a cross-host write forwards) are
 * untouched, and `--full` prints today's whole response byte for byte.
 *
 * The receipt names the row, its state and owner, what needs action (blocker,
 * backstop, warnings, advisories) and the wake evidence the response actually
 * carries. It never echoes the body, and its footer names what it left out and
 * the read that returns it. Error responses never come here: they print in full.
 */
/** Whether compact defaults are on, by the config store's own resolution, the
 *  same one `rig config get output.compact` reports: `OPENRIG_OUTPUT_COMPACT`
 *  (`true`/`1` or `false`/`0`), else the config file, else off. An invalid env
 *  value is rejected with the store's warning and falls back to the file, as
 *  `config get` does. An unreadable config is off. */
export declare function compactOutputEnabled(store?: Pick<ConfigStore, "get">): boolean;
export type WriteVerb = "create" | "claim" | "unclaim" | "update" | "block" | "handoff" | "handoff-and-complete";
export interface ReceiptContext {
    verb: WriteVerb;
    /** The CLI sent nudge:false (`--no-nudge`). */
    nudgeSuppressed?: boolean;
    /** The caller named the row id (`create --id`), so the daemon may have returned an existing row. */
    idGiven?: boolean;
    /** A `--host` write whose new row lives on another daemon. */
    remoteHost?: string;
    /** The selected daemon's own host id could not be read, so `remoteHost` may name this daemon. */
    remoteHostUnconfirmed?: boolean;
}
type Row = Record<string, unknown>;
export interface WriteReceipt {
    json: Row;
    text: string;
}
/** Project a successful write response to its receipt. Returns null for a
 *  shape this projection does not recognize, so the caller prints the whole
 *  response rather than guess. */
export declare function buildWriteReceipt(body: unknown, ctx: ReceiptContext): WriteReceipt | null;
export {};
//# sourceMappingURL=queue-receipt.d.ts.map