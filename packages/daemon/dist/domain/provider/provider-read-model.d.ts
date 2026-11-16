import type { FourBlockReadModel, ProviderAccount, ProviderSignal } from "./provider-types.js";
/**
 * A collected seat↔account fact — a discriminated bound/unbound union over the honest field
 * set (no anomalies; the assembler computes those). Mirrors ProviderBinding so the collector
 * never has to fabricate account/binding data for an unbound seat.
 */
export type RawSeatBinding = {
    accountId: string;
    seatSession: string;
    rigName: string;
    boundAt: string;
    bindingSource: string;
} | {
    accountId: null;
    seatSession: string;
    rigName: string;
    boundAt: null;
    bindingSource: null;
};
export interface AssembleInput {
    accounts: ProviderAccount[];
    rawBindings: RawSeatBinding[];
    signals: ProviderSignal[];
    /** The read model's asOf — a real caller-provided timestamp; anomalies borrow it (not invented). */
    asOf: string;
}
export declare function assembleFourBlock(input: AssembleInput): FourBlockReadModel;
//# sourceMappingURL=provider-read-model.d.ts.map