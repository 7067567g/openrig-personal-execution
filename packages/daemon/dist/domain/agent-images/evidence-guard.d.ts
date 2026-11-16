import type { AgentImageEntry } from "./agent-image-types.js";
export type ProtectionReason = "pinned" | "referenced_by_agent_spec" | "referenced_by_rig_spec" | "lineage_descendant_of_protected";
export interface ImageProtectionStatus {
    imageId: string;
    imageName: string;
    imageVersion: string;
    protected: boolean;
    reasons: ProtectionReason[];
    /** Specific filesystem paths that hold the protective references. */
    references: string[];
}
export interface EvidenceGuardOpts {
    /** All images in the library (so lineage-based protection can
     *  traverse the chain without re-walking discovery roots). */
    images: readonly AgentImageEntry[];
    /** Spec-library directories to walk for active references. Each is
     *  walked recursively for `*.yaml` / `*.yml` files. */
    specRoots: readonly string[];
}
/**
 * Compute protection status for every image. The result is parallel to
 * the input array order; the protected image set is what `prune` MUST
 * skip unless --force is supplied.
 */
export declare function evaluateProtection(opts: EvidenceGuardOpts): ImageProtectionStatus[];
//# sourceMappingURL=evidence-guard.d.ts.map