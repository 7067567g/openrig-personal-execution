import { type ScopeReadiness, type ProofPolicyRead } from "../proof/judgments.js";
export interface ScopeFsDeps {
    readBytes?: (path: string) => Uint8Array | null;
    exists: (p: string) => boolean;
    readFile: (p: string) => string | null;
    listDir: (p: string) => string[];
    isDirectory: (p: string) => boolean;
}
export interface C1Drop {
    file: string;
    artifactType: string | null;
    verdict: string | null;
    candidateSha: string | null;
    /** Contract-item refs the drop covers: 1-based indices (as strings) or item text. */
    evidences: string[];
    media: string[];
}
export interface ProofContractItem {
    id: string;
    source: {
        file: string;
        line: number;
    };
    index: number;
    text: string;
    /** True iff ≥1 C1 drop cites this item — the ONLY meaning of a ✓ (honest render). */
    paired: boolean;
    drops: Array<{
        file: string;
        artifactType: string | null;
        verdict: string | null;
        media: string[];
    }>;
}
export interface ScopeLocks {
    spec: {
        by: string;
        at: string;
    } | null;
    delivery: {
        by: string;
        at: string;
    } | null;
}
export interface SliceScopeSummary {
    readiness?: ScopeReadiness;
    dirName: string;
    id: string | null;
    displayName: string;
    status: string | null;
    stage: string | null;
    locks: ScopeLocks;
    proof: {
        paired: number;
        total: number;
    };
}
export interface SliceScopeDetail extends SliceScopeSummary {
    intent: string;
    miniRequirements: string[];
    proofContract: ProofContractItem[];
    /** Path to PROGRESS.md for the `n` narrative DISPLAY (never a data source). */
    progressPath: string | null;
    specShaShort: string | null;
    prdExists: boolean;
}
export interface MissionScopes {
    mission: string;
    slices: SliceScopeSummary[];
}
/** `root`: a selected catalog project's root. It bounds the readiness (policy search and scope identity) exactly as
 *  `rig proof` does for that project, so the scopes view and proof agree; without it the nearest project.yaml is used. */
export declare function projectSliceScope(fs: ScopeFsDeps, sliceDir: string, readPolicy?: ProofPolicyRead, root?: string): SliceScopeDetail | null;
export declare function projectMissionScopes(fs: ScopeFsDeps, missionsRoot: string, mission: string, root?: string): MissionScopes | null;
//# sourceMappingURL=scope-view-projection.d.ts.map