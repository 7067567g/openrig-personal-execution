import { type ChildProcess } from "node:child_process";
export interface SpawnGatewayOpts {
    socketPath: string;
    home?: string;
    /** Override the compiled entry file (tests point at the built dist entry). */
    entryPath?: string;
    env?: NodeJS.ProcessEnv;
}
/** The compiled entry the daemon spawns: the sibling gateway-process-main.js in dist. Resolved
 *  via import.meta.url so it is correct wherever the daemon's dist is installed. */
export declare function gatewayProcessEntry(): string;
/** Spawn the gateway OS process, out-dialling `socketPath`. Returns the ChildProcess so the
 *  daemon can supervise/kill it. stdout/stderr are piped for the daemon to fold into its logs. */
export declare function spawnGatewayProcess(opts: SpawnGatewayOpts): ChildProcess;
//# sourceMappingURL=spawn-gateway.d.ts.map