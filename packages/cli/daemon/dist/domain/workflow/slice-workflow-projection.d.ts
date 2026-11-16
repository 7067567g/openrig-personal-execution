import type { WorkflowSpec } from "../workflow-types.js";
export interface SpecGraphNode {
    /** step.id (e.g., "discovery"). */
    stepId: string;
    /** Display label = step.role title with id fallback. */
    label: string;
    /** step.actor_role (e.g., "discovery-router"). */
    role: string;
    /** First preferred_target seat for this role, when declared. UI uses
     *  this to compose PL-019 activity indicators on the spec node. */
    preferredTarget: string | null;
    /** True for the spec's entry step (the one workflow_instance starts on). */
    isEntry: boolean;
    /** True when this is the active step on the bound instance. */
    isCurrent: boolean;
    /** True when this step has no next_hop pointing forward (possible terminal). */
    isTerminal: boolean;
}
export interface SpecGraphEdge {
    fromStepId: string;
    toStepId: string;
    /** "direct" only at v1 — Phase D's spec format does not carry
     *  routing_type yet (audit row 6 carve-out). */
    routingType: "direct";
    /** True when this edge is the loop-back edge (target step earlier in
     *  declared order than source). UI uses this to optionally curve the
     *  edge differently from forward edges. */
    isLoopBack: boolean;
}
export interface SpecGraphPayload {
    specName: string;
    specVersion: string;
    nodes: SpecGraphNode[];
    edges: SpecGraphEdge[];
}
export interface PhaseDefinition {
    /** step.id (the canonical phase tag). */
    id: string;
    /** Human label = role title fallback to step.id. */
    label: string;
    role: string;
}
export interface CurrentStepPayload {
    stepId: string;
    role: string;
    objective: string | null;
    /** Phase D's WorkflowStepSpec.allowed_exits enum subset. */
    allowedExits: string[];
    /** Resolved next-step destinations from next_hop.suggested_roles
     *  mapped back to step ids. Empty array when no next_hop or no roles. */
    allowedNextSteps: Array<{
        stepId: string;
        role: string;
        reason: "next_hop";
    }>;
    hopCount: number;
    instanceStatus: string;
}
/**
 * Projects the spec graph for the Topology tab. Nodes are ordered by
 * the spec's declared step order; edges are derived from each step's
 * next_hop.suggested_roles list resolved back to step ids.
 */
export declare function projectSpecGraph(spec: WorkflowSpec, currentStepId: string | null): SpecGraphPayload;
/**
 * Projects the spec's phase definitions. Each step contributes one phase
 * (canonical tag = step.id; label = step.actor_role). The Story tab
 * groups events by phase id when a step trail exists for the event's
 * qitem; events without a trail mapping render in an "untagged" group
 * (the UI decides the literal label).
 */
export declare function projectPhaseDefinitions(spec: WorkflowSpec): PhaseDefinition[];
/**
 * Projects the Current Step payload from the spec + the bound instance's
 * current_step_id. Returns null when current_step_id is null (terminal
 * instance) or doesn't resolve against the spec (instance instantiated
 * against a different spec version that has since changed shape — UI
 * surfaces this as "current step unknown").
 */
export declare function projectCurrentStep(spec: WorkflowSpec, currentStepId: string | null, hopCount: number, instanceStatus: string): CurrentStepPayload | null;
//# sourceMappingURL=slice-workflow-projection.d.ts.map