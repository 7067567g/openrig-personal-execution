import type { CodexUsageReader } from "./codex-usage-reader.js";
import type { UsageAllowanceIdentity } from "./provider-types.js";
import { UsageWindows, type UsageReading } from "./usage-windows.js";
export { UNRESOLVED_READS_KEPT, USAGE_CLOCK_TOLERANCE_MS, USAGE_FRESH_FOR_MS, usageFreshness, usageLevel, type UsageRefreshResult, } from "./usage-windows.js";
type Reading = UsageReading<UsageAllowanceIdentity>;
/**
 * The workspace `account/read` reports, when it reports one: `workspaceRouting.chatgptAccountId` at the top
 * level of the result (a sibling of `account`). Path and types from Codex 0.162.1's generated schema
 * (GetAccountResponse.json), relayed by Build's reviewer: `workspaceRouting` is optional and nullable, and
 * when present `chatgptAccountId` is a non-null string. Its siblings (backendOrigin, accountRoutingOverride)
 * are not identity. Codex 0.153.4's answer has no `workspaceRouting`, so it yields null there.
 */
export declare function accountReadWorkspaceId(account: unknown): string | null;
/**
 * Normalize the two app-server answers (shapes from Codex 0.153.4's protocol: `GetAccountResponse`,
 * `GetAccountRateLimitsResponse`). One reading per metered bucket (`rateLimitsByLimitId`, else the
 * single-bucket `rateLimits`). Identity is the usage answer's `accountId`, else the workspace
 * `account/read` reports, else unresolved; email and plan are labels and never part of identity.
 */
export declare function normalizeCodexUsage(account: unknown, rateLimits: unknown, observedAt: string): {
    ok: true;
    readings: Reading[];
} | {
    ok: false;
    detail: string;
};
/** The replacement key of a resolved identity. Email is never part of it; an unresolved identity has none. */
export declare const codexUsageIdentityKey: (i: UsageAllowanceIdentity) => string | null;
export interface CodexUsageWindowsDeps {
    read: CodexUsageReader;
    now?: () => string;
}
export declare class CodexUsageWindows extends UsageWindows<UsageAllowanceIdentity, {
    account: unknown;
    rateLimits: unknown;
}> {
    constructor(deps: CodexUsageWindowsDeps);
}
//# sourceMappingURL=codex-usage-windows.d.ts.map