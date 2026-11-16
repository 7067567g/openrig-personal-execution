import type Database from "better-sqlite3";
import type { RigRepository } from "./rig-repository.js";
import type { SessionRegistry } from "./session-registry.js";
import type { TranscriptStore } from "./transcript-store.js";
import { type WhoamiWorkspaceBlock } from "./workspace/workspace-resolver.js";
export interface WhoamiResult {
    resolvedBy: "node_id" | "session_name";
    identity: {
        rigId: string;
        rigName: string;
        nodeId: string;
        logicalId: string;
        attachmentType: "tmux" | "external_cli";
        podId: string | null;
        podNamespace: string | null;
        podLabel: string | null;
        memberId: string;
        memberLabel: string | null;
        sessionName: string | null;
        runtime: string;
        cwd: string | null;
        agentRef: string | null;
        profile: string | null;
        resolvedSpecName: string | null;
        resolvedSpecVersion: string | null;
    };
    peers: Array<{
        logicalId: string;
        sessionName: string | null;
        runtime: string;
        podId: string | null;
        podNamespace: string | null;
        memberId: string;
    }>;
    /**
     * OPR.99.0.6.1 — the peers[] roster contract, stated in-band so a fresh
     * agent cannot misread the field. `peers[]` is the same-rig ROSTER excluding
     * self (no edge/status filter); `edges{}` is the directional graph;
     * `rig ps --nodes` is the node inventory including self + live state.
     * Additive note only — `peers[]` name and shape are unchanged.
     */
    peersNote: string;
    edges: {
        outgoing: Array<{
            kind: string;
            to: {
                logicalId: string;
                sessionName: string | null;
            };
        }>;
        incoming: Array<{
            kind: string;
            from: {
                logicalId: string;
                sessionName: string | null;
            };
        }>;
    };
    transcript: {
        enabled: boolean;
        path: string | null;
        tailCommand: string | null;
        grepCommand: string | null;
    };
    commands: {
        sendExamples: string[];
        captureExamples: string[];
    };
    contextUsage?: import("./types.js").ContextUsage;
    /** PL-012 Token / Context Usage Surface v0 — runtime-specific context
     *  detail surfaced alongside the cross-runtime contextUsage primitive.
     *  Codex: threadId from the stored resume token. Claude Code: resumeToken
     *  + current usage from the context-usage sample. Terminal: null. */
    runtimeContext?: RuntimeContext | null;
    /** PL-007 Workspace Primitive v0 — typed workspace block when the
     *  rig's RigSpec declares one. null when the rig has no workspace
     *  declaration; agents fall back to cwd-only orientation. */
    workspace?: WhoamiWorkspaceBlock | null;
    /** W3 explicit current-seat diagnostic; omitted from ordinary whoami reads. */
    permissionDrift?: import("./permission-drift.js").PermissionDriftDiagnostic | null;
}
export type RuntimeContext = {
    runtime: "codex";
    threadId: string | null;
    conversationId: string | null;
    estimatedTokens: number | null;
    lastSampledAt: string | null;
} | {
    runtime: "claude-code";
    resumeToken: string | null;
    estimatedTokens: number | null;
    lastSampledAt: string | null;
};
export declare class WhoamiAmbiguousError extends Error {
    constructor(message: string);
}
interface WhoamiDeps {
    db: Database.Database;
    rigRepo: RigRepository;
    sessionRegistry: SessionRegistry;
    transcriptStore: TranscriptStore;
    contextUsageStore?: import("./context-usage-store.js").ContextUsageStore;
}
export declare class WhoamiService {
    private db;
    private rigRepo;
    private sessionRegistry;
    private transcriptStore;
    private contextUsageStore;
    constructor(deps: WhoamiDeps);
    resolve(query: {
        nodeId?: string;
        sessionName?: string;
        targetRepoOverride?: string;
        compact?: boolean;
    }): WhoamiResult | null;
    /** PL-012: produce the runtime-specific context block. v0 surfaces
     *  what the daemon already has captured without taking on new pid /
     *  log lookups (those need helper plumbing across the daemon's tmux
     *  adapter). When data isn't available, fields return null honestly
     *  instead of fabricating. Terminal seats: null entire block. */
    private computeRuntimeContext;
    /** resumeToken lives on sessions.resume_token (migration 006).
     *  Read the most-recent session for this node. */
    private latestResumeRow;
    private getCurrentSessionName;
}
export {};
//# sourceMappingURL=whoami-service.d.ts.map