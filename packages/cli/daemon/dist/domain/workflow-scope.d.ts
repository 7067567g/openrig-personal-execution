import type Database from "better-sqlite3";
export interface WorkflowScope {
    project?: string;
    mission?: string;
    slice?: string;
    /** Free-form tags, scope-key tags (project:/mission:/slice:) excluded. */
    tags?: string[];
    /** Lifecycle instances: step id -> slice directory name, the slice a step's packets belong to.
     *  The Queue tab keys on the directory name, which is not always the step id. */
    stepSlices?: Record<string, string>;
}
export declare class WorkflowScopeError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export declare function normalizeWorkflowScope(input: {
    project?: unknown;
    mission?: unknown;
    slice?: unknown;
    tags?: unknown;
    stepSlices?: Record<string, string>;
}): WorkflowScope | null;
/** The tags stamped on a packet: scope keys first (project, mission, slice), free-form tags after.
 *  `stepSlice` supplies the slice when the scope names none (a lifecycle step). */
export declare function workflowScopeTags(scope: WorkflowScope | null | undefined, stepSlice?: string | null): string[];
/** The tags for a packet of `stepId`. A lifecycle step that is a slice carries its slice directory name; a step that
 *  matches no active slice (an authored closing step, one a revision adds) carries project and mission only. */
export declare function packetScopeTags(instance: {
    scope?: WorkflowScope | null;
}, stepId: string | null | undefined): string[];
export declare const isProjectId: (value: string) => boolean;
export declare const isNodeId: (value: string) => boolean;
/** The scope of a compiled lifecycle instance. Project and mission are identities the compiler inferred from the
 *  manifests, not user input, so one that cannot be a tag is left out (and reported) rather than refused. */
export declare function lifecycleScope(identity: {
    project: string;
    mission: string;
}, stepSlices: Record<string, string>): WorkflowScope | null;
/** Advisories for inferred identities and slice directories that cannot be written as a packet tag. */
export declare function lifecycleScopeAdvisories(identity: {
    project: string;
    mission: string;
}): string[];
/** Read an instance's scope straight from the row (for code that holds only the db).
 *  Fixture databases that skip the canonical migrations have no scope column and read as unscoped. Anything else that
 *  fails (the column probe, the query, malformed scope_json) propagates, as it does on the store's read path. */
export declare function readInstanceScope(db: Database.Database, instanceId: string): {
    scope: WorkflowScope | null;
};
//# sourceMappingURL=workflow-scope.d.ts.map