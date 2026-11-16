import type { ExecFn } from "../adapters/tmux.js";
/** Probe result status — matches Phase 5 spec */
export type ProbeStatus = "installed" | "missing" | "unsupported" | "unknown";
/** Input specification for a single requirement to probe */
export interface RequirementSpec {
    name: string;
    kind: "cli_tool" | "system_package";
    installHints?: Record<string, string>;
}
/** Result of probing a single requirement */
export interface ProbeResult {
    name: string;
    kind: "cli_tool" | "system_package";
    status: ProbeStatus;
    /** Version string when provider reports it (e.g. brew). Null for cli_tool probes. */
    version: string | null;
    /** Resolved binary path from `command -v`. Null for non-cli probes or missing tools. */
    detectedPath: string | null;
    /** Provider used for the probe (e.g. 'homebrew'). Null for generic CLI probes. */
    provider: string | null;
    /** The exact command that was executed. Null if no probe was executed (unsupported). */
    command: string | null;
    /** Install hints from the manifest — display only, never executed. */
    installHints: Record<string, string> | null;
    /** Error message if probe failed or timed out. */
    error: string | null;
}
interface ProbeOptions {
    timeoutMs?: number;
    platform?: string;
}
/**
 * Provider-backed probe registry for CLI tools and system packages.
 * Uses injected ExecFn — no real shell execution in tests.
 */
export declare class RequirementsProbeRegistry {
    private exec;
    private timeoutMs;
    private platform;
    constructor(exec: ExecFn, opts?: ProbeOptions);
    /**
     * Probe a CLI tool via `command -v`.
     * Returns the resolved binary path in detectedPath, version stays null.
     */
    probeCli(name: string): Promise<ProbeResult>;
    /**
     * Probe a system package via Homebrew (`brew list --versions`).
     * Parses version from output when available.
     */
    probeBrew(name: string): Promise<ProbeResult>;
    /**
     * Probe a single requirement. Routes to the appropriate provider.
     * Preserves installHints from the spec onto the result.
     */
    probeRequirement(spec: RequirementSpec): Promise<ProbeResult>;
    /**
     * Probe all requirements in sequence. Returns results in input order.
     */
    probeAll(specs: RequirementSpec[]): Promise<ProbeResult[]>;
    private execWithTimeout;
}
export {};
//# sourceMappingURL=requirements-probe.d.ts.map