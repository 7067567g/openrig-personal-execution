import type { DaemonState, DaemonUnverifiedEvidence } from "./crash-cart-detect.js";
import type { CrashCartDiscovery } from "./crash-cart-discovery.js";
/** The verb's JSON payload. Exactly one of {evidence | discovery | refusal} accompanies the state
 *  (up → none; unverified → evidence; down → discovery, or refusal if the read fail-closed). */
export interface CrashCartEmit {
    state: DaemonState;
    evidence?: DaemonUnverifiedEvidence;
    discovery?: CrashCartDiscovery;
    refusal?: string;
}
export interface EmitCrashCartDeps {
    /** Resolve the 3-state verdict (bounded-retry detector). */
    resolveState: () => Promise<DaemonState>;
    /** Assemble the UNVERIFIED evidence (pid state + last probe). */
    assembleEvidence: () => Promise<DaemonUnverifiedEvidence>;
    /** Run the C2 daemon-down read (loadCrashCartDiscovery) VERBATIM; may fail-closed (throws). */
    loadDiscovery: () => Promise<CrashCartDiscovery>;
}
/** Assemble the verb's verdict. UP → state only; UNVERIFIED → state + evidence (no read); DOWN → the
 *  read's discovery, or a structured refusal note if the read fail-closed. */
export declare function emitCrashCartState(deps: EmitCrashCartDeps): Promise<CrashCartEmit>;
//# sourceMappingURL=crash-cart-emit.d.ts.map