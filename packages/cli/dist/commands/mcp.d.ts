import { Command } from "commander";
import type { StatusDeps } from "./status.js";
/**
 * `rig mcp serve` — start MCP server wrapping the daemon API.
 * @param depsOverride - injectable deps for testing
 * @returns Commander command
 */
export declare function mcpCommand(depsOverride?: StatusDeps): Command;
//# sourceMappingURL=mcp.d.ts.map