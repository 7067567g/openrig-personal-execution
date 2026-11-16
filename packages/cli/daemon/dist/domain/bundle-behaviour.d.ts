import { type PackageDigest } from "./bundle-identity.js";
type ObjectValue = Record<string, unknown>;
type SourceRef = {
    path: string;
    field?: string;
};
type Resolution = "archive" | "host_at_launch" | "unresolved";
type Assembler = {
    openrigVersion: string;
    commit?: string;
};
export interface BehaviourIdentity {
    source: ObjectValue | null;
    configurationId: string | null;
    packageDigest: PackageDigest | null;
    assembler: Assembler | null;
    generator: Assembler;
    compatibility?: ObjectValue;
    statedProvenance?: ObjectValue;
    integrity: {
        digestValid: boolean;
        filesVerified: boolean;
    };
}
interface FileFact {
    seat?: string;
    kind: string;
    pathOrRef: string;
    resolution: Resolution;
    sourceRefs: SourceRef[];
    delivery?: string;
    trigger?: string;
}
interface WriteFact {
    seat?: string;
    kind: string;
    destinationBase: string;
    path: string;
    operation: string;
    phase: string;
    condition?: string;
    sourceRefs: SourceRef[];
}
interface GeneratedBehaviour {
    schema: "openrig.bundle-behaviour/v1";
    state: "generated";
    identity: BehaviourIdentity;
    team: Array<{
        seat: string;
        pod: string;
        member: string;
        agentRef: string;
        profile: string;
        runtime: string;
        model?: string;
        cwd: string;
    }>;
    posture: Array<{
        seat: string;
        shellAccess: string;
        selection: string;
        basis: "explicit" | "product_default" | "unresolved";
        permissionPrompts?: "off" | "on" | "default";
        firstRunWarnings?: {
            claudeBypass: "harness_asks_once";
        };
        nonInterruptive?: "available";
        nonInterruptiveDefault?: boolean;
        nativeEffect: "unknown";
        sourceRefs: SourceRef[];
    }>;
    toldFiles: FileFact[];
    alsoRuns: FileFact[];
    writes: WriteFact[];
    outsideAddresses: Array<{
        domain: string;
        sourceRefs: SourceRef[];
    }>;
    needs: Array<{
        seat?: string;
        kind: string;
        name: string;
        commands?: string[];
        versionConstraint?: string;
        status: "not_checked";
        sourceRefs: SourceRef[];
    }>;
    unknownBeforeLaunch: Array<{
        seat?: string;
        subject: string;
        reason: string;
        sourceRefs: SourceRef[];
    }>;
}
export type BundleBehaviour = GeneratedBehaviour | {
    schema: "openrig.bundle-behaviour/v1";
    state: "not_generated";
    identity: BehaviourIdentity;
    reason: string;
    localInspectCommand: string;
};
export interface DescribeBundleInput {
    /** Only regular members of the inspected archive. No host filesystem reader. */
    files: ReadonlyMap<string, string>;
    manifest: ObjectValue;
    generator: Assembler;
    digestValid: boolean;
    filesVerified: boolean;
    /** Binary, oversized or unreadable members omitted by the inspection wrapper. */
    omittedFiles?: string[];
    source?: ObjectValue | null;
    configurationId?: string | null;
    assembler?: Assembler | null;
}
/** Read archive declarations only. This function has no process, filesystem, network or database dependency. */
export declare function describeBundleBehaviour(input: DescribeBundleInput): BundleBehaviour;
export {};
//# sourceMappingURL=bundle-behaviour.d.ts.map