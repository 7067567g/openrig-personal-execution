import type Database from "better-sqlite3";
import type { ClaudeAuthAnswer, ClaudeAuthReader } from "./claude-auth-status-reader.js";
import type { ClaudeUsageIdentity, ProviderUsageAllowance } from "./provider-types.js";
import { type UsageRefreshResult } from "./usage-windows.js";
/** The status line's only bucket: its session and weekly windows cover all models. */
export declare const CLAUDE_STATUSLINE_BUCKET = "all models";
export interface ClaudeWindowSample {
    seatSession: string;
    window: "five_hour" | "weekly";
    usedPercent: number;
    resetsAt: string | null;
    /** The status line's own time for this reading. */
    sampledAt: string;
}
/** Each seat's latest provider-window sample per window (lane provider_window). This runs on every read-model
 *  call while the switch is on, so it never walks the series: it steps from one seat to the next on 094's partial
 *  index (seat_session, window, id), then takes each window's latest id with one index seek (about 0.1 ms with
 *  200k samples across 20 seats, where a per-row MAX subquery took about 150 ms). */
export declare function latestClaudeWindowSamples(db: Database.Database): ClaudeWindowSample[];
/** Another seat's fresh reading of the same window that disagrees with the one shown (its own numbers). */
export interface DisagreeingSeat {
    seatSession: string;
    usedPercent: number;
    resetsAt: string | null;
    observedAt: string;
}
/** One window as shown: the freshest sample, plus the other seats whose fresh samples disagree with it. */
interface Pick {
    window: string;
    durationMins: number;
    usedPercent: number;
    resetsAt: string | null;
    observedAt: string;
    seatSession: string;
    disagreeing: DisagreeingSeat[];
}
export declare function pickClaudeWindows(samples: ClaudeWindowSample[], now: string): Pick[];
export declare const claudeUsageIdentityKey: (i: ClaudeUsageIdentity) => string | null;
export declare function claudeIdentityFromAuth(auth: ClaudeAuthAnswer["auth"]): ClaudeUsageIdentity;
export declare class ClaudeUsageWindows {
    private readonly deps;
    private readonly now;
    private current;
    private readonly frozen;
    private frozenUnresolved;
    private unresolvedDropped;
    private lastRefresh;
    private inflight;
    private lastSamples;
    constructor(deps: {
        readIdentity: ClaudeAuthReader;
        listSamples: () => ClaudeWindowSample[];
        now?: () => string;
    });
    /** One bounded identity read. A refresh asked for while one runs joins it. Windows always come from samples. */
    refresh(): Promise<UsageRefreshResult>;
    private runRead;
    /** Each seat's own latest samples as the last project() read them, from memory (no query of its own); null
     *  before any project() or when the samples couldn't be read. Unlike the served windows, which keep one sample
     *  per window, every seat that reported is here. */
    seatSamples(): ClaudeWindowSample[] | null;
    /** The served rows: samples and the identity in memory. It never starts a native read. */
    project(now: string): ProviderUsageAllowance[];
}
export {};
//# sourceMappingURL=claude-usage-windows.d.ts.map