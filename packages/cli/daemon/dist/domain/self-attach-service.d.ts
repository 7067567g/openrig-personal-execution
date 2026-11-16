import type Database from "better-sqlite3";
import type { RigRepository } from "./rig-repository.js";
import type { PodRepository } from "./pod-repository.js";
import type { SessionRegistry } from "./session-registry.js";
import type { EventBus } from "./event-bus.js";
import type { TmuxAdapter } from "../adapters/tmux.js";
import type { TranscriptStore } from "./transcript-store.js";
export type SelfAttachSuccess = {
    ok: true;
    nodeId: string;
    logicalId: string;
    sessionId: string;
    sessionName: string;
    attachmentType: "tmux" | "external_cli";
    env: {
        OPENRIG_NODE_ID: string;
        OPENRIG_SESSION_NAME: string;
        OPENRIG_RUNTIME?: string;
        OPENRIG_URL?: string;
        OPENRIG_ACTIVITY_HOOK_TOKEN?: string;
    };
};
export type SelfAttachFailureCode = "rig_not_found" | "node_not_found" | "pod_not_found" | "already_bound" | "duplicate_logical_id" | "invalid_member_name" | "runtime_required" | "runtime_mismatch";
export type SelfAttachResult = SelfAttachSuccess | {
    ok: false;
    code: SelfAttachFailureCode;
    error: string;
};
interface SelfAttachServiceDeps {
    db: Database.Database;
    rigRepo: RigRepository;
    podRepo: PodRepository;
    sessionRegistry: SessionRegistry;
    eventBus: EventBus;
    tmuxAdapter?: TmuxAdapter;
    transcriptStore?: TranscriptStore;
    claudeContextProvisioner?: {
        ensureContextCollector(binding: {
            cwd?: string | null;
            tmuxSession?: string | null;
        }): void;
    };
    activityEnv?: {
        url?: string;
        token?: string;
    };
}
interface AttachToNodeOptions {
    rigId: string;
    logicalId: string;
    runtime?: string;
    cwd?: string;
    displayName?: string;
    context?: SelfAttachContext;
}
interface AttachToPodOptions {
    rigId: string;
    podNamespace: string;
    memberName: string;
    runtime: string;
    cwd?: string;
    displayName?: string;
    context?: SelfAttachContext;
}
interface ExternalCliAttachContext {
    attachmentType: "external_cli";
    sessionName?: string;
}
interface TmuxAttachContext {
    attachmentType: "tmux";
    tmuxSession: string;
    tmuxWindow?: string;
    tmuxPane?: string;
}
export type SelfAttachContext = ExternalCliAttachContext | TmuxAttachContext;
export declare class SelfAttachService {
    readonly db: Database.Database;
    private rigRepo;
    private podRepo;
    private sessionRegistry;
    private eventBus;
    private tmuxAdapter;
    private transcriptStore;
    private claudeContextProvisioner;
    private activityEnv;
    constructor(deps: SelfAttachServiceDeps);
    attachToNode(opts: AttachToNodeOptions): Promise<SelfAttachResult>;
    attachToPod(opts: AttachToPodOptions): Promise<SelfAttachResult>;
    private attachExistingNode;
    private finalizeAttach;
    private attachExistingNodeWithinTransaction;
    private resolveContext;
    private maybeStartTranscriptCapture;
    private maybeProvisionContextCollector;
    private toSuccess;
}
export {};
//# sourceMappingURL=self-attach-service.d.ts.map