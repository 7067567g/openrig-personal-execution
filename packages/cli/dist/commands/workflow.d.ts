import { Command } from "commander";
import type { StatusDeps } from "./status.js";
/**
 * `rig workflow` — daemon-native Workflow Runtime (PL-004 Phase D).
 *
 * Backed by `/api/workflow`. Operates only via the daemon HTTP API.
 *
 * Per PRD § L4 Workflow Runtime: workflow specs are markdown/YAML
 * authoritative, daemon caches a read-through copy. Owner-as-author
 * + workflow-as-transactional-scribe: owner closure + next-qitem
 * projection happen in the SAME daemon transaction. Lost handoffs
 * are impossible by design.
 */
export interface WorkflowDeps extends StatusDeps {
}
export interface OutcomeSummary {
    what: string;
    state: string;
    next: string;
}
export declare const PROJECT_EXIT_KINDS: readonly ["handoff", "waiting", "done", "failed"];
export type ProjectExitKind = (typeof PROJECT_EXIT_KINDS)[number];
export declare function isProjectExitKind(value: unknown): value is ProjectExitKind;
export declare function printOutcomeSummary(json: boolean, status: number, summary: OutcomeSummary | null): void;
export declare function printWorkflowAdvisories(advisories: string[] | undefined): void;
export declare function workflowCommand(depsOverride?: WorkflowDeps): Command;
//# sourceMappingURL=workflow.d.ts.map