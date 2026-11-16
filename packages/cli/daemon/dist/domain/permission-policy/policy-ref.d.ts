import type { LaunchPosture, PolicySurface } from "./policy-spec.js";
/** The packaged read-only built-in policy set (README v4: 3 Policy-Mode specs + Operator/YOLO). */
export declare const BUILTIN_POLICY_NAMES: readonly ["locked", "standard", "open", "yolo", "auto"];
export type BuiltinPolicyName = (typeof BUILTIN_POLICY_NAMES)[number];
/** deliberate_none: the ruled amendment 5f37e40f — the recorded choice; never file-backed. */
export type PolicyRefOrigin = "builtin" | "custom" | "deliberate_none";
export interface ResolvedPolicyRef {
    /** The ref string, preserved verbatim (travels with the spec through the state). */
    ref: string;
    origin: PolicyRefOrigin;
    /** Present when origin === "builtin": the validated built-in name. */
    builtinName?: BuiltinPolicyName;
}
/**
 * Validate + classify a permission_policy REF. Returns a STRUCTURED error string for an invalid ref
 * (an invalid ref is a spec DEFECT, never a silent floor fallback), or null when valid. ABSENT is the
 * caller's concern (only pass a present value here). `label` prefixes the error for the surfacing
 * layer (matches the RigSpec validate convention, e.g. "permission_policy" / "pods[0].members[1].
 * permission_policy").
 */
export declare function validatePermissionPolicyRef(value: unknown, label: string): string | null;
/**
 * Classify a VALID ref (call validatePermissionPolicyRef first). Preserves + surfaces origin, never
 * silently reclassifies (origin honesty). Never throws on a validated ref.
 */
export declare function classifyPermissionPolicyRef(value: string): ResolvedPolicyRef;
/**
 * A restart-stable resolved attachment (dev-guard early ruling, 2026-08-04): persisting only the raw
 * relative ref is NOT restart-complete. We carry the raw `ref` (for export truth + later skill apply)
 * PLUS `resolvedTarget` (canonical package identifier for built-ins; the absolute resolved path for
 * custom) + `declaringDir` (custom) + `origin`, so a restore can reopen/validate the custom policy
 * and re-derive surface + launch_posture without the original in-memory RigSpec.
 */
export interface ResolvedPolicyAttachment {
    /** Raw ref, preserved verbatim for export + skill apply. */
    ref: string;
    origin: PolicyRefOrigin;
    /** origin=builtin: the validated built-in name. */
    builtinName?: BuiltinPolicyName;
    /** custom: the absolute resolved path. builtin: the canonical shipped package-copy path once the
     * packaging leg rules it (PM lane c76c7153) — ABSENT until then; NEVER a `builtin:<name>` echo of
     * the raw ref (dev-guard correction 2: the ref is persisted separately for export; duplicating it
     * here is not restart-stable provenance). */
    resolvedTarget?: string;
    /** origin=custom: the canonical (absolute) declaring RigSpec directory — restart-stable provenance. */
    declaringDir?: string;
    /** The resolved policy surface, when content was resolvable (custom) or known (built-in). */
    surface?: PolicySurface;
    /** Flag-surface launch posture for per-seat binding (floor | full_bypass). */
    launchPosture: LaunchPosture;
    /** Guard round-2 (8232199a): TRUE only when custom CONTENT resolution genuinely
     *  succeeded with USABLE semantics — parse OK + known surface + (flag ⇒ a valid
     *  launch_posture). Restore trusts a re-derivation ONLY when this is true; otherwise
     *  the PERSISTED posture carries. Builtins: always true (name-derived semantics). */
    contentResolved: boolean;
}
/** Injected reader so resolution is testable + does not hard-couple the module to fs. Throws when
 *  the target is missing/unreadable (resolver treats that as an advisory floor, provenance kept). */
export interface PolicyResolveDeps {
    readFile: (absolutePath: string) => string;
}
/**
 * The SINGLE mapping point for the built-in policies' canonical shipped package-copy path —
 * PM-RULED (inline ruling via dev-guard NOT-CLEAR at 9e94c274, lane c76c7153):
 *   repo source (future):   packages/daemon/policies/builtin/<name>.policy.md
 *   provenance target:      policies/builtin/<name>.policy.md  (package-relative;
 *                           module-relative at runtime)
 * The raw `builtin:<name>` ref stays separate (export truth); this target is the restart-
 * stable provenance. Built-in CONTENT stays a later leg — no asset read or copy here.
 */
export declare function builtinPackageTarget(name: BuiltinPolicyName): string;
/**
 * Resolve a VALIDATED, present ref (call validatePermissionPolicyRef first) into a restart-stable
 * attachment. `declaringDir` is the canonical directory of the RigSpec that declared the ref (custom
 * refs resolve relative to it — README v4 A2). Flag-surface CONTENT resolution is CORE-owned (guard
 * ruling): a custom `surface: flag` policy's `launch_posture` (floor|full_bypass) is read here.
 *   - built-in: name-derived posture bounded to the locked set (yolo → full_bypass, else floor);
 *     origin + canonical `builtin:<name>` target preserved. Package ASSET existence is a later leg.
 *   - custom: resolve relative to declaringDir, read + parse (Seam A), derive surface; flag →
 *     its launch_posture; config → floor (config-surface CONTENT application is deferred to the
 *     skill; no config write here). Unreadable/invalid → advisory floor, provenance still preserved.
 */
/**
 * The single mapping point for built-in policy launch posture:
 * yolo -> full_bypass, auto -> auto, everything else -> floor.
 */
export declare function builtinLaunchPosture(nameOrRef: string): LaunchPosture;
export declare function resolvePermissionPolicyAttachment(ref: string, declaringDir: string, deps: PolicyResolveDeps): ResolvedPolicyAttachment;
/**
 * Precedence: a per-member ref overrides the rig-level ref; absence at both is undefined (= floor).
 * member > rig > floor (README v4 + IMPL-PLAN). No pod level exists in the spec surface.
 */
export declare function resolvePermissionPolicyRefValue(memberRef: string | null | undefined, rigRef: string | null | undefined): string | undefined;
//# sourceMappingURL=policy-ref.d.ts.map