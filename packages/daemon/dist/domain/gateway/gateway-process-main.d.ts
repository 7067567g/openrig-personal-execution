import { type GatewayProcessHandle } from "./gateway-process.js";
export declare const GATEWAY_SOCKET_ENV = "OPENRIG_GATEWAY_SOCKET";
export declare const GATEWAY_RECONNECT_MS_ENV = "OPENRIG_GATEWAY_RECONNECT_MS";
/** Start the gateway process from environment config. Returns the handle (undefined if the
 *  required socket path is missing — the entry sets a non-zero exit code and returns). */
export declare function mainFromEnv(env?: NodeJS.ProcessEnv): GatewayProcessHandle | undefined;
//# sourceMappingURL=gateway-process-main.d.ts.map