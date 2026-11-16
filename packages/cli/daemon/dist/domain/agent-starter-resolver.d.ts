import type { ResolvedStartupFile } from "./runtime-adapter.js";
/**
 * Daemon-side productized resolver for the Agent Starter v1 vertical (M1).
 * Mirrors the v0 wrapper-tier `bin/agent-starter-resolve` semantics:
 * read the named registry entry; run the path-aware no-credentials scan;
 * THROW on a failed scan (the orchestrator MUST treat any throw as a
 * hard launch failure); on a clean scan, emit a `ResolvedStartupFile[]` rooted at the
 * registry directory.
 *
 * v0 wrapper references:
 * - Schema spec: `specs/agent-starters/SCHEMA.md` § No-Credentials Proof
 *   (path-aware + content-aware; allowlist for transcript_path under
 *   ~/.claude/projects/ or ~/.openrig/transcripts/).
 * - Refusal verb: `specs/agent-starters/bin/agent-starter-resolve` lines
 *   22-31 (preflights via `scan_starter_file`; refuses with
 *   credential_path_disallowed / credential_content_disallowed).
 *
 * Pattern reference for the resolver shape:
 * `session-source-rebuild-resolver.ts:31-90`.
 */
export type ExistsFn = (path: string) => boolean;
export type ReadFileFn = (path: string) => string;
export interface AgentStarterResolverOpts {
    /** Optional absolute override; bypasses the lookup chain. */
    registryRoot?: string;
    /**
     * Env var consulted second in the lookup chain. Defaults to
     * `OPENRIG_AGENT_STARTER_ROOT`.
     */
    envVarName?: string;
    /**
     * Home-directory root consulted third. Defaults to
     * `~/.openrig/agent-starters/` (resolved against `process.env.HOME` or
     * `os.homedir()`).
     */
    homeDirRoot?: string;
    /** Optional fallback consulted last when the home registry is absent. */
    fallbackRoot?: string;
    exists?: ExistsFn;
    readFile?: ReadFileFn;
    /** Test seam: lets unit tests inject a controlled env map. */
    env?: Record<string, string | undefined>;
}
export interface AgentStarterResolveResult {
    files: ResolvedStartupFile[];
    registryPath: string;
}
/**
 * Thrown by `resolveStarter` when the no-credentials scan fails. The
 * resolver MUST throw rather than
 * return a structured "ok: false" result the orchestrator could ignore;
 * a failed scan is a hard refusal point that aborts the launch.
 */
export declare class AgentStarterCredentialScanFailedError extends Error {
    readonly starterName: string;
    readonly reason: string;
    constructor(starterName: string, reason: string);
}
export declare class AgentStarterResolver {
    private readonly registryRoot;
    private readonly exists;
    private readonly readFile;
    constructor(opts?: AgentStarterResolverOpts);
    /** Exposed for tests + diagnostics. */
    getRegistryRoot(): string;
    /**
     * Look up the registry root via the documented chain:
     *   opts.registryRoot > env[envVarName] > homeDirRoot (if exists) > fallbackRoot
     *
     * The fallback returns even if the path doesn't exist. `resolveStarter`
     * throws a missing-entry error when the selected root is dead. This keeps
     * the constructor side-effect-free; the file-existence check lives inside
     * `resolveStarter`.
     */
    static resolveRegistryRoot(opts: AgentStarterResolverOpts, exists: ExistsFn): string;
    /**
     * Resolve a starter by registry name. THROWS on:
     * - missing registry entry (no `<root>/<name>.yaml`);
     * - malformed YAML (best-effort detection — empty file, unparseable
     *   front-matter shape — driver does not pull in a YAML parser at
     *   M1 to keep the dependency surface narrow);
     * - failed no-credentials scan (`AgentStarterCredentialScanFailedError`).
     *
     * On a clean scan, emits `ResolvedStartupFile[]`. v1 M1 scaffolding
     * shape: one entry per registry-relative file the starter declares
     * (currently the registry entry YAML itself, treated as guidance_merge
     * content; later milestones can extend the resolver to walk the
     * priming-pack manifest's `read_full` paths once M2/M3 wiring is in
     * place). All emitted files are tagged `appliesOn: ["fresh_start"]`
     * because starter context seeds a fresh-launch conversation.
     */
    resolveStarter(name: string): AgentStarterResolveResult;
}
//# sourceMappingURL=agent-starter-resolver.d.ts.map