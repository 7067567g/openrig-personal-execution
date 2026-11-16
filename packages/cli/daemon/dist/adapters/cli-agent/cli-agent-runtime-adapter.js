// Shared RuntimeAdapter for CLI agents whose native surface is a headless
// process (OpenCode `run --format json`, DSH `--profile headless --json`).
//
// The adapter launches a pane-hosted cli-agent-runner and treats its sidecar as
// the readiness/resume truth. Legacy runtime adapters remain untouched.
import nodePath from "node:path";
import { randomUUID } from "node:crypto";
import { resolveConcreteHint } from "../../domain/runtime-adapter.js";
import { mergeManagedBlock } from "../../domain/managed-blocks.js";
import { buildCliAgentRunnerCommand, cliAgentSeatPaths, parseCliAgentRunnerState, } from "./cli-agent-runner-protocol.js";
export class CliAgentRuntimeAdapter {
    runtime;
    tmux;
    seatLaunchEnvironment;
    fs;
    runnerEntryPath;
    stateRoot;
    bin;
    model;
    agent;
    profile;
    turnBudget;
    sleep;
    newLaunchId;
    constructor(deps) {
        this.runtime = deps.runtime;
        this.tmux = deps.tmux;
        this.seatLaunchEnvironment = deps.seatLaunchEnvironment;
        this.fs = deps.fsOps;
        this.runnerEntryPath = deps.runnerEntryPath;
        this.stateRoot = deps.stateRoot;
        this.bin = deps.bin;
        this.model = deps.model;
        this.agent = deps.agent;
        this.profile = deps.profile;
        this.turnBudget = deps.turnBudget;
        this.sleep = deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
        this.newLaunchId = deps.newLaunchId ?? (() => randomUUID());
    }
    async listInstalled(binding) {
        if (!binding.tmuxSession)
            return [];
        const state = this.readState(binding.tmuxSession);
        if (!state?.sessionId)
            return [];
        return [{ effectiveId: `${this.runtime}-session`, category: "session", installedPath: state.sessionId }];
    }
    async project(plan, binding) {
        const projected = [];
        const skipped = [];
        const failed = [];
        const warnings = [];
        for (const entry of plan.entries) {
            if (entry.classification === "no_op") {
                skipped.push(entry.effectiveId);
                continue;
            }
            try {
                if (this.projectEntry(entry, binding, warnings))
                    projected.push(entry.effectiveId);
                else
                    skipped.push(entry.effectiveId);
            }
            catch (error) {
                failed.push({ effectiveId: entry.effectiveId, error: error.message });
            }
        }
        return { projected, skipped, failed, ...(warnings.length ? { warnings } : {}) };
    }
    async deliverStartup(files, binding) {
        const warnings = [];
        const failed = [];
        let delivered = 0;
        for (const file of files) {
            try {
                const content = this.fs.readFile(file.absolutePath);
                const hint = file.deliveryHint === "auto" ? resolveConcreteHint(file.path, content) : file.deliveryHint;
                if (hint === "guidance_merge") {
                    if (!this.mergeGuidance(nodePath.join(binding.cwd, "AGENTS.md"), file.path, content, warnings)) {
                        failed.push({ path: file.path, error: "guidance target is reserved" });
                        continue;
                    }
                }
                else if (hint === "skill_install") {
                    this.installSkill(file.absolutePath, binding, nodePath.basename(nodePath.dirname(file.absolutePath)));
                }
                else if (hint === "send_text") {
                    // Never deliver startup prose to the runner's stdin: stdin is the
                    // work channel, so it would start a model turn at launch. Merge it
                    // into AGENTS.md instead, where both OpenCode and DSH can read it.
                    this.mergeGuidance(nodePath.join(binding.cwd, "AGENTS.md"), `startup:${file.path}`, content, warnings);
                }
                delivered += 1;
            }
            catch (error) {
                if (file.required)
                    failed.push({ path: file.path, error: error.message });
            }
        }
        return { delivered, failed, ...(warnings.length ? { warnings } : {}) };
    }
    async launchHarness(binding, opts) {
        if (!binding.tmuxSession)
            return { ok: false, error: `No tmux session bound — cannot launch ${this.runtime}` };
        if (opts.forkSource) {
            return { ok: false, error: `${this.runtime} runtime has no native fork primitive; remove session_source` };
        }
        const launchId = this.newLaunchId();
        const seat = cliAgentSeatPaths(this.stateRoot, binding.tmuxSession);
        this.fs.mkdirp(seat.seatRoot);
        // Restore/relaunch continuity without forcing OpenRig's session ledger to
        // know the runtime-native id yet: reuse the sidecar token ONLY when it was
        // written by this same node. A new rig gets a new node id and must not
        // silently inherit an unrelated old conversation.
        const prior = this.readState(binding.tmuxSession);
        const autoResumeToken = !opts.resumeToken && prior?.nodeId && prior.nodeId === binding.nodeId
            ? prior.sessionId
            : undefined;
        const resumeToken = opts.resumeToken ?? autoResumeToken;
        const pending = {
            ready: false,
            launchId,
            sessionId: resumeToken,
            nodeId: binding.nodeId,
            updatedAt: new Date().toISOString(),
        };
        this.fs.writeFile(seat.runnerStatePath, JSON.stringify(pending));
        const command = buildCliAgentRunnerCommand({
            runtime: this.runtime,
            runnerEntryPath: this.runnerEntryPath,
            sessionName: binding.tmuxSession,
            stateRoot: this.stateRoot,
            cwd: binding.cwd,
            launchId,
            bin: this.bin,
            model: binding.model ?? this.model,
            agent: this.agent,
            resumeToken,
            profile: this.profile,
            // Default off: `undefined` adds no args and the runner keeps its
            // historical one-shot turn (no wall/tool/token accounting, no retry).
            budget: this.turnBudget?.(),
        });
        const wrapped = this.seatLaunchEnvironment
            ? await this.seatLaunchEnvironment.command(binding.tmuxSession, command, {
                nodeId: binding.nodeId,
                generation: binding.launchGeneration,
                runtime: this.runtime,
            })
            : command;
        // OpenRig stages shell commands through a temporary /bin/sh script. Without
        // exec, the pane keeps reporting `sh` as its foreground command even though
        // the runner (a child) is ready, which makes the send guard refuse every
        // message. exec replaces the wrapper so the native runner is observable.
        const launched = /(^|\s)exec\s/.test(wrapped) ? wrapped : `exec ${wrapped}`;
        const sent = await this.tmux.sendShellCommand(binding.tmuxSession, launched);
        if (!sent.ok)
            return { ok: false, error: `Failed to launch ${this.runtime} runner: ${sent.message}` };
        const attempts = 60;
        for (let attempt = 0; attempt < attempts; attempt += 1) {
            const state = this.readState(binding.tmuxSession);
            if (state?.launchId === launchId) {
                if (state.exited)
                    return { ok: false, error: `${this.runtime} runner exited during launch` };
                if (state.ready)
                    return { ok: true, resumeToken, resumeType: resumeToken ? `${this.runtime}_session` : undefined };
            }
            if (attempt < attempts - 1)
                await this.sleep(250);
        }
        return { ok: false, error: `${this.runtime} runner did not become ready within 15s`, recovery: "attention_required" };
    }
    async checkReady(binding) {
        if (!binding.tmuxSession)
            return { ready: false, reason: "No tmux session bound" };
        if (!(await this.tmux.hasSession(binding.tmuxSession)))
            return { ready: false, reason: "tmux session not responsive" };
        const state = this.readState(binding.tmuxSession);
        if (!state)
            return { ready: false, reason: `${this.runtime} runner state missing`, code: "awaiting_runtime" };
        if (state.exited)
            return { ready: false, reason: `${this.runtime} runner exited`, code: "runner_exited" };
        if (!state.ready)
            return { ready: false, reason: `${this.runtime} runner not ready`, code: "awaiting_runtime" };
        // Do NOT reject a pane whose current command is `sh`: OpenRig stages
        // launches through a short-lived /bin/sh wrapper, so the wrapper can still
        // be the pane's foreground command while the runner (its child) is ready.
        // The sidecar is written by the runner itself and records exit, so it is
        // the stronger liveness signal here.
        return { ready: true };
    }
    /** Resume-metadata source for ResumeMetadataRefresher/deriveResumeToken. */
    readSessionFile(sessionName) {
        const seat = cliAgentSeatPaths(this.stateRoot, sessionName);
        if (!this.fs.exists(seat.runnerStatePath))
            return { ok: false, reason: "missing_sidecar" };
        let state;
        try {
            state = parseCliAgentRunnerState(this.fs.readFile(seat.runnerStatePath));
        }
        catch {
            return { ok: false, reason: "parse_error" };
        }
        if (!state)
            return { ok: false, reason: "parse_error" };
        const token = state.sessionId?.trim();
        return token ? { ok: true, sessionFile: token } : { ok: false, reason: "missing_sidecar" };
    }
    readState(sessionName) {
        const seat = cliAgentSeatPaths(this.stateRoot, sessionName);
        if (!this.fs.exists(seat.runnerStatePath))
            return null;
        try {
            return parseCliAgentRunnerState(this.fs.readFile(seat.runnerStatePath));
        }
        catch {
            return null;
        }
    }
    projectEntry(entry, binding, warnings) {
        if (entry.category === "guidance" && entry.mergeStrategy === "managed_block") {
            return this.mergeGuidance(nodePath.join(binding.cwd, "AGENTS.md"), entry.effectiveId, this.fs.readFile(entry.absolutePath), warnings);
        }
        if (entry.category === "skill") {
            this.installSkill(entry.absolutePath, binding, entry.effectiveId);
            return true;
        }
        return false;
    }
    installSkill(sourcePath, binding, effectiveId) {
        // Both native runtimes discover project-level `.agents/skills`.
        // OpenCode additionally reads `.opencode/skills`; use the shared path so a
        // mixed OpenCode/DSH rig gets one deterministic projection target.
        const targetDir = nodePath.join(binding.cwd, ".agents", "skills", effectiveId);
        this.copyPath(sourcePath, targetDir);
    }
    copyPath(sourcePath, targetDir) {
        this.fs.mkdirp(targetDir);
        const children = this.fs.listFiles?.(sourcePath);
        if (children && children.length > 0) {
            for (const child of children) {
                const source = nodePath.join(sourcePath, child);
                const target = nodePath.join(targetDir, child);
                this.fs.mkdirp(nodePath.dirname(target));
                this.fs.writeFile(target, this.fs.readFile(source));
            }
            return;
        }
        this.fs.writeFile(nodePath.join(targetDir, nodePath.basename(sourcePath)), this.fs.readFile(sourcePath));
    }
    mergeGuidance(targetPath, blockId, content, warnings) {
        if (blockId === "rig-role")
            return false;
        mergeManagedBlock(this.fs, targetPath, blockId, content, { warnings });
        return true;
    }
}
//# sourceMappingURL=cli-agent-runtime-adapter.js.map