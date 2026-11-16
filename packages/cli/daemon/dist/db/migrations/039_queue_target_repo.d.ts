import type { Migration } from "../migrate.js";
/**
 * PL-007 Workspace Primitive v0 — queue_items.target_repo column.
 *
 * Adds `target_repo TEXT` to the queue_items table. Carries the
 * per-item typed repo scope when an operator passes
 * `rigx queue create --target-repo <name>` etc. Validated at the
 * route layer against the source rig's RigSpec.workspace.repos[].
 * NULL when the qitem is unambiguous against the rig's default_repo
 * or when no workspace is declared. Mission Control views surface
 * the field for cross-rig handoff clarity.
 *
 * Companion to migration 038 which adds rigs.workspace_json.
 */
export declare const queueTargetRepoSchema: Migration;
//# sourceMappingURL=039_queue_target_repo.d.ts.map