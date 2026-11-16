/** OPR.0.4.8.3 Seam B: a seat's RESOLVED permission-policy posture. When present it is
 *  authoritative for that seat and overrides the OPENRIG_YOLO env read in BOTH directions
 *  (an attached builtin:locked keeps the floor even under global YOLO; an attached custom
 *  full_bypass flag policy lifts the seat without the env switch). Absent = no policy
 *  attached → the env decision stands (0.4.8.2 behavior, unchanged). */
export type ResolvedLaunchPosture = "floor" | "full_bypass" | "auto";
export declare function yoloEnabled(env?: NodeJS.ProcessEnv, resolvedPosture?: ResolvedLaunchPosture): boolean;
/** Claude launch posture flag: floor `--permission-mode acceptEdits`, or the full bypass
 *  (global YOLO, or a per-seat resolved full_bypass policy attachment). */
export declare function claudePostureFlag(env?: NodeJS.ProcessEnv, resolvedPosture?: ResolvedLaunchPosture, permissionMode?: string): string;
/**
 * Codex launch posture segment (leading space included), applied on EVERY managed Codex path
 * (fresh / resume / native-fork). `profileArg` is the already-formatted ` -p <profile>` string or "".
 * - YOLO ON → ` -s danger-full-access` (maximally-permissive sandbox), overriding even a named profile.
 * - OFF + named profile → the profile (it governs its own sandbox).
 * - OFF + no profile → OpenRig's explicit workspace-only floor ` -s workspace-write`.
 * Explicit resolved full_bypass selects both sandbox and approval behavior. The legacy
 * environment-only YOLO path remains sandbox-only; unselected defaults are unchanged.
 */
export declare function codexPostureArg(profileArg: string, env?: NodeJS.ProcessEnv, resolvedPosture?: ResolvedLaunchPosture): string;
/** Pi RESOURCE TRUST (Pi's --approve/--no-approve govern resource trust, NOT a permission policy):
 *  YOLO forces `approve`; otherwise the configured posture (default `no-approve`). */
export declare function piTrust(configured: "approve" | "no-approve" | undefined, env?: NodeJS.ProcessEnv, resolvedPosture?: ResolvedLaunchPosture): "approve" | "no-approve";
/**
 * OPR.0.5.3.1 — Claude classic-renderer launch env prefix.
 *
 * Claude Code's fullscreen renderer draws to the terminal ALTERNATE screen, which
 * emits no scrollback — so tmux capture-pane stores nothing and `rig transcript`
 * goes thin. Launching with CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN=1 forces the
 * classic renderer and restores native scrollback (and same-pane handover
 * scroll-preservation). Applied on EVERY managed Claude launch path (fresh /
 * resume / fork / restore) so behaviour is uniform, never path-dependent —
 * mirroring the claudePostureFlag pattern.
 *
 * Default ON. Config override: set OPENRIG_CLAUDE_DISABLE_ALTERNATE_SCREEN=0 (or
 * "false") to opt back into the fullscreen renderer (knowingly forgoing scrollback).
 *
 * Returns a command PREFIX ("VAR=1 ", trailing space) to prepend to the `claude`
 * launch command, or "" when disabled (then the command is byte-identical to pre-OPR.0.5.3.1).
 */
export declare function claudeClassicRendererEnvPrefix(env?: NodeJS.ProcessEnv): string;
//# sourceMappingURL=yolo-mode.d.ts.map