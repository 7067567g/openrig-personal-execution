import type { CodexAuthMetadata } from "./codex-auth-reader.js";
import type { FourBlockReadModel, ProviderSignal } from "./provider-types.js";
import type { NodeLifecycleState } from "../types.js";
/** One seat in the fleet (the universe to bind), sourced from node-inventory across rigs. */
export interface ProviderSeat {
    seatSession: string;
    rigName: string;
    runtime: string;
    lifecycleState: NodeLifecycleState;
}
export interface ProviderCollectDeps {
    /** Reads codex-auth on-disk METADATA (profile names + seat registry) — never token content. */
    readCodexAuth: () => CodexAuthMetadata;
    /** The current seat universe (node-inventory across all rigs). */
    listSeats: () => ProviderSeat[];
    /** signals[] — empty until the live Codex/Claude/reactive collection lane is wired. */
    collectSignals?: () => ProviderSignal[];
    /** A real caller-provided clock; the read model's asOf (anomalies borrow it, never invented). */
    now: () => string;
}
export declare function collectFourBlockReadModel(deps: ProviderCollectDeps): FourBlockReadModel;
//# sourceMappingURL=provider-collect.d.ts.map