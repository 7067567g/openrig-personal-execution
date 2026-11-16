import type Database from "better-sqlite3";
import type { RigRepository } from "./rig-repository.js";
import type { EventBus } from "./event-bus.js";
import type { NodeLauncher } from "./node-launcher.js";
import type { PodRigInstantiator } from "./rigspec-instantiator.js";
import type { SessionRegistry } from "./session-registry.js";
import type { ExpansionRequest, ExpansionResult } from "./types.js";
interface RigExpansionServiceDeps {
    db: Database.Database;
    rigRepo: RigRepository;
    eventBus: EventBus;
    nodeLauncher: NodeLauncher;
    podInstantiator: PodRigInstantiator;
    sessionRegistry: SessionRegistry;
}
/**
 * Orchestrates live rig expansion by composing PodRigInstantiator.materialize()
 * for topology persistence and NodeLauncher for launching new nodes.
 */
export declare class RigExpansionService {
    private deps;
    constructor(deps: RigExpansionServiceDeps);
    expand(request: ExpansionRequest): Promise<ExpansionResult>;
    private buildExpansionSpecObject;
}
export {};
//# sourceMappingURL=rig-expansion-service.d.ts.map