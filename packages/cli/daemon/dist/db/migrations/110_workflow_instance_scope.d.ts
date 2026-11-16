import type { Migration } from "../migrate.js";
/**
 * Workflow instance scope: the project / mission / slice (and free-form tags) an
 * instance works for, as JSON `{project?, mission?, slice?, tags?}`. Stamped on
 * every packet the instance creates so the Projects view lists them on the
 * slice's Queue tab. Nullable: existing rows stay NULL and project unscoped
 * packets exactly as before.
 */
export declare const workflowInstanceScopeSchema: Migration;
//# sourceMappingURL=110_workflow_instance_scope.d.ts.map