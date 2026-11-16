import { type AgentActivityStore } from "../agent-activity-store.js";
/**
 * Codex usage-limit banner detector (#763).
 *
 * The reactive tap only accepts a typed `at_limit` hook row, and no hook
 * producer emits one for Codex — the limit surfaces solely as a pane banner.
 * This module matches that banner and records it, so `rig provider signals`
 * and seat status report what the seat itself shows.
 */
export interface CodexLimitBanner {
    /** The "try again at …" text exactly as observed, or null when absent. */
    resetText: string | null;
    /** The banner line, truncated — audit trail for the verdict. */
    evidence: string;
}
/**
 * Match the banner's own line form: the ■ marker must lead (after indent).
 * An agent quoting the sentence, or an error line merely containing the
 * words without the marker, never matches. A match inside a fenced code
 * block is quoted agent output, not seat state. And the banner must still be
 * the most recent content: anything below it other than the composer
 * or footer (a user message, a reply, further output) means a recovered seat
 * whose old banner merely scrolled into view — Codex prints a new banner at
 * the bottom when the limit hits again, so that is still detected.
 */
export declare function detectCodexLimitBanner(paneContent: string): CodexLimitBanner | null;
/**
 * Forget a session's recorded banner. The poller calls this when a Codex
 * seat shows no current banner: the episode is over, so a banner that
 * appears later is new even if its reset text matches the old one.
 */
export declare function clearRecordedBanner(sessionName: string): void;
export declare function recordCodexLimitBanner(deps: {
    store: Pick<AgentActivityStore, "getLatestForNode" | "recordHookEvent">;
    resolveGeneration: (sessionName: string) => string | null;
    sessionName: string;
    banner: CodexLimitBanner | null;
    now?: () => Date;
}): boolean;
//# sourceMappingURL=codex-limit-banner.d.ts.map