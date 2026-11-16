import type Database from "better-sqlite3";
import { type SessionRegistry } from "./session-registry.js";
import type { EventBus } from "./event-bus.js";
import type { AgentActivityStore } from "./agent-activity-store.js";
import type { TmuxAdapter } from "../adapters/tmux.js";
import { type NativeProcessLister, type ClaudeResumeRotation } from "./native-process-lineage.js";
type PaneIdentityTmux = Pick<TmuxAdapter, "listPanes" | "getPanePid" | "getPaneCommand">;
export type PaneIdentityReconcileResult = {
    ok: true;
    pane: string;
    pid: number;
    command: string | null;
} | {
    ok: false;
    detail: string;
};
/** Rebind one managed seat to the sole pane currently in its named tmux
 * session and positively identify its declared agent runtime. */
export declare function rebindAndVerifyPaneIdentity(input: {
    db: Database.Database;
    sessionRegistry: SessionRegistry;
    tmux: PaneIdentityTmux;
    nodeId: string;
    sessionName: string;
    runtime: string | null;
    expectedResumeToken?: string | null;
    requireExactResumeLineage?: boolean;
    /** Exact-resume Claude callers only: a recorded rotation into `expectedResumeToken`, accepted in
     *  the same per-process check (`findExactNativeResumeProcess`). */
    resumeRotation?: ClaudeResumeRotation | null;
    listProcesses?: NativeProcessLister;
    /** On a failed process check, read the process table again to say which part failed (default true).
     *  A caller that re-runs the check in a polling loop passes false until the attempt whose text it shows. */
    explainFailure?: boolean;
    now?: () => Date;
}): Promise<PaneIdentityReconcileResult>;
export interface ClearAttentionResult {
    ok: boolean;
    code?: "not_in_attention" | "not_demonstrably_responsive" | "cleared";
    from?: string;
    to?: string;
    clearedBy?: "evidence" | "operator_attestation";
    evidence?: {
        kind: string;
        state?: string;
        reason?: string;
    };
    reason?: string;
    detail?: string;
    previousError?: string | null;
    clearedClasses?: ("startup_status" | "restore_outcome" | "pane_identity")[];
    derivedEvidence?: {
        source: string;
        kind?: string;
        state?: string;
        reason?: string;
        runtimeCwdVerified?: boolean;
        attemptId?: number;
        tmux?: boolean;
        fgProcess?: string;
        resumeTokenUsed?: boolean;
        paneState?: "usable";
    };
}
export interface SendVerifyFn {
    (sessionName: string, text: string, opts?: {
        verify?: boolean;
    }): Promise<{
        ok: boolean;
        outcome?: string;
        verified?: boolean;
    }>;
}
export interface CaptureFn {
    (sessionName: string, opts?: {
        lines?: number;
    }): Promise<{
        ok: boolean;
        sessionName: string;
        content?: string;
        error?: string;
    }>;
}
interface ClearAttentionDeps {
    sessionRegistry: SessionRegistry;
    eventBus: EventBus;
    agentActivityStore: AgentActivityStore;
    sendVerify?: SendVerifyFn;
    capture?: CaptureFn;
    db?: Database.Database;
    tmux?: PaneIdentityTmux;
    listProcesses?: NativeProcessLister;
    reconcileRestoreOutcome?: (rigId: string, nodeId: string) => Promise<{
        ok: true;
        attemptId: number;
        from: "failed" | "attention_required";
        to: "operator_recovered";
        evidence: {
            tmux: boolean;
            fgProcess: string;
            resumeTokenUsed: boolean;
            paneState: "usable";
        };
    } | {
        ok: false;
        code: string;
        detail: string;
    }>;
}
export declare class SeatAttentionReconciler {
    private deps;
    constructor(deps: ClearAttentionDeps);
    clearAttention(sessionName: string, opts?: {
        reason?: string;
    }): Promise<ClearAttentionResult>;
    private performEvidenceClear;
    private findLatestSessionByName;
    private getActiveIdentityVerdict;
    private getDerivedAttentionOutcome;
}
export {};
//# sourceMappingURL=seat-attention-reconciler.d.ts.map