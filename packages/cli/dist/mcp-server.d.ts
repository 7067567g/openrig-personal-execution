import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DaemonClient } from "./client.js";
/**
 * Creates an MCP server wrapping the daemon HTTP API.
 * @param client - DaemonClient connected to the daemon
 * @returns McpServer instance (not yet connected to a transport)
 */
export declare function createMcpServer(client: DaemonClient): McpServer;
//# sourceMappingURL=mcp-server.d.ts.map