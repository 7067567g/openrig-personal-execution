// Slice 09 — Rig Policy Primitive (OPR.0.3.2.9).
//
// Typed graduation of the operator-context-mode-system v0 doctrine. The
// convention at conventions/operator-context-mode-system/README.md is
// the legacy spec; S07 adds deliberate operating posture and project/mission scopes.
// Types remain closed enums + a 10-field
// schema. None of these fields may be silently merged or dropped — the
// validator enforces field-set integrity.
//
// GATE-ZERO (HG-SAFE): this primitive is permission-ADJACENT but NEVER
// permission-modifying. `permission_prompt_posture` is a descriptive
// operator-set ergonomic hint. The enum below is STRUCTURALLY
// incapable of expressing auto-accept: there is no auto-accept member
// in the union, and the validator further rejects unknown values. Any
// future contributor who tries to add an auto-accept value here MUST
// also amend the permission-posture convention + safety policy in the
// FROZEN contract — review will reject otherwise.
export const OPERATOR_CONTEXT_MODES = [
    "sleep",
    "desk",
    "mobile",
    "away",
    "focus",
    "debug",
    "human-led",
    "delegated",
];
export const OPERATOR_CONTEXT_SCOPES = [
    "global_host",
    "rig",
    "project",
    "mission",
    "workstream",
    "qitem",
];
/**
 * Scope specificity ranks; higher number = more specific. Used by the
 * store's effective-mode resolver. NOT operator-facing.
 */
export const SCOPE_SPECIFICITY = {
    global_host: 0,
    rig: 1,
    project: 2,
    mission: 3,
    workstream: 4,
    qitem: 5,
};
export const SAFE_PERMISSION_PROMPT_POSTURES = [
    "normal",
    "batch_for_human",
    "do_not_prompt_unless_blocked",
];
export const STALE_RULES = [
    "none",
    "re_confirm_on_long_gap",
    "re_confirm_on_day_boundary",
    "re_confirm_on_observed_conflict",
];
/** Mission IDs are project-qualified; identical mission names never share a binding. */
export function missionModeQualifier(projectId, missionId) {
    return `${projectId}/${missionId}`;
}
//# sourceMappingURL=rig-mode-types.js.map