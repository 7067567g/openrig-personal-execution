import type { Hono } from "hono";
import type Database from "better-sqlite3";
import type { ArgvExecFn, ExecFn } from "./adapters/tmux.js";
import type { CmuxTransportFactory } from "./adapters/cmux.js";
import { type SlowOperationInstrumentation } from "./domain/slow-op-recorder.js";
import { type AppDeps } from "./server.js";
interface DaemonOptions {
    dbPath?: string;
    /** S20 — the effective bind plan (mode/hosts/tailscaleDetected/ignoredRoutingHost),
     *  computed once in index.ts and exposed on /healthz so adoption gates verify
     *  listeners by binding evidence. Absent (tests/legacy) = healthz body unchanged. */
    bindPlan?: import("./domain/bind-plan.js").BindPlan;
    tmuxExec?: ExecFn;
    /** Optional shell-free tmux executor; the default unless tmuxExec is injected. */
    argvExec?: ArgvExecFn;
    cmuxExec?: ExecFn;
    cmuxFactory?: CmuxTransportFactory;
    cmuxTimeoutMs?: number;
    tmuxOptionPlatform?: NodeJS.Platform;
    slowOpRecorder?: SlowOperationInstrumentation;
    /**
     * PL-005 Phase B: bearer token for Mission Control write verbs.
     * When null, the auth-bearer-token middleware passes through (the
     * index.ts startup-side check ensures this is only valid when bound
     * on loopback). When set, the middleware enforces constant-time
     * comparison + 401 on missing/mismatch.
     */
    bearerToken?: string | null;
    /**
     * Terminal bearer token for live-terminal routes. Null means the
     * daemon bind posture is already trusted (loopback/tailnet), matching
     * the Mission Control auth boundary. Non-null enforces bearer auth on
     * terminal preview/transport/websocket routes.
     */
    terminalBearerToken?: string | null;
    /** Overrides the `ui.enabled` setting (tests). */
    webUiEnabled?: boolean;
}
interface DaemonResult {
    app: Hono;
    db: Database.Database;
    deps: AppDeps;
    contextMonitor: import("./domain/context-monitor.js").ContextMonitor;
    eventLoopMonitor: import("./domain/event-loop-monitor.js").EventLoopMonitor;
    injectWebSocket: (server: any) => void;
}
/** Select configured provider credentials from the launch environment allowlist. */
export declare function collectAllowlistedProviderAuthEnv(raw: string | null | undefined, env: Record<string, string | undefined>, runtime?: "omp"): Record<string, string>;
/** Assemble the daemon services and runtime adapters using the selected installation assets. */
export declare function createDaemon(opts?: DaemonOptions): Promise<DaemonResult>;
export {};
//# sourceMappingURL=startup.d.ts.map