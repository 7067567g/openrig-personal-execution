import type { RigRepository } from "./rig-repository.js";
import type { SessionRegistry } from "./session-registry.js";
import type { PodRepository } from "./pod-repository.js";
import type { LegacyRigSpec, RigSpec } from "./types.js";
interface RigSpecExporterDeps {
    rigRepo: RigRepository;
    sessionRegistry: SessionRegistry;
    podRepo?: PodRepository;
}
export declare class RigSpecExporter {
    readonly db: import("better-sqlite3").Database;
    private rigRepo;
    private sessionRegistry;
    private podRepo;
    constructor(deps: RigSpecExporterDeps);
    exportRig(rigId: string): LegacyRigSpec | RigSpec;
    private exportLegacy;
    private exportPodAware;
}
export {};
//# sourceMappingURL=rigspec-exporter.d.ts.map