import { SpecReviewService } from "./spec-review-service.js";
export interface SpecLibraryEntry {
    id: string;
    kind: "rig" | "agent" | "workflow";
    name: string;
    version: string;
    sourceType: "builtin" | "user_file";
    sourcePath: string;
    relativePath: string;
    updatedAt: string;
    summary?: string;
    hasServices?: boolean;
    /** Workflows in Spec Library v0 — workflow-only metadata (kind === "workflow"). */
    isBuiltIn?: boolean;
    rolesCount?: number;
    stepsCount?: number;
    terminalTurnRule?: string;
    targetRig?: string | null;
    /** Slice 11 (workflow-spec-folder-discovery) — diagnostic state for
     *  workflow entries surfaced from the folder scan. "error" rows came
     *  from malformed YAML and carry the parse/validate reason in
     *  errorMessage so the Library UI can render a diagnostic row. */
    status?: "valid" | "error";
    errorMessage?: string | null;
}
export interface SpecLibraryOpts {
    roots: Array<{
        path: string;
        sourceType: "builtin" | "user_file";
    }>;
    specReviewService: SpecReviewService;
}
export type SpecLibraryMutationResult = {
    ok: true;
    entry: SpecLibraryEntry;
} | {
    ok: false;
    code: "not_found" | "read_only" | "conflict" | "invalid_spec";
    error: string;
};
export declare class SpecLibraryService {
    private entries;
    /** Workflow entries are written by the route layer via
     *  setWorkflowEntries() — kept separate from the rig+agent scan
     *  because their source-of-truth is the workflow_specs SQLite cache,
     *  not YAML files on disk. */
    private workflowEntries;
    private readonly roots;
    private readonly specReviewService;
    constructor(opts: SpecLibraryOpts);
    scan(): void;
    list(filter?: {
        kind?: "rig" | "agent" | "workflow";
    }): SpecLibraryEntry[];
    /** Workflows in Spec Library v0: replace the workflow-entry projection
     *  in one shot. Called by the route layer after running
     *  scanWorkflowSpecs() against the workflow_specs SQLite cache. */
    setWorkflowEntries(entries: SpecLibraryEntry[]): void;
    get(id: string): {
        entry: SpecLibraryEntry;
        yaml: string;
    } | null;
    remove(id: string): SpecLibraryMutationResult;
    rename(id: string, newName: string): SpecLibraryMutationResult;
    private classifySpec;
}
//# sourceMappingURL=spec-library-service.d.ts.map