import type { DiscoveredSession } from "./discovery-types.js";
export interface DraftResult {
    yaml: string;
    warnings: string[];
}
export declare function generateDraftRig(sessions: DiscoveredSession[]): DraftResult;
//# sourceMappingURL=draft-rig-generator.d.ts.map