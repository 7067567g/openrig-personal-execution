import type { ScopeFsDeps } from "../scope/scope-view-projection.js";
/** Addressed Markdown owns judgments. These views are rebuilt, never written upstream. */
export type JudgmentVerdict = "accept" | "reject" | "withdraw";
export interface Evidence {
    ref: string;
    sha256: string;
}
export interface Judgment {
    version: 1;
    sequence: number;
    scope: string;
    id: string;
    operationId: string;
    itemId: string;
    itemRevision: string;
    policyRevision: string;
    policySource: string;
    previous: string | null;
    actor: string;
    provenance: string;
    at: string;
    verdict: JudgmentVerdict;
    reason: string;
    evidence: Evidence[];
    subject: {
        kind: "artifact" | "commit" | "patch-equivalent";
        ref: string;
        comparison?: string;
    };
    intent: string;
}
export interface ItemReadiness {
    id: string;
    text: string;
    revision: string;
    index: number;
    source: {
        file: string;
        line: number;
    };
    state: "accepted" | "pending" | "rejected" | "withdrawn" | "unknown";
    reason: string;
    judgment: Judgment | null;
}
export interface ScopeReadiness {
    configured: boolean;
    revision: string;
    state: "ready" | "not-ready" | "unknown" | "legacy";
    history: Array<{
        ref: string;
        id: string;
        itemId: string;
        verdict: JudgmentVerdict;
        previous: string | null;
    }>;
    items: ItemReadiness[];
    issues: string[];
    policy: {
        judges: string[];
        source: string;
        revision: string;
    } | null;
    /** Input for S04 attention consumers; no timer or delivery is implied. */
    attention: {
        scope: string;
        revision: string;
    };
}
export interface MissionReadiness {
    revision: string;
    state: ScopeReadiness["state"];
    issues: string[];
    slices: Array<{
        scope: string;
        id: string;
        readiness: ScopeReadiness;
        dependsOn: string[];
        eligible: boolean | null;
    }>;
    historicalStatus: string | null;
}
export declare class JudgmentError extends Error {
    code: string;
    status: number;
    constructor(code: string, message: string, status?: number);
}
export declare const proofFs: ScopeFsDeps;
/** The owning authored project, shared by readiness and lifecycle compilation.
 * Mission storage need not be the default one-level `missions` directory. */
export declare function resolveProjectRoot(dir: string): string;
export type ProofPolicyRead = (dir: string, io: ScopeFsDeps, root?: string) => ScopeReadiness["policy"];
/** One synchronous read composition owns this reader, then discards it. Only
 * policy manifest inputs (including absence) are reused, by absolute path and
 * exact I/O provider. Never retain across requests or pass through a mutation.
 * Parsed objects stay private; policyOf returns fresh policy/judges each time.
 * Errors still throw with their original source. This is not an atomic snapshot. */
export declare function createProofPolicyRead(): ProofPolicyRead;
export declare function readProofContract(dir: string, io: ScopeFsDeps): {
    index: number;
    source: {
        file: string;
        line: number;
    };
    id: string;
    text: string;
}[];
export declare function evidenceAt(root: string, dir: string, ref: string): Evidence;
/** `root` (a selected catalog project's root) bounds the policy search and the scope identity; without it they derive
 *  from the nearest project.yaml, as for the selected workspace. */
export declare function readSliceReadiness(dir: string, io?: ScopeFsDeps, readPolicy?: ProofPolicyRead, root?: string): ScopeReadiness;
export declare function resolveProofScope(root: string, scope: string): string;
export interface JudgeInput {
    scope: string;
    item: string;
    verdict: JudgmentVerdict;
    evidence?: string[];
    subject?: Judgment["subject"];
    expectedEvidence?: Evidence[];
    reason: string;
    expectedRevision: string;
    expectedPrevious: string | null;
    operationId?: string;
    replace?: boolean;
}
/**
 * Records a verifiable proof judgment for a slice item into the judgments ledger.
 *
 * @param missionsRoot - Workspace root path for resolving scopes.
 * @param input - Judgment details including scope, item, verdict, and evidence.
 * @param actor - Identifier of the judging actor authorized under the proof policy.
 * @param provenance - Attestation provenance string recorded in the ledger.
 * @returns Recorded judgment receipt, current slice readiness, and replay status.
 */
/** `projectRoot` (the selected catalog project's root) is the boundary for evidence containment, the policy search and
 *  the recorded scope identity. Without it the nearest project.yaml is used, which for a catalog project without its own
 *  manifest would be an ANCESTOR, i.e. another project (CWE-22). */
export declare function recordJudgment(missionsRoot: string, input: JudgeInput, actor: string, provenance: string, projectRoot?: string): {
    judgment: Judgment;
    readiness: ScopeReadiness;
    replayed: boolean;
};
/**
 * Evaluates readiness for a mission by reading its composition and resolving member slices.
 *
 * @param missionDir - Path to the mission directory containing mission.yaml.
 * @param readPolicy - Reader function for determining applicable proof policy.
 * @returns Evaluated mission readiness, including revision, state, slices, and any issues.
 */
export declare function readMissionReadiness(missionDir: string, readPolicy?: ProofPolicyRead, root?: string): MissionReadiness;
export declare function readProjectReadiness(missionsRoot: string, readPolicy?: ProofPolicyRead, root?: string): {
    revision: string;
    state: string;
    missions: {
        revision: string;
        state: ScopeReadiness["state"];
        issues: string[];
        slices: Array<{
            scope: string;
            id: string;
            readiness: ScopeReadiness;
            dependsOn: string[];
            eligible: boolean | null;
        }>;
        historicalStatus: string | null;
        name: string;
    }[];
    basis: string;
};
//# sourceMappingURL=judgments.d.ts.map