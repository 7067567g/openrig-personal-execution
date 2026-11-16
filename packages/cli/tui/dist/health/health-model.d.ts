import { type ContentLine } from "../detail.js";
import type { FleetSnapshot, HealthRecord } from "../types.js";
export type HealthDisplayScope = {
    kind: "instance";
    local: boolean;
} | {
    kind: "rig";
    rigId: string;
    rigName: string;
    local: boolean;
} | {
    kind: "seat";
    rigId: string;
    seatId: string | null;
    seatName: string;
    local: boolean;
};
export declare function healthRecordsForScope(snap: FleetSnapshot, scope: HealthDisplayScope): HealthRecord[];
export declare function healthSummaryLine(snap: FleetSnapshot, scope: HealthDisplayScope, width: number): ContentLine;
export declare function healthListLines(snap: FleetSnapshot, scope: HealthDisplayScope, width: number): ContentLine[];
export declare function healthDetailLines(snap: FleetSnapshot, findingId: string, width: number, timeZone?: string): ContentLine[];
export declare function healthAgentLines(snap: FleetSnapshot, scope: Extract<HealthDisplayScope, {
    kind: "seat";
}>, width: number): ContentLine[];
//# sourceMappingURL=health-model.d.ts.map