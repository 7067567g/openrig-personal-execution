import type { Migration } from "../migrate.js";
/**
 * S06 Waves 1-3: additive lifecycle replay identity plus packet-addressed
 * frontier and failure state.  Every new instance column is nullable so a
 * pre-lifecycle row remains byte-for-byte meaningful to the legacy reader.
 */
export declare const workflowLifecycleParallelSchema: Migration;
//# sourceMappingURL=079_workflow_lifecycle_parallel.d.ts.map