import { Command } from "commander";
import type { StatusDeps } from "./status.js";
export type SeatDeps = StatusDeps;
export declare function seatCommand(depsOverride?: SeatDeps & {
    readStdin?: () => Promise<string>;
}): Command;
interface HandoverActionOpts {
    source?: string;
    reason?: string;
    operator?: string;
    dryRun?: boolean;
    json?: boolean;
}
/** Shared handover action for both `rig seat handover` and the top-level
 *  `rig handover` verb (OPR.0.4.3.04). Posts to the same daemon route. */
export declare function runSeatHandover(seat: string, opts: HandoverActionOpts, deps: SeatDeps): Promise<void>;
/**
 * OPR.0.4.3.04 — top-level `rig handover <seat>` verb: the operator-facing
 * surface for the full-cycle handover composer. Same route + behavior as
 * `rig seat handover`; hoisted to top-level for discoverability.
 */
export declare function handoverCommand(depsOverride?: SeatDeps): Command;
export {};
//# sourceMappingURL=seat.d.ts.map