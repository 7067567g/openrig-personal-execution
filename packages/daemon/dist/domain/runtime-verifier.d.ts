import type Database from "better-sqlite3";
import type { ExecFn } from "../adapters/tmux.js";
import { ProbeTimeoutError } from "../adapters/bounded-probe-exec.js";
import type { RuntimeVerification, RuntimeStatus } from "./bootstrap-types.js";
interface RuntimeVerifierDeps {
    exec: ExecFn;
    db: Database.Database;
    /** Runs the `--version` / `--help` probes (default: exec). The daemon passes boundedProbeExec, so a hung
     *  runtime binary is ended after a bound instead of holding up startup or bootstrap. */
    probeExec?: ExecFn;
}
/** What a probe that didn't answer within its bound records: status "error" with what happened. The binary
 *  exists but hangs, so it isn't "not found", and after a `--version` timeout `--help` isn't tried (it would
 *  usually hang too, doubling the wait). */
export declare function probeTimeoutOutcome(_binary: string, _probe: "version" | "help", timeout: ProbeTimeoutError): {
    fallBackToHelp: true;
} | {
    status: RuntimeStatus;
    error: string;
};
export declare const PI_NODE_ENGINE_FLOOR = "22.19.0";
export declare function meetsPiNodeEngineFloor(version: string): boolean;
/**
 * Verifies runtimes are usable — not just present on PATH.
 * Persists results to runtime_verifications table automatically.
 */
export declare class RuntimeVerifier {
    readonly db: Database.Database;
    private exec;
    private probeExec;
    constructor(deps: RuntimeVerifierDeps);
    /** Verify tmux: `tmux -V`, parse version from output. */
    verifyTmux(): Promise<RuntimeVerification>;
    /** Verify cmux: `cmux capabilities --json`, parse capabilities. */
    verifyCmux(): Promise<RuntimeVerification>;
    /** Verify Claude Code: `claude --version`, fallback to `claude --help`. */
    verifyClaude(): Promise<RuntimeVerification>;
    /** Verify Codex: `codex --version`, fallback to `codex --help`. */
    verifyCodex(): Promise<RuntimeVerification>;
    /** OPR.0.4.6.PI1 FR-1 — Verify Pi: `pi --version` (fallback `pi --help`)
     *  plus the Node engine floor Pi requires (>= 22.19.0). Provider/model
     *  resolvability is member-scoped and verified at launch, not here. */
    verifyPi(): Promise<RuntimeVerification>;
    /** OMP is an independent executable; do not inherit Pi's Node engine check. */
    verifyOmp(): Promise<RuntimeVerification>;
    /**
     * Verify multiple runtimes. Returns results in input order.
     * @param runtimes - canonical runtime names: 'tmux', 'cmux', 'claude-code', 'codex', 'pi', 'omp'
     */
    verifyAll(runtimes: string[]): Promise<RuntimeVerification[]>;
    /**
     * Shared helper: try `{binary} --version`, fall back to `{binary} --help`.
     * Used by verifyClaude and verifyCodex.
     */
    private verifyVersionOrHelp;
    /**
     * Run a probe with error handling. On exec failure, returns failStatus (default: not_found).
     */
    private runProbe;
    private buildVerification;
    /** Parse a semver-like version from output (e.g. "tmux 3.4" -> "3.4"). */
    private parseVersion;
    /** Persist verification to runtime_verifications table. Upserts by runtime name. */
    private persist;
}
export {};
//# sourceMappingURL=runtime-verifier.d.ts.map