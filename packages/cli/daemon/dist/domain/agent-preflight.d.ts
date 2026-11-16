import { type AgentResolverFsOps } from "./agent-resolver.js";
import type { PreflightResult } from "./types.js";
/**
 * Agent-only preflight: resolves agent_ref and its imports.
 * Does NOT check runtime (that's member-authoritative in rig preflight).
 * @param agentRef - agent_ref string
 * @param rigRoot - rig root directory
 * @param fsOps - filesystem operations
 * @returns PreflightResult with errors/warnings
 */
export declare function agentPreflight(agentRef: string, rigRoot: string, fsOps: AgentResolverFsOps): PreflightResult;
//# sourceMappingURL=agent-preflight.d.ts.map