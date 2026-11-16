import { PageRead } from "./page-read.js";
import type { FleetSnapshot, LoadState, RowFlash } from "./types.js";
/** one-shot flash window (ms) — matches renderScreen's flashActive window */
export declare const FLASH_WINDOW_MS = 600;
/** One passive whole-snapshot read per quiet daemon sample window. */
export declare const QUIET_REFRESH_MS = 30000;
export interface QuietTimerHandle {
    unref?: () => void;
}
export interface LiveRefreshDeps {
    hydrate: (page: PageRead, signal: AbortSignal) => Promise<FleetSnapshot>;
    scopeKey?: () => string;
    /** draw callback — invoked when the load lifecycle or data changes, so the
     * in-flight frame is actually DRAWN at start and cleared on settle */
    onFrame: () => void;
    now: () => number;
    /** injected by deterministic tests; production uses the Node timeout */
    setTimeout?: (callback: () => void, delayMs: number) => QuietTimerHandle;
    clearTimeout?: (handle: QuietTimerHandle) => void;
}
export interface LiveRefresh {
    /** run one refresh (single-flight); NEVER rejects — a failed hydrate
     * releases in-flight, keeps the prior snapshot, and the next call retries */
    refresh: () => Promise<void>;
    invalidate: () => Promise<void>;
    connectionStatus: (status: NonNullable<LoadState["connection"]>) => void;
    snapshot: () => FleetSnapshot;
    load: () => LoadState;
    flashes: () => RowFlash[];
    /** stop the quiet fallback during TUI shutdown */
    close: () => void;
}
export declare function createLiveRefresh(deps: LiveRefreshDeps): LiveRefresh;
//# sourceMappingURL=live.d.ts.map