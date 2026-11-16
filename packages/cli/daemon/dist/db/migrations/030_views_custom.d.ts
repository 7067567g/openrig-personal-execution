import type { Migration } from "../migrate.js";
/**
 * Custom views (PL-004 Phase B; L5 View — custom-view registration table).
 *
 * Per PRD § L5: built-in views (`recently-active`, `founder`, `pod-load`,
 * `escalations`, `held`, `activity`) are HARDCODED in view-projector.ts.
 * Operator-defined custom views are stored in this table and registered at
 * daemon startup from `~/.openrig/views.yaml` (or via API at runtime).
 *
 * Built-in views are NOT inserted into this table — view-projector.ts
 * exposes them by name without DB lookup. Custom views are looked up here
 * when the operator queries `rig view show <custom-name>`.
 */
export declare const viewsCustomSchema: Migration;
//# sourceMappingURL=030_views_custom.d.ts.map