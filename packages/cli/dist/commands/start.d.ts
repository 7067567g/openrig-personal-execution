import { Command } from "commander";
import type { StatusDeps } from "./status.js";
interface PlanPreviewNode {
    logicalId: string;
    intendedAction: string;
    reason?: string;
    tokenState?: "present" | "missing" | "stale" | "unverified";
    provenance?: string | null;
    lastVerified?: string | null;
    freshRequired?: boolean;
    runtimePrompt?: string;
}
interface PlanPreviewResponse {
    status: string;
    mode: string;
    rigId: string;
    rigName: string;
    snapshot: {
        id: string;
        kind: string;
        createdAt: string;
    } | null;
    wouldCaptureCurrentState: boolean;
    nodes: PlanPreviewNode[];
    mutated: boolean;
}
export interface StartCandidate {
    rigId: string;
    rigName: string;
    lifecycleState: string;
    nodeCount: number;
    lastActivity: string | null;
    preview: PlanPreviewResponse | null;
    /** What the seats say about the last stop; read only under `--last`, where `down` is kept down. */
    lastStop: LastStopState | null;
}
/**
 * `down`: at least one seat was launched and every launched seat carries the recorded stop
 * intent (`intentionallyStopped`, set by `rig down` and `rig seat stop`).
 * `was_running`: anything else, including a plain `exited` without the intent, a seat the boot
 * reconciler marked `detached` when tmux was lost, and a daemon that does not report the intent.
 * `unknown`: the seat statuses could not be read.
 */
export type LastStopState = "was_running" | "down" | "unknown";
export declare function lastStopState(nodes: unknown): LastStopState;
export interface StartDeps extends StatusDeps {
    promptYesNo?: (question: string) => Promise<boolean>;
    /** Test seam (mirrors upCommand's): inject the preflight exec so auto-start tests
     *  never run real system commands. */
    preflightExec?: (cmd: string) => Promise<string>;
}
export declare function startCommand(depsOverride?: StartDeps): Command;
export {};
//# sourceMappingURL=start.d.ts.map