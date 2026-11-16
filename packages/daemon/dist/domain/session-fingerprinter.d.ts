import type { CmuxAdapter } from "../adapters/cmux.js";
import type { TmuxAdapter } from "../adapters/tmux.js";
import type { ScannedPane } from "./tmux-discovery-scanner.js";
import type { RuntimeHint, Confidence } from "./discovery-types.js";
/** Evidence collected during fingerprinting */
export interface FingerprintEvidence {
    layerUsed: number;
    cmuxSignal?: {
        runtime: string;
        pid: number;
    };
    processSignal?: {
        command: string;
        matched: string;
    };
    paneContentSignal?: {
        pattern: string;
        matchedLine: string;
    };
    configSignal?: {
        claudeDir: boolean;
        agentsDir: boolean;
    };
}
/** Result of fingerprinting a single pane */
export interface FingerprintResult {
    runtimeHint: RuntimeHint;
    confidence: Confidence;
    evidence: FingerprintEvidence;
}
/**
 * Four-layer runtime detection pipeline.
 * Layer 0: cmux agent PID (highest confidence)
 * Layer 1: Process tree / active command (high)
 * Layer 2: Pane content heuristics (medium)
 * Layer 3: CWD/config context (low-medium, boost only)
 */
export declare class SessionFingerprinter {
    private cmux;
    private tmux;
    private fsExists;
    private cachedAgentPIDs;
    constructor(deps: {
        cmuxAdapter: CmuxAdapter;
        tmuxAdapter: TmuxAdapter;
        fsExists: (path: string) => boolean;
    });
    /** Pre-fetch cmux agent PIDs for batch use. Call before fingerprinting multiple panes. */
    refreshCmuxSignals(): Promise<void>;
    /** Fingerprint a single scanned pane. */
    fingerprint(pane: ScannedPane): Promise<FingerprintResult>;
}
//# sourceMappingURL=session-fingerprinter.d.ts.map