import { type MissionReadiness } from "./proof/judgments.js";
import type { WorkflowSpec } from "./workflow-types.js";
export interface LifecycleSourceDigest {
    kind: "project" | "mission" | "slice";
    path: string;
    sha256: string;
}
export interface LifecycleGraphSource {
    mode: "project-profile" | "mission-extend" | "mission-override" | "legacy-mission" | "legacy-slices";
    profileSource: string | null;
    missionSource: string | null;
    requiredSteps: string[];
}
export interface LifecycleCompilation {
    readiness: MissionReadiness;
    version: 1;
    eligible: boolean;
    identity: {
        project: string;
        mission: string;
        lifecycleProfile: string | null;
    };
    operationKeyInput: string | null;
    compiledInputDigest: string;
    sources: LifecycleSourceDigest[];
    dependencies: Array<{
        stepId: string;
        dependsOn: string[];
    }>;
    /** Step id -> the slice directory its packets are tagged with (the Queue tab keys on the directory, which a step id need
     *  not equal). A compiled step maps to its own slice. An authored step maps by name: a slice directory, else a
     *  metadata.id exactly one active slice claims; a step matching neither is absent and carries no slice tag. */
    sliceDirs: Record<string, string>;
    graphSource: LifecycleGraphSource;
    workflowSpec: WorkflowSpec | null;
    advisories: string[];
    unknowns: string[];
}
/**
 * Read and compile project/mission/slice manifests without writing a file,
 * cache row, workflow instance, or qitem.  The generated spec is an output,
 * never a second authored source.
 */
export declare function compileProjectLifecycle(input: {
    missionPath: string;
    operationKey?: string;
}): LifecycleCompilation;
//# sourceMappingURL=project-lifecycle-compiler.d.ts.map