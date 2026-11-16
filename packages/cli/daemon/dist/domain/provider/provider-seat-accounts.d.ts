import type { ClaudeWindowSample } from "./claude-usage-windows.js";
import type { CodexAuthMetadata } from "./codex-auth-reader.js";
import type { ProviderSeat } from "./provider-collect.js";
import type { ProviderUsageAllowance, SeatConfiguredAccount } from "./provider-types.js";
export interface SeatAccountsInput {
    seats: ProviderSeat[];
    auth: CodexAuthMetadata;
    usage: ProviderUsageAllowance[];
    /** Each Claude seat's own latest status-line samples (ClaudeUsageWindows.seatSamples()); null when not available. */
    claudeSamples: ClaudeWindowSample[] | null;
    /** The CODEX_HOME every Codex seat on this daemon launches with. */
    codexHome: string;
    /** The daemon's CLAUDE_CONFIG_DIR as set (may be relative), and its HOME. */
    claudeConfigDir: string | undefined;
    home: string | undefined;
}
export declare function configuredSeatAccounts(input: SeatAccountsInput): SeatConfiguredAccount[];
//# sourceMappingURL=provider-seat-accounts.d.ts.map