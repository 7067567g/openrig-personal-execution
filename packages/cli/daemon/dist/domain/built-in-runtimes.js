/** The runtimes OpenRig ships. Any other runtime name names a community agent app (`agent-app-presets.ts`), and a
 *  preset can't take one of these names. */
export const BUILT_IN_RUNTIMES = new Set(["claude-code", "codex", "pi", "omp", "opencode", "dsh", "terminal", "stub"]);
/** A runtime name that isn't built in names a community agent app. */
export function isAgentAppRuntime(runtime) {
    return !!runtime && !BUILT_IN_RUNTIMES.has(runtime);
}
/** The community agent app a seat runs, from positive provenance only: the session was launched for that app
 *  (`sessions.agent_app`), and it's still the node's runtime. A free-text runtime name alone, an older session or a
 *  changed runtime gives null, so such a seat is treated as it always was. */
export function agentAppOf(agentApp, runtime) {
    return agentApp && agentApp === runtime ? agentApp : null;
}
//# sourceMappingURL=built-in-runtimes.js.map