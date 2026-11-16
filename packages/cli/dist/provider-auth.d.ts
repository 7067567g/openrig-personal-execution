export interface ProviderAuthDeps {
    exec: (cmd: string) => string;
    readFile: (path: string) => string | null;
    env?: NodeJS.ProcessEnv;
}
export interface ProviderCheck {
    name: string;
    status: "pass" | "fail" | "skipped";
    message: string;
    reason?: string;
    fix?: string;
}
/** Issue #194 — how the Codex provider selected in `$CODEX_HOME/config.toml`
 *  authenticates. Only an explicit provider entry with
 *  `requires_openai_auth = false` and an `env_key` uses its credential
 *  variable; every unresolved case keeps the OpenAI login check. Other Codex
 *  config layers are not resolved here. The daemon's kernel probe
 *  (`selectCodexProviderAuth` in kernel-boot.ts) carries the same rule. */
export type CodexProviderAuth = {
    kind: "openai-login";
    unresolved?: string;
} | {
    kind: "env-key";
    providerId: string;
    envKey: string;
};
export declare function selectCodexProviderAuth(configToml: string | null): CodexProviderAuth;
export declare function checkClaudeAuth(deps: ProviderAuthDeps, installed: boolean): ProviderCheck;
export declare function checkCodexAuth(deps: ProviderAuthDeps, installed: boolean): ProviderCheck;
/** Read-only checks: neither installs a CLI nor starts a login or agent session. */
export declare function checkProviderReadiness(deps: ProviderAuthDeps): ProviderCheck[];
//# sourceMappingURL=provider-auth.d.ts.map