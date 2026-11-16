import { type ContentLine } from "../detail.js";
import type { CostBody, CostRead } from "./cost-read.js";
type Seat = CostBody["seats"][number];
export declare const COST_HEADER = "this host's daemon only \u00B7 not fleet-wide \u00B7 what each harness reports, not an invoice";
export declare const COST_READ_HINT = "This view reads what the daemon already holds and starts no lookup. The same lines: rig usage cost";
/** A real amount below a cent prints as "<$0.01", never "$0.00" (which reads as zero). As `rig usage cost` prints it. */
export declare function formatUsd(value: number): string;
/** The line `rig usage cost` prints for this seat. */
export declare function costHeadLine(seat: Seat): string;
export declare function costLines(read: CostRead | undefined, width: number): ContentLine[];
export {};
//# sourceMappingURL=cost-model.d.ts.map