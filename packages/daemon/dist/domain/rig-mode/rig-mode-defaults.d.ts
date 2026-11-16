import type { AutonomyScope, ConcurrencyLimit, EscalationThreshold, HeartbeatCadence, InspectionDepth, OperatorContextMode, OperatorContextScope, PermissionPromptPosture, UpdateDetail } from "./rig-mode-types.js";
/**
 * The seven per-mode setting defaults (Component 3 §Recommended
 * Per-Mode Defaults). Mirrors the convention table verbatim.
 *
 * `scope` is NOT included here — per-mode default scope lives in
 * RECOMMENDED_DEFAULT_SCOPE below, since the convention treats it
 * separately (Component 4 §Recommended Default Scopes Per Mode).
 *
 * `expiry_or_stale_rule` and `evidence_citation` are not part of the
 * 6×7 matrix; the daemon applies a conservative default for the
 * former (`re_confirm_on_long_gap` — convention Q3 leaves the numeric
 * for Mode 2; the rule kind is the v0 conservative choice) and the
 * latter is operator-provided per invocation.
 */
export interface RecommendedModeDefaults {
    autonomy_scope: AutonomyScope;
    heartbeat_cadence: HeartbeatCadence;
    inspection_depth: InspectionDepth;
    update_detail: UpdateDetail;
    escalation_threshold: EscalationThreshold;
    concurrency_limit: ConcurrencyLimit;
    permission_prompt_posture: PermissionPromptPosture;
}
export declare const RECOMMENDED_MODE_DEFAULTS: Record<OperatorContextMode, RecommendedModeDefaults>;
/**
 * Component 4 — Recommended Default Scopes Per Mode.
 *
 * Used during restate-and-confirm: when the operator's invocation
 * omits an explicit scope, the agent restates with this recommendation
 * and awaits confirmation/correction. The operator's confirmation is
 * authoritative.
 */
export declare const RECOMMENDED_DEFAULT_SCOPE: Record<OperatorContextMode, OperatorContextScope>;
/**
 * Conservative default for `expiry_or_stale_rule`. Per convention Q3,
 * the numeric threshold is deferred to a Mode 2 helper slice;
 * `re_confirm_on_long_gap` is the rule kind selected here as the
 * safest default (it prompts re-confirmation rather than silent
 * continuation when the operator has been away for an extended
 * period).
 *
 * Operators may override per-binding via the `expiry_or_stale_rule`
 * field of the OperatorContextModeRecord; v0 does not auto-tune the
 * threshold.
 */
export declare const DEFAULT_STALE_RULE: "re_confirm_on_long_gap";
//# sourceMappingURL=rig-mode-defaults.d.ts.map