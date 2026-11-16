import { type LoadResult } from "./gateway/human-registry.js";
export declare class WorkflowHumanDestinationError extends Error {
    readonly details: {
        state: string;
        [key: string]: unknown;
    };
    readonly code = "workflow_human_destination_unavailable";
    constructor(details: {
        state: string;
        [key: string]: unknown;
    }, message: string);
}
/** The existing operator selection, resolved afresh only when a human is needed. */
export declare function resolveWorkflowHumanDestination(configured?: () => unknown, registry?: () => LoadResult): string;
/** Explicit injected destinations remain available to embedders and isolated fixtures. */
export type WorkflowHumanDestination = string | (() => string);
export declare function workflowHumanDestination(selection?: WorkflowHumanDestination): string;
//# sourceMappingURL=workflow-human-destination.d.ts.map