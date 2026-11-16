// PL-004 Phase D: Workflow Runtime shared types.
//
// Reverse-engineered from POC `workflow-runtime-v0/lib/workflow-runtime.rb`
// and POC fixture YAMLs (`workflow-runtime-v0/tests/fixtures/*.yaml`).
//
// Phase D scope is the v1 minimum: spec parsing, instance creation,
// step projection, append-only step trail. Multi-hop chaining +
// gate-return-sweep + complex routing tables are graduations
// (per PRD § Risks "Workflow runtime over-engineered").
/** OPR.0.4.6.WF2 FR-1: the closed v1 branch-key set — exactly the recorded
 *  exit enum. Growth ONLY via the step-declared-outcome-enums rail (PRD §6
 *  named deferral); never free-text, identity, or opaque evidence JSON. */
export const WORKFLOW_EXIT_KINDS = ["handoff", "waiting", "done", "failed"];
/** OPR.0.4.6.WF2 FR-2: the pinnable harness value space — AGENT harnesses
 *  only. `terminal` is deliberately excluded (a terminal node is not an
 *  agent harness); Pi Agent joins in 0.4.7 as a value-space extension. */
export const WORKFLOW_AGENT_HARNESSES = ["claude-code", "codex", "opencode", "dsh"];
/** OPR.0.4.6.WF5 FR-2: the maturity-dial position value space (closed).
 *  `orchestrator` = the item routes to the declared orchestrator role's
 *  resolved seat (the v1.3 founder default); `human_only` = the item
 *  routes to the human seat FIRST and gates there (the orchestrator
 *  never auto-acts). */
export const WORKFLOW_EXCEPTION_DIAL_POSITIONS = ["orchestrator", "human_only"];
//# sourceMappingURL=workflow-types.js.map