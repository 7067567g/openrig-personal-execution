import { isShellForeground } from "../domain/shell-classifier.js";
import { isAgentAppRuntime, loadAgentAppPreset, agentAppsDir } from "../domain/agent-app-presets.js";
import { agentAppOf } from "../domain/built-in-runtimes.js";
/**
 * A community agent app, launched from its installed preset (`domain/agent-app-presets.ts`). It types the preset's
 * command into the seat's pane and is ready while the pane runs something other than a shell. That's readiness, not
 * identity: a process alone doesn't prove which session it is. It projects nothing, and refuses resume and fork,
 * which a launch-only preset doesn't support.
 */
export class AgentAppRuntimeAdapter {
    runtime;
    deps;
    constructor(runtime, deps) {
        this.runtime = runtime;
        this.deps = deps;
    }
    async listInstalled(_binding) {
        return [];
    }
    async project(plan, _binding) {
        const skipped = plan.entries.map(entry => entry.effectiveId);
        return {
            projected: [], skipped, failed: [],
            ...(skipped.length ? { warnings: [`Agent app "${this.runtime}" places no resources; ${skipped.length} not placed: ${skipped.join(", ")}`] } : {}),
        };
    }
    async deliverStartup(files, _binding) {
        return {
            delivered: 0, failed: [],
            ...(files.length ? { warnings: [`Agent app "${this.runtime}" takes no startup files; ${files.length} not delivered: ${files.map(file => file.path).join(", ")}`] } : {}),
        };
    }
    async launchHarness(binding, opts) {
        if (opts.forkSource) {
            return { ok: false, error: `Fork is unsupported: agent app "${this.runtime}" is launch-only. Remove session_source for this member.` };
        }
        if (opts.resumeToken) {
            return { ok: false, error: `Resume is unsupported: agent app "${this.runtime}" is launch-only. No session was started.` };
        }
        const found = loadAgentAppPreset(this.runtime, this.deps.presetsDir?.() ?? agentAppsDir());
        if (!found.ok)
            return { ok: false, error: found.message };
        const session = binding.tmuxSession ?? opts.name;
        const command = this.deps.seatLaunchEnvironment
            ? await this.deps.seatLaunchEnvironment.command(session, found.preset.command, { runtime: this.runtime })
            : found.preset.command;
        const sent = await this.deps.tmux.sendShellCommand(session, command, undefined, { stageIfLong: true, execInScript: true });
        if (!sent.ok)
            return { ok: false, error: `Couldn't start agent app "${this.runtime}": ${sent.message}` };
        return { ok: true };
    }
    async checkReady(binding) {
        const session = binding.tmuxSession;
        if (!session || !(await this.deps.tmux.hasSession(session))) {
            return { ready: false, reason: "The seat's tmux session isn't there.", code: "session_missing" };
        }
        const command = await this.deps.tmux.getPaneCommand(session);
        if (!command || isShellForeground(command)) {
            return { ready: false, reason: `Agent app "${this.runtime}" isn't running: the pane is at a shell.`, code: "app_not_running" };
        }
        return { ready: true };
    }
}
/**
 * The runtime adapter map, extended with community agent apps: a runtime name that isn't built in resolves to an
 * AgentAppRuntimeAdapter while its preset is installed. The built-in entries are returned as they are, and the map's
 * own keys stay the built-ins.
 */
export function withAgentApps(builtIns, deps) {
    const installed = (key) => typeof key === "string" && !Object.hasOwn(builtIns, key) && isAgentAppRuntime(key)
        && loadAgentAppPreset(key, deps.presetsDir?.() ?? agentAppsDir()).ok;
    return new Proxy(builtIns, {
        get: (target, key, receiver) => installed(key) ? new AgentAppRuntimeAdapter(key, deps) : Reflect.get(target, key, receiver),
        has: (target, key) => Reflect.has(target, key) || installed(key),
    });
}
/** The hidden key of a relaunch map's agent-app resolver; a symbol, so the map's own keys stay the built-ins. */
const AGENT_APP_RESOLVER = Symbol("agent-app-resolver");
/**
 * The runtime adapter map for relaunches (restore, seat lifecycle): exactly the built-ins, plus a hidden resolver for a
 * community agent app. Only `seatAdapter`, given a seat's recorded selection, reaches that resolver, so a seat whose
 * runtime merely matches an installed preset's name (a free-text self-attach) gets no adapter, as before.
 */
export function withAgentAppResolver(builtIns, deps) {
    Object.defineProperty(builtIns, AGENT_APP_RESOLVER, {
        enumerable: false,
        value: (runtime) => isAgentAppRuntime(runtime) && loadAgentAppPreset(runtime, deps.presetsDir?.() ?? agentAppsDir()).ok
            ? new AgentAppRuntimeAdapter(runtime, deps) : undefined,
    });
    return builtIns;
}
/** The adapter to relaunch a seat with: its runtime's built-in adapter, or, for a seat launched for a community agent
 *  app (`agentAppOf`), that app's adapter while its preset is installed. */
export function seatAdapter(map, runtime, agentApp) {
    if (!map || !runtime)
        return undefined;
    if (Object.hasOwn(map, runtime))
        return map[runtime];
    const resolve = map[AGENT_APP_RESOLVER];
    return agentAppOf(agentApp, runtime) && resolve ? resolve(runtime) : undefined;
}
//# sourceMappingURL=agent-app-runtime-adapter.js.map