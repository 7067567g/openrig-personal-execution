export type RailStatus = "present" | "missing" | "malformed" | "readme-only";
export type FindingSeverity = "high" | "medium" | "low" | "info";
export type FindingKind = "missing_progress" | "registration_ghost" | "missing_id" | "id_convention_violation" | "orphan_progress" | "missing_mission_brief" | "malformed_mission_brief" | "missing_mission_notes" | "missing_proof" | "proof_artifact_c1_invalid" | "missing_impl_prd" | "missing_intent_section" | "mini_requirements_missing_or_malformed" | "proof_contract_missing_or_malformed" | "ui_slice_missing_mockup" | "expired_capability_delta" | "shadowed_node_file";
export interface AuditFinding {
    kind: FindingKind;
    severity: FindingSeverity;
    path: string;
    message: string;
    remediation: string;
}
export interface ScopeAuditInput {
    id: string | null;
    path: string;
    readmeFrontmatterRaw: string | null;
    progressFileExists: boolean;
    readmeOnlyMarker: boolean;
    isActiveRelease: boolean;
    level: "mission" | "slice";
    missionBriefExists?: boolean;
    missionBriefPath?: string;
    missionBriefContent?: string | null;
    missionNotesResolution?: {
        path: string;
        name: "NOTES.md" | "MISSION_NOTES.md";
    } | null;
    missionNotesPath?: string;
    proofFileExists?: boolean;
    proofFilePath?: string;
    proofDirExists?: boolean;
    proofDirPath?: string;
    proofDirHasEntries?: boolean;
    hasProofPacket?: boolean;
    sliceStatus?: string | null;
    proofArtifacts?: Array<{
        path: string;
        frontmatterRaw: string | null;
    }>;
    implementationPrdExists?: boolean;
    nodeFileName?: "SPEC.md" | "README.md";
    readmeContent?: string | null;
    implementationPrdContent?: string | null;
}
export interface ScopeAuditResult {
    railStatus: RailStatus;
    findings: AuditFinding[];
    frontmatterError: string | null;
}
export interface MissionDependencyGraph {
    mission: {
        id: string | null;
        name: string;
        dependsOn: string[];
    };
    nodes: Array<{
        id: string;
        name: string;
        dependsOn: string[];
    }>;
    ready: string[];
    waiting: Array<{
        id: string;
        on: string[];
    }>;
    advisories: Array<{
        id: string;
        dependency?: string;
        kind: "invalid_field" | "invalid_dependency" | "outside_parent" | "missing_sibling" | "missing_id";
        message: string;
    }>;
}
export interface MissionDependencyGraphInput {
    mission: {
        id: string | null;
        name: string;
        dependsOn: unknown;
    };
    slices: Array<{
        id: string | null;
        name: string;
        dependsOn: unknown;
        active: boolean;
    }>;
}
/** Pure advisory graph derivation shared by mission graph and both audit surfaces.
 * Unknown, stale, malformed, and cross-parent edges are reported and ignored:
 * dependency data can steer build order but never gate execution. */
export declare function deriveMissionDependencyGraph(input: MissionDependencyGraphInput): MissionDependencyGraph;
export declare const MISSION_BRIEF_HEADERS: string[];
export declare function classifyScopeItem(input: ScopeAuditInput): ScopeAuditResult;
//# sourceMappingURL=scope-audit.d.ts.map