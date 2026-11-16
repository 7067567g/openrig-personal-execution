import type { Migration } from "../migrate.js";
/**
 * Slice 09 Rig Policy Primitive (OPR.0.3.2.9) — operator-context-mode
 * binding table.
 *
 * One row per scoped binding:
 *   (scope, qualifier) is a unique key; multiple modes at different
 *   scopes coexist (e.g., sleep@global_host + debug@qitem). The
 *   effective-mode resolver picks the most-specific applicable row
 *   for a (rig, workstream, qitem) read context.
 *
 * Schema follows the workspace-primitive migration pattern: small
 * table, JSON column for the 10-field record (the validator owns
 * its integrity at write time). This matches the typed-primitive
 * precedent the slice IMPL-PRD names (HG-5: no parallel store).
 *
 * `qualifier` is NULL for `scope = 'global_host'` and carries the
 * appropriate id for the other three scopes.
 *
 * `set_at` is a UTC ISO string written by the daemon. The drift
 * mechanism reads this to compute long-gap re-confirmation prompts
 * (v0 ships the field; the numeric threshold is convention Q3
 * follow-on).
 *
 * `set_by` is always `'operator'` in v0 — there is no agent-set path.
 * The column exists so future operator-attribution work (e.g.,
 * multi-operator hosts) can shape per-operator views without a
 * schema migration; v0's validator + route enforce the operator-only
 * contract at the boundary.
 */
export declare const rigPolicySchema: Migration;
//# sourceMappingURL=041_rig_policy.d.ts.map