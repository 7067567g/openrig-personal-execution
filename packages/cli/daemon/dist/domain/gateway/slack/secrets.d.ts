export interface SecretFsOps {
    readFileSync(p: string): string;
    statMode(p: string): number | null;
}
export declare const nodeSecretFs: SecretFsOps;
/** Parse KEY=VALUE lines (quotes trimmed). Blank lines / #comments ignored. */
export declare function parseEnvFile(text: string): Record<string, string>;
export interface SecretLookupOpts {
    envFile?: string;
    env?: NodeJS.ProcessEnv;
    fsops?: SecretFsOps;
}
/** Warn if the env file is group/world readable (item 10 hygiene). Returns a warning string or null. */
export declare function checkEnvFilePermissions(envFile: string, fsops?: SecretFsOps): string | null;
/**
 * Resolve a secret by logical name. Precedence: explicit env var (OPENRIG_SLACK_<NAME>
 * or the raw name) → env-file key. Returns null when unresolved (honest: callers
 * report "unconfigured", they do NOT fabricate). Never logs the value.
 */
export declare function resolveSecret(name: string, opts?: SecretLookupOpts): string | null;
//# sourceMappingURL=secrets.d.ts.map