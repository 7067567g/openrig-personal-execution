import { startTmuxTranscriptCapture } from "./transcript-capture.js";
export class SelfAttachService {
    db;
    rigRepo;
    podRepo;
    sessionRegistry;
    eventBus;
    tmuxAdapter;
    transcriptStore;
    claudeContextProvisioner;
    activityEnv;
    constructor(deps) {
        if (deps.db !== deps.rigRepo.db)
            throw new Error("SelfAttachService: rigRepo must share the same db handle");
        if (deps.db !== deps.podRepo.db)
            throw new Error("SelfAttachService: podRepo must share the same db handle");
        if (deps.db !== deps.sessionRegistry.db)
            throw new Error("SelfAttachService: sessionRegistry must share the same db handle");
        if (deps.db !== deps.eventBus.db)
            throw new Error("SelfAttachService: eventBus must share the same db handle");
        this.db = deps.db;
        this.rigRepo = deps.rigRepo;
        this.podRepo = deps.podRepo;
        this.sessionRegistry = deps.sessionRegistry;
        this.eventBus = deps.eventBus;
        this.tmuxAdapter = deps.tmuxAdapter ?? null;
        this.transcriptStore = deps.transcriptStore ?? null;
        this.activityEnv = deps.activityEnv ?? {};
        this.claudeContextProvisioner = deps.claudeContextProvisioner ?? null;
    }
    async attachToNode(opts) {
        const rig = this.rigRepo.getRig(opts.rigId);
        if (!rig) {
            return { ok: false, code: "rig_not_found", error: "Target rig not found" };
        }
        const node = rig.nodes.find((candidate) => candidate.logicalId === opts.logicalId);
        if (!node) {
            return { ok: false, code: "node_not_found", error: `Logical ID '${opts.logicalId}' does not exist in rig` };
        }
        const existingBinding = this.sessionRegistry.getBindingForNode(node.id);
        if (existingBinding) {
            return { ok: false, code: "already_bound", error: `Logical ID '${opts.logicalId}' is already bound` };
        }
        if (opts.runtime && node.runtime && opts.runtime !== node.runtime) {
            return {
                ok: false,
                code: "runtime_mismatch",
                error: `Logical ID '${opts.logicalId}' expects runtime '${node.runtime}', but attach-self declared '${opts.runtime}'`,
            };
        }
        return this.attachExistingNode({
            rigId: opts.rigId,
            rigName: rig.rig.name,
            nodeId: node.id,
            logicalId: node.logicalId,
            runtime: node.runtime ?? opts.runtime,
            cwd: node.cwd ?? opts.cwd,
            context: this.resolveContext(node.logicalId, rig.rig.name, opts.displayName, opts.context),
        });
    }
    async attachToPod(opts) {
        const rig = this.rigRepo.getRig(opts.rigId);
        if (!rig) {
            return { ok: false, code: "rig_not_found", error: "Target rig not found" };
        }
        const pod = this.podRepo.getPodByNamespace(opts.rigId, opts.podNamespace);
        if (!pod) {
            return { ok: false, code: "pod_not_found", error: `Pod namespace '${opts.podNamespace}' not found in rig` };
        }
        const memberName = opts.memberName.trim();
        if (!memberName) {
            return { ok: false, code: "invalid_member_name", error: "memberName is required" };
        }
        const runtime = opts.runtime.trim();
        if (!runtime) {
            return { ok: false, code: "runtime_required", error: "runtime is required when creating a new pod member" };
        }
        const logicalId = `${pod.namespace}.${memberName}`;
        if (rig.nodes.some((candidate) => candidate.logicalId === logicalId)) {
            return { ok: false, code: "duplicate_logical_id", error: `Logical ID '${logicalId}' already exists in rig` };
        }
        const attachTx = this.db.transaction(() => {
            const node = this.rigRepo.addNode(opts.rigId, logicalId, {
                runtime,
                cwd: opts.cwd,
                podId: pod.id,
            });
            const attached = this.attachExistingNodeWithinTransaction({
                rigId: opts.rigId,
                nodeId: node.id,
                logicalId,
                context: this.resolveContext(logicalId, rig.rig.name, opts.displayName, opts.context),
            });
            return attached;
        });
        try {
            const result = attachTx();
            this.maybeProvisionContextCollector(opts.runtime, opts.cwd, result.sessionName, result.attachmentType);
            await this.maybeStartTranscriptCapture(rig.rig.name, result.sessionName, result.attachmentType);
            this.eventBus.notifySubscribers(result.event);
            return this.toSuccess(result.nodeId, result.logicalId, result.sessionId, result.sessionName, result.attachmentType, runtime);
        }
        catch (error) {
            return { ok: false, code: "duplicate_logical_id", error: error.message };
        }
    }
    async attachExistingNode(args) {
        const attachTx = this.db.transaction(() => this.attachExistingNodeWithinTransaction({
            rigId: args.rigId,
            nodeId: args.nodeId,
            logicalId: args.logicalId,
            context: args.context,
        }));
        try {
            const result = attachTx();
            return this.finalizeAttach(args.rigName, result, args.runtime, args.cwd);
        }
        catch (error) {
            return { ok: false, code: "already_bound", error: error.message };
        }
    }
    async finalizeAttach(rigName, result, runtime, cwd) {
        try {
            this.maybeProvisionContextCollector(runtime, cwd, result.sessionName, result.attachmentType);
            await this.maybeStartTranscriptCapture(rigName, result.sessionName, result.attachmentType);
            this.eventBus.notifySubscribers(result.event);
            return this.toSuccess(result.nodeId, result.logicalId, result.sessionId, result.sessionName, result.attachmentType, runtime);
        }
        catch (error) {
            return { ok: false, code: "already_bound", error: error.message };
        }
    }
    attachExistingNodeWithinTransaction(args) {
        const sessionName = args.context.attachmentType === "tmux"
            ? args.context.tmuxSession
            : args.context.sessionName ?? `unknown-${args.nodeId.slice(-6)}`;
        this.sessionRegistry.updateBinding(args.nodeId, args.context.attachmentType === "tmux"
            ? {
                attachmentType: "tmux",
                tmuxSession: args.context.tmuxSession,
                tmuxWindow: args.context.tmuxWindow,
                tmuxPane: args.context.tmuxPane,
            }
            : {
                attachmentType: "external_cli",
                externalSessionName: sessionName,
            });
        const session = this.sessionRegistry.registerClaimedSession(args.nodeId, sessionName);
        const event = this.eventBus.persistWithinTransaction({
            type: "binding.updated",
            rigId: args.rigId,
            nodeId: args.nodeId,
        });
        return {
            nodeId: args.nodeId,
            logicalId: args.logicalId,
            sessionId: session.id,
            sessionName,
            attachmentType: args.context.attachmentType,
            event,
        };
    }
    resolveContext(logicalId, rigName, displayName, context) {
        if (context?.attachmentType === "tmux") {
            return context;
        }
        const explicit = context?.attachmentType === "external_cli" ? context.sessionName?.trim() : displayName?.trim();
        return {
            attachmentType: "external_cli",
            sessionName: explicit || `${logicalId.replace(/\./g, "-")}@${rigName}`,
        };
    }
    async maybeStartTranscriptCapture(rigName, sessionName, attachmentType) {
        if (attachmentType !== "tmux")
            return;
        await startTmuxTranscriptCapture(this.tmuxAdapter, this.transcriptStore, rigName, sessionName);
    }
    maybeProvisionContextCollector(runtime, cwd, sessionName, attachmentType) {
        if (attachmentType !== "tmux" || runtime !== "claude-code")
            return;
        try {
            this.claudeContextProvisioner?.ensureContextCollector({
                cwd: cwd ?? undefined,
                tmuxSession: sessionName,
            });
        }
        catch { /* best-effort */ }
    }
    toSuccess(nodeId, logicalId, sessionId, sessionName, attachmentType, runtime) {
        // OPR.0.4.3.28 B3 — echo the activity env so the caller's shell (and any
        // agent it starts) produces activity signal: OPENRIG_RUNTIME is required by
        // the relay to build a payload; url+token let it reach the ingest endpoint
        // directly (file-discovery is the fallback when they are absent).
        const env = {
            OPENRIG_NODE_ID: nodeId,
            OPENRIG_SESSION_NAME: sessionName,
        };
        if (runtime)
            env.OPENRIG_RUNTIME = runtime;
        if (this.activityEnv.url)
            env.OPENRIG_URL = this.activityEnv.url;
        if (this.activityEnv.token)
            env.OPENRIG_ACTIVITY_HOOK_TOKEN = this.activityEnv.token;
        return {
            ok: true,
            nodeId,
            logicalId,
            sessionId,
            sessionName,
            attachmentType,
            env,
        };
    }
}
//# sourceMappingURL=self-attach-service.js.map