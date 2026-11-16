import { type ContentLine } from "../detail.js";
import type { FleetSnapshot } from "../types.js";
export type Row = Record<string, unknown>;
export interface UsageRead {
    /** The served read model, or why it couldn't be read (status null: no HTTP answer). */
    status: {
        model: Row;
    } | {
        status: number | null;
        error: string;
    };
    /**
     * Read only when the model has no `usage` key, to say why: the daemon's provider.usage_windows setting entry,
     * "absent" when the daemon doesn't know the key (it predates usage windows), or null when that read failed.
     */
    switchSetting?: {
        value: unknown;
        source?: string;
    } | "absent" | null;
}
export declare const USAGE_HEADER = "this host's daemon only \u00B7 not fleet-wide \u00B7 not proof of the login a running session uses";
export declare const USAGE_REFRESH_HINT = "This view shows what this daemon already holds and never reads the logins itself. To read them now: rig provider status --refresh [--provider codex|claude]";
export declare const str: (v: unknown, fallback?: string) => string;
/** A failure's reason and detail as served, worded as `rig provider status` words them. Both are optional in the read
 *  model: an absent reason reads "no reason given" and an absent detail drops its clause. When both are served, as this
 *  daemon always serves them, the text is "reason (detail)". */
export declare function failureText(f: Row): string;
/** Codex: account, else the workspace account/read reported; Claude: the organisation; else unresolved. */
export declare function identityLabel(id: Row): string;
/** One served allowance row, as served (also drawn per host by System → Usage across hosts). */
export declare function allowanceLines(r: Row): ContentLine[];
/** One served seat account, as served (also drawn per host by System → Usage across hosts). `differsFirst` (only the
 *  all-hosts page passes it) draws a seat's difference under the CLI's condition: whenever one is served, whatever
 *  `windowsSampled` or `withheld` say. Without it the single-host page draws as before. */
export declare function seatLines(r: Row, opts?: {
    differsFirst?: boolean;
}): ContentLine[];
export declare function usageLines(snap: FleetSnapshot, width: number): ContentLine[];
//# sourceMappingURL=usage-model.d.ts.map