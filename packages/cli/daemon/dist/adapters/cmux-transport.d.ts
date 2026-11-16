import type { CmuxTransportFactory } from "./cmux.js";
import type { ExecFn } from "./tmux.js";
/**
 * CLI-based CmuxTransportFactory.
 *
 * At factory time, probes `cmux --help` to discover the live cmux command
 * surface. The probe doubles as a binary-presence check (replaces the older
 * `cmux capabilities --json` verify): a missing cmux binary makes exec throw
 * ENOENT, which the factory propagates to the caller. The probe result is
 * cached on the returned transport instance and consulted on every request
 * to dispatch to the correct command for the installed cmux version.
 */
export declare function createCmuxCliTransport(exec: ExecFn): CmuxTransportFactory;
//# sourceMappingURL=cmux-transport.d.ts.map