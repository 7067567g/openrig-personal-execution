import type { Hono } from "hono";
/** Terminal bearer authentication; server.ts applies the shared browser boundary before this route. */
export declare function terminalAuthMiddleware(opts: {
    bearerToken: string | null;
}): (c: {
    req: {
        header(name: string): string | undefined;
        query(name: string): string | undefined;
    };
    json(data: unknown, status: number): unknown;
}, next: () => Promise<void>) => Promise<unknown>;
/** With the web UI off the WebSocket is not registered, but this same guard still runs in front of the HTTP
 *  terminal routes it matched before (GET /api/terminal/views, /preview, /status), so their behaviour is unchanged. */
export declare function registerTerminalAuthOnly(app: Hono, opts: {
    bearerToken: string | null;
}): void;
export declare function registerTerminalWs(app: Hono, upgradeWebSocket: Parameters<typeof import("@hono/node-ws").createNodeWebSocket>[0] extends {
    app: infer _A;
} ? never : never, opts: {
    bearerToken: string | null;
}): void;
//# sourceMappingURL=terminal-ws.d.ts.map