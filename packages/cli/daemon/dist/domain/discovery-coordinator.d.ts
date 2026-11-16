import type { TmuxDiscoveryScanner } from "./tmux-discovery-scanner.js";
import type { SessionFingerprinter } from "./session-fingerprinter.js";
import type { SessionEnricher } from "./session-enricher.js";
import type { DiscoveryRepository } from "./discovery-repository.js";
import type { SessionRegistry } from "./session-registry.js";
import type { EventBus } from "./event-bus.js";
import type { DiscoveredSession } from "./discovery-types.js";
interface DiscoveryCoordinatorDeps {
    scanner: TmuxDiscoveryScanner;
    fingerprinter: SessionFingerprinter;
    enricher: SessionEnricher;
    discoveryRepo: DiscoveryRepository;
    sessionRegistry: SessionRegistry;
    eventBus: EventBus;
}
/**
 * Orchestrates the full discovery pipeline:
 * scan → filter managed → fingerprint → enrich → persist → vanish detection → events
 */
export declare class DiscoveryCoordinator {
    private deps;
    constructor(deps: DiscoveryCoordinatorDeps);
    /** Run a single discovery scan cycle. */
    scanOnce(): Promise<DiscoveredSession[]>;
    private getManagedBindings;
}
export {};
//# sourceMappingURL=discovery-coordinator.d.ts.map