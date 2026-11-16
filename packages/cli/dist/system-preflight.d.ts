import type { ConfigStore, RiggedConfig } from "./config-store.js";
import type { DaemonStatus } from "./daemon-lifecycle.js";
export interface PreflightCheck {
    name: string;
    ok: boolean;
    error?: string;
    reason?: string;
    fix?: string;
    /** Set on a passing check that carries a qualification (e.g. untested Node major). */
    warning?: string;
}
export interface PreflightResult {
    ready: boolean;
    checks: PreflightCheck[];
}
/** Run a preflight probe with its stderr captured, not echoed. Without `stdio`, `execSync` also copies the child's
 *  stderr to the terminal, so a first `rig daemon start` printed tmux's "error connecting to … (No such file or
 *  directory)" for the ordinary no-server case. The text still reaches the probe in the thrown error, so a real tmux
 *  failure is still classified and reported. */
export declare function quietPreflightExec(cmd: string): Promise<string>;
interface PreflightDeps {
    exec: (cmd: string) => Promise<string>;
    configStore: ConfigStore;
    getDaemonStatus: () => Promise<DaemonStatus>;
    openrigHome?: string;
    riggedHome?: string;
}
interface RunOverrides {
    port?: number;
    host?: string;
}
interface WritableHomeCheckDeps {
    mkdirp?: (path: string) => void;
    checkWritable?: (path: string) => void;
}
export declare function buildWritableHomeCheck(config: RiggedConfig, openrigHome: string, deps?: WritableHomeCheckDeps): PreflightCheck;
export declare class SystemPreflight {
    private deps;
    constructor(deps: PreflightDeps);
    run(overrides?: RunOverrides): Promise<PreflightResult>;
}
export {};
//# sourceMappingURL=system-preflight.d.ts.map