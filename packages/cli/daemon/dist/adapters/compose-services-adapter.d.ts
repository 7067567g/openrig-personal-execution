import type { ExecFn } from "./tmux.js";
export type ComposeResult = {
    ok: true;
} | {
    ok: false;
    code: string;
    message: string;
};
export interface ComposeServiceStatus {
    name: string;
    state: string;
    status: string;
    health: string | null;
}
export interface ComposeStatusResult {
    ok: boolean;
    services: ComposeServiceStatus[];
    error?: string;
}
export interface ComposeLogsResult {
    ok: boolean;
    output: string;
    error?: string;
}
/**
 * I/O adapter for Docker Compose. Shells out to `docker compose`.
 * Lives in adapters/ alongside tmux.ts — infrastructure I/O, not domain logic.
 */
export declare class ComposeServicesAdapter {
    private exec;
    constructor(exec: ExecFn);
    /** Start services with docker compose up -d. Readiness is handled by services-readiness, not --wait. */
    up(opts: {
        composeFile: string;
        projectName: string;
        profiles?: string[];
    }): Promise<ComposeResult>;
    /** Stop services according to down policy. */
    down(opts: {
        composeFile: string;
        projectName: string;
        profiles?: string[];
        policy: "leave_running" | "down" | "down_and_volumes";
    }): Promise<ComposeResult>;
    /** Get service statuses via docker compose ps --format json. */
    status(opts: {
        composeFile: string;
        projectName: string;
        profiles?: string[];
    }): Promise<ComposeStatusResult>;
    /** Get logs for a specific service or all services. */
    logs(opts: {
        composeFile: string;
        projectName: string;
        profiles?: string[];
        service?: string;
        tail?: number;
    }): Promise<ComposeLogsResult>;
    /** Run a checkpoint export command. */
    runCheckpointExport(command: string): Promise<ComposeResult>;
    /** Run a checkpoint import command. */
    runCheckpointImport(command: string): Promise<ComposeResult>;
    /** Probe an HTTP wait target. Any 2xx or 3xx response passes this target;
     * redirects are not followed. This proves the server answered, not application readiness. */
    probeHttp(url: string, timeoutMs?: number): Promise<boolean>;
    /** Probe a TCP wait target. Returns true if the port is open. */
    probeTcp(target: string, timeoutMs?: number): Promise<boolean>;
    private baseArgs;
    private extractComposePsPayload;
    /** Parse docker compose ps --format json. Handles both one-object-per-line and JSON array formats. */
    private parseComposePs;
    private mapServiceStatus;
}
//# sourceMappingURL=compose-services-adapter.d.ts.map