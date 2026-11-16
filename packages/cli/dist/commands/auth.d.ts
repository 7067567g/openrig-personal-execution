import { Command } from "commander";
export interface AuthCommandDeps {
    /** env source (default process.env) — tests point CODEX_HOME at a fixture. */
    env?: NodeJS.ProcessEnv;
    /** login-state probe (default: real `codex login status`, exit-code-only). Injectable for tests. */
    loginStatus?: (codexHome: string) => "logged_in" | "not_logged_in" | "unavailable";
    /** clock for seats set updated_ts (default new Date().toISOString()). */
    now?: () => string;
}
export declare function authCommand(depsOverride?: AuthCommandDeps): Command;
//# sourceMappingURL=auth.d.ts.map