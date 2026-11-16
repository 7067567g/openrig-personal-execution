import type { Migration } from "../migrate.js";
/** A saved legacy mode and an operating posture (human-led/delegated) can be kept at the same scope and qualifier:
 *  the uniqueness moves from (scope, qualifier) to (scope, qualifier, category). Rows are not touched. */
export declare const modePostureCoexistSchema: Migration;
//# sourceMappingURL=109_mode_posture_coexist.d.ts.map