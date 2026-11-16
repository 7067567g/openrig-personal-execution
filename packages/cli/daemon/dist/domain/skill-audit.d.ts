import type { SkillProvenanceEntry } from "./skill-discovery.js";
export interface SkillAuditEntry {
    id: string;
    path: string;
    sourceKind: string;
    sourceRoot: string;
    shadowed: boolean;
    stage: string | null;
    verified: VerifiedStatus;
    contentHash: string;
    state: "active" | "stale" | "legacy" | "exempt";
    owner: string | null;
    sourceRef: string | null;
    /** The installed plugin this copy is byte-identical to, when it is one of OpenRig's bundled skills. */
    bundledFrom: {
        plugin: string;
        version: string;
    } | null;
    findings: AuditFinding[];
}
export type VerifiedStatus = {
    status: "verified";
    date: string;
    source: string;
} | {
    status: "bare_verified";
    date: string;
} | {
    status: "missing_verified";
} | {
    status: "stale_verified";
    date: string;
    source: string;
} | {
    status: "bundled";
    plugin: string;
    version: string;
};
/** One installed plugin's skills directory, with the plugin version that the projected copies came from. */
export interface BundledSkillSource {
    plugin: string;
    version: string;
    skillsDir: string;
}
export interface AuditFinding {
    class: "missing_provenance" | "missing_verified" | "bare_verified" | "stale_verified" | "mirror_drift";
    file: string;
    reason: string;
    remediation: string;
}
/** The installed plugins under pluginsDir (OPENRIG_HOME/plugins) that ship skills. The daemon projects
 *  bundled skills from these directories, so they are the reference for a projected copy's bytes. */
export declare function listBundledSkillSources(pluginsDir: string): BundledSkillSource[];
export interface MirrorDriftResult {
    stale: boolean;
    changes: string[];
}
export interface SkillAuditResult {
    entries: SkillAuditEntry[];
    mirrorDriftFindings: AuditFinding[];
}
export declare function auditSkills(entries: SkillProvenanceEntry[], opts?: {
    mirrorDrift?: MirrorDriftResult;
    bundledSources?: BundledSkillSource[];
}): SkillAuditResult;
//# sourceMappingURL=skill-audit.d.ts.map