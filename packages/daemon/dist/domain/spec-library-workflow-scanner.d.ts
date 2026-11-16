import type Database from "better-sqlite3";
import type { WorkflowExitKind, WorkflowAgentHarness, WorkflowGateSpec } from "./workflow-types.js";
import { type WorkflowSpecCache } from "./workflow-spec-cache.js";
import type { EventBus } from "./event-bus.js";
export interface SpecLibraryWorkflowEntry {
    id: string;
    kind: "workflow";
    name: string;
    version: string;
    /** "builtin" when source_path is under workflowBuiltinSpecsDir; else "user_file". */
    sourceType: "builtin" | "user_file";
    sourcePath: string;
    relativePath: string;
    updatedAt: string;
    summary?: string;
    /** True iff sourcePath is under the daemon's bundled built-in dir. */
    isBuiltIn: boolean;
    /** Cheap counts surfaced in the row summary line. */
    rolesCount: number;
    stepsCount: number;
    terminalTurnRule: string;
    targetRig: string | null;
    /**
     * Slice 11 (workflow-spec-folder-discovery) — diagnostic state.
     * "valid" rows have parsed payload and are operable.
     * "error" rows came from a malformed YAML in the workflows folder
     * scan; Library UI renders them with error styling and surfaces
     * the errorMessage so the operator can fix the file in place.
     */
    status: "valid" | "error";
    /** Populated only when status === "error" — concrete parse/validate diagnostic. */
    errorMessage: string | null;
}
export interface SpecLibraryWorkflowReview {
    kind: "workflow";
    name: string;
    version: string;
    purpose: string | null;
    targetRig: string | null;
    terminalTurnRule: string;
    rolesCount: number;
    stepsCount: number;
    isBuiltIn: boolean;
    sourcePath: string;
    cachedAt: string;
    /** Topology graph projection: nodes from `roles`, edges derived from
     *  each step's next_hop.suggested_roles → next-step ids. Same shape
     *  Slice Story View v1 uses for its Topology tab — consumers reuse
     *  the same UI primitives for rendering.
     *
     *  OPR.0.4.6.WF4 Q1 (arch-ruled): the projection ADDS branch edges
     *  from `next_hop.on` (routingType 'branch' + the triggering exit),
     *  corrects the false-terminal defect (a step with on-targets is not
     *  terminal), and projects optional harness/host/gate node fields —
     *  all byte-identity-by-omission: a suggested-roles-only spec with no
     *  on/harness/host/gate projects EXACTLY as before (no 'branch' edge,
     *  no branchOn key, no optional node key). */
    topology: {
        nodes: Array<{
            stepId: string;
            role: string;
            objective: string | null;
            preferredTarget: string | null;
            isEntry: boolean;
            isTerminal: boolean;
            /** OPR.0.4.6.WF4 Q1-P1 — OMITTED when the step declares none. */
            harness?: WorkflowAgentHarness;
            host?: string;
            gate?: WorkflowGateSpec;
        }>;
        edges: Array<{
            fromStepId: string;
            toStepId: string;
            /** OPR.0.4.6.WF4 Q1-P2 — closed-vocabulary extension of 'direct'. */
            routingType: "direct" | "branch";
            /** The triggering exit; present on 'branch' edges ONLY. */
            branchOn?: WorkflowExitKind;
        }>;
    };
    /** Per-step list rendered below the graph. */
    steps: Array<{
        stepId: string;
        role: string;
        objective: string | null;
        allowedExits: string[];
        /** Resolved destinations from next_hop.suggested_roles → step ids. */
        allowedNextSteps: Array<{
            stepId: string;
            role: string;
        }>;
    }>;
}
export interface ScanWorkflowSpecsOpts {
    db: Database.Database;
    /** Absolute path to the daemon's bundled builtin starter dir;
     *  null/undefined → no isBuiltIn detection (all rows render as user_file). */
    workflowBuiltinSpecsDir: string | null;
}
export declare function scanWorkflowSpecs(opts: ScanWorkflowSpecsOpts): SpecLibraryWorkflowEntry[];
export declare function getWorkflowReview(opts: ScanWorkflowSpecsOpts & {
    name: string;
    version: string;
}): SpecLibraryWorkflowReview | null;
export declare function workflowLibraryId(name: string, version: string): string;
export declare function parseWorkflowLibraryId(id: string): {
    name: string;
    version: string;
} | null;
export interface ScanWorkflowSpecFolderOpts {
    /** SQLite handle (used for direct lookups). */
    db: Database.Database;
    /** Cache handle for readThrough / writeDiagnostic / removeBySourcePath. */
    cache: WorkflowSpecCache;
    /** Absolute path to the workspace's workflows folder
     *  (typically `<workspace.specs_root>/workflows`). Missing folder
     *  → empty scan summary; not an error. */
    folder: string;
    /** Daemon's bundled builtin starter dir; used to skip removal logic
     *  for built-in rows (the scanner only owns the folder it walks). */
    builtinDir: string | null;
    /** Optional EventBus — when wired, the scanner emits a
     *  workflow_spec.removed audit event for each cache row removed because
     *  its source file disappeared (OQ-4 acceptance: deletion + audit log).
     *  Omitted in unit tests that don't care about emission. */
    eventBus?: EventBus;
}
export interface ScanWorkflowSpecFolderResult {
    /** Total YAML/YML files found in folder. */
    scanned: number;
    /** Files parsed + cached successfully on this scan. */
    valid: number;
    /** Files that failed parse/validate; recorded as diagnostic rows. */
    errors: number;
    /** Cache rows removed because their source_path no longer exists. */
    removed: number;
    /** Files skipped via mtime check (unchanged since last scan). */
    skipped: number;
}
export declare function scanWorkflowSpecFolder(opts: ScanWorkflowSpecFolderOpts): ScanWorkflowSpecFolderResult;
//# sourceMappingURL=spec-library-workflow-scanner.d.ts.map