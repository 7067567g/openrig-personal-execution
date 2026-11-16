import type { Migration } from "../migrate.js";
/**
 * OPR.0.7.0.2 (cost reporting, first atom): the context lane of the usage series also keeps the native
 * session a sample belongs to, and Claude's statusline cost estimate for it. The estimate is cumulative per
 * native session, so the session is its window; a drop within one session is a reset. Both are nullable:
 * a lane or runtime that reports no cost stores NULL, never zero.
 */
export declare const usageSamplesClientCostSchema: Migration;
//# sourceMappingURL=105_usage_samples_client_cost.d.ts.map