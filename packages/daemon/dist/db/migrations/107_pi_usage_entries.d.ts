import type { Migration } from "../migrate.js";
/**
 * OPR.0.7.0.2 (cost reporting, Pi atom): one row per usage-bearing entry Pi has PERSISTED in a session, keyed by
 * the Pi session id and the entry id, so a replay, catch-up or restart that returns the entry again stores
 * nothing new. `origin` keeps a fork's or branch's copied entries ("inherited") apart from the occupant's own
 * spend; "unknown" when the session header couldn't be read. `cost_total` is Pi's model-priced estimate and
 * stays NULL when the entry carried no cost (absent, never zero).
 */
export declare const piUsageEntriesSchema: Migration;
//# sourceMappingURL=107_pi_usage_entries.d.ts.map