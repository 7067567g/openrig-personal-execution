import type { Migration } from "../migrate.js";
/** Non-secret launch environment a rig spec declares: `env:` at rig level (rigs.env_json) and at
 *  member level (nodes.env_json), stored as a JSON object of NAME -> value. NULL = none declared.
 *  The two stay separate so a launch merges them (member over rig) and an export round-trips both. */
export declare const seatEnvSchema: Migration;
//# sourceMappingURL=111_seat_env.d.ts.map