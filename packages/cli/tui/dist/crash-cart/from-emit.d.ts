import type { DaemonState, DaemonUnverifiedEvidence } from "./contract.js";
import { type CrashCartDiscoveryInput, type CrashCartModel } from "./crash-cart-model.js";
import type { RestoreLifecycleVM } from "./restore-lifecycle.js";
/** The `rig crash-cart --json` payload (mirrors the daemon verb's emit — the documented JSON contract). */
export interface CrashCartEmit {
    state: DaemonState;
    evidence?: DaemonUnverifiedEvidence;
    discovery?: CrashCartDiscoveryInput;
    refusal?: string;
}
/** The daemon-down subset of RenderOptions the TUI feeds renderScreen (empty ⇒ normal fleet views). */
export interface CrashCartRenderOpts {
    unavailable?: string;
    unavailableExpanded?: boolean;
    starting?: string;
    daemonState?: DaemonState;
    crashCart?: CrashCartModel;
    daemonEvidence?: DaemonUnverifiedEvidence;
    /** B1 ROUND 2 — the live fleet-restore lifecycle surface (progress while running, rollup + triage
     *  when done). Set by main.ts as the operator-owned lifecycle polls; takes precedence over the
     *  cockpit while present, so the operator sees progress and the triage list rather than a bare refresh. */
    restore?: RestoreLifecycleVM;
    /** B1 ROUND 10 — the ⏎ confirm banner (non-zero-generation restore). Rendered IN the cockpit where the
     *  operator looks; ViewState.notice is NOT rendered in the daemon-down cockpit, so the confirm was
     *  invisible (first ⏎ appeared to do nothing). Present ⇔ pendingRestoreConfirm. */
    confirm?: string;
}
/** A refusal is an unavailable read, never an empty instance. */
export declare function crashCartRenderOpts(emit: CrashCartEmit): CrashCartRenderOpts;
/**
 * Run the public read. Failure is visible and does not authorize recovery effects.
 */
export declare function probeCrashCart(runVerb: () => Promise<string>): Promise<CrashCartRenderOpts>;
//# sourceMappingURL=from-emit.d.ts.map