import { Command } from "commander";
import type { StatusDeps } from "./status.js";
/** Parse a human duration (`90m`, `1h`, `2d`, bare hours `1.5`) into hours.
 *  Returns null on anything unparseable — the caller renders the teaching error. */
export declare function parseWindowToHours(raw: string): number | null;
interface CostPayload {
    seats: Array<Record<string, unknown> & {
        seatSession: string;
        status: string;
    }>;
    note: string;
}
/** A real estimate below a cent prints as "<$0.01", never "$0.00" (which reads as zero); JSON keeps the exact value. */
export declare function formatUsd(value: number): string;
/** Name the estimate's actual provenance. The cost view already carries the
 * runtime and source; never relabel every non-Pi estimate as Claude's. */
export declare function estimateProvenance(seat: Record<string, unknown>): string;
/** One labelled line per seat. Never prints a dollar figure the route didn't report. */
export declare function costLine(seat: CostPayload["seats"][number]): string;
export declare function usageCommand(depsOverride?: StatusDeps): Command;
export {};
//# sourceMappingURL=usage.d.ts.map