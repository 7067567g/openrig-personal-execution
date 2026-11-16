import type { StartupBlock, StartupAction, StartupProofSelection } from "./types.js";
export interface StartupLayerInputs {
    specStartup: StartupBlock;
    profileStartup?: StartupBlock;
    rigCultureFile?: string;
    rigStartup?: StartupBlock;
    podStartup?: StartupBlock;
    memberStartup?: StartupBlock;
    operatorStartup?: StartupBlock;
}
/**
 * Build effective startup in fixed additive order:
 * 1. Agent base startup
 * 2. Profile startup
 * 3. Rig culture file (synthetic StartupFile)
 * 4. Rig startup overlays
 * 5. Pod shared startup
 * 6. Member startup overlays
 * 7. Operator debug append (always last)
 *
 * Files and actions are concatenated in order. No deduplication —
 * adapters handle replay tolerance per the startup contract.
 *
 * @param inputs - all startup sources
 * @returns merged StartupBlock
 */
export declare function resolveStartup(inputs: StartupLayerInputs): StartupBlock;
/** Last applicable authored selection wins; omission adds no exercise. */
export declare function resolveStartupProof(actions: StartupAction[], context: "fresh_start" | "restore"): StartupProofSelection;
//# sourceMappingURL=startup-resolver.d.ts.map