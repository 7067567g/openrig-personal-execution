import { Hono } from "hono";
/** The canonical, non-rig-scoped terminal route family. Mounted at `/api/terminal`. */
export declare function terminalRoutes(): Hono;
/**
 * The rig-scoped THIN ALIAS. Mounted at `/api/rigs/:rigId/terminal`, so `POST
 * /api/rigs/:rigId/terminal/open` composes `view = rig:<rigId>` and delegates
 * to the same canonical `TerminalService.openView` — no composition logic here
 * (arch R1 / guard b1). A `provider` may still ride in the body.
 */
export declare const rigTerminalRoutes: Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
//# sourceMappingURL=terminal.d.ts.map