import type { WorkflowExceptionClass } from "./workflow-exception.js";
import type { WorkflowExceptionDialPosition, WorkflowSpec } from "./workflow-types.js";
import { type WorkflowHumanDestination } from "./workflow-human-destination.js";
/** The ordinary workflow-packet tier (the shipped default the attention
 *  union deliberately does NOT match on). */
export declare const WORKFLOW_EXCEPTION_ORCHESTRATOR_TIER = "mode2";
/** The human-routed tier — the attention union's first leg. */
export declare const WORKFLOW_EXCEPTION_HUMAN_TIER = "human-gate";
export interface ExceptionRouteInput {
    exceptionClass: WorkflowExceptionClass;
    spec: Pick<WorkflowSpec, "exception_routing" | "roles">;
    /** The host-level dial default (settings `workflow.exception_routing`),
     *  read by the caller; null = key unset. */
    hostDialDefault: WorkflowExceptionDialPosition | null;
    /** The shipped role→preferred_targets resolution, wrapped by the caller
     *  (workflow-runtime owns runtime matching). null = unresolvable. */
    resolveRoleTarget: (roleName: string) => string | null;
    /** Lazy: a valid agent route must not require human configuration. */
    humanFallbackSeat?: WorkflowHumanDestination;
}
export interface ExceptionRoute {
    /** Where the chain landed. `fallback` = orchestrator position whose
     *  role target did not resolve. */
    position: "orchestrator" | "human_only" | "fallback";
    destinationSession: string;
    /** THE TIER SPLIT — human-gate iff humanRouted. */
    tier: string;
    humanRouted: boolean;
    /** Which chain link decided the position (recorded in item evidence —
     *  the dial walks assert it). */
    resolvedVia: "class-intrinsic" | "class-declared" | "workflow-declared" | "host-default" | "engine-default";
}
export declare function exceptionPolicy(input: Pick<ExceptionRouteInput, "exceptionClass" | "spec" | "hostDialDefault">): Pick<ExceptionRoute, "resolvedVia"> & {
    position: WorkflowExceptionDialPosition;
};
export declare function resolveExceptionRoute(input: ExceptionRouteInput): ExceptionRoute;
//# sourceMappingURL=workflow-exception-router.d.ts.map