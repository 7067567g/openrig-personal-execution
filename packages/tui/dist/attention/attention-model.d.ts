import type { AttentionRead } from "@openrig-local/daemon/attention";
import type { FleetSnapshot, ViewState } from "../types.js";
import { type ContentLine } from "../detail.js";
/** The bounded, confirmed-delivery projection served by S02; no client classification. */
export interface DeliveredHumanUpdates {
    items: Array<{
        qitemId: string;
        summary: string | null;
        body: string;
        humanDetail: string | null;
        destinationSession: string;
        sourceSession: string;
        tags: string[] | null;
        evidenceRef: string | null;
        deliveredAt: string;
        deliveryReceipt: string;
    }>;
    limit: number;
    truncated: boolean;
}
export declare function composeHumanUpdates(attention: AttentionRead | null, updates: DeliveredHumanUpdates | null, wanted?: string | null): AttentionRead | null;
export declare function attentionLines(state: ViewState, snap: FleetSnapshot, width: number): ContentLine[];
//# sourceMappingURL=attention-model.d.ts.map