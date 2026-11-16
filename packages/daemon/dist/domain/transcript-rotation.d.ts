import { type TmuxAdapter } from "../adapters/tmux.js";
import { SettingsStore } from "./user-settings/settings-store.js";
export interface TranscriptRotationOptions {
    /** Trailing line count to capture each tick. */
    lines: number;
    /** Poll interval in milliseconds. */
    pollIntervalMs: number;
}
export declare const DEFAULT_TRANSCRIPT_LINES = 1000;
export declare const DEFAULT_TRANSCRIPT_POLL_INTERVAL_MS = 2000;
export declare const MAX_IDLE_CAPTURE_INTERVAL_MS = 6000;
export declare const DEFAULT_TRANSCRIPT_STALE_AFTER_MS = 10000;
export declare const CAPTURE_RESULT_DEADLINE_MS = 5000;
export declare const ACTIVITY_HINT_DEADLINE_MS = 1000;
export declare const IDLE_FULL_CAPTURE_MS = 10000;
/** A shared live resolver retains a usable policy during partial config writes.
 * Environment overrides keep their existing precedence over file settings. */
export declare function createTranscriptRotationOptionsResolver(store: SettingsStore, reportError?: (error: string | null) => void): () => TranscriptRotationOptions;
/** Live environment > file > default settings; read at most once per second
 * across all production rotators in this daemon process. */
export declare function getTranscriptRotationOptionsFromEnv(): TranscriptRotationOptions;
type WindowHint = {
    activity: number;
    size?: string;
};
/** The window listing every reader of this adapter shares: one list-windows in flight at a time, reused while under a
 *  cadence old. `fresh` asks for a listing that starts now; while an older one is still running it gets null instead.
 *  A reader past the 1 s deadline gets null and captures; the pending listing stays owned until its child exits. */
export declare function windowSnapshot(adapter: TmuxAdapter, cadence: number, fresh?: boolean): Promise<Map<string, WindowHint> | null>;
/** Process-local capture observations, never provider readiness or per-process CPU. */
export declare function getTranscriptCaptureStats(): {
    rotatingSeats: number;
    idleSeats: number;
    captures: number;
    failures: number;
    capturedBytes: number;
    captureDurationMs: number;
    activeIntervalMs: number | null;
    lines: number | null;
    maxIdleIntervalMs: number | null;
    settingsReloadError: string | null;
    activityHintDeadlineMs: number;
    captureResultDeadlineMs: number;
};
export declare function getLastCaptureAt(sessionName: string): number | undefined;
export declare function getLastCheckedAt(sessionName: string): number | undefined;
/** Start a per-session capture-pane rotation timer. Idempotent: a
 *  second start for the same session replaces the first timer. The
 *  first tick fires immediately unless an old capture for this session is
 *  still pending; replacement then waits for a scheduled tick after it settles. */
export declare function startTranscriptRotation(tmuxAdapter: TmuxAdapter, sessionName: string, outputPath: string, opts: TranscriptRotationOptions, resolveOptions?: () => TranscriptRotationOptions): void;
/** Clear the rotation timer for a session. Safe to call when no timer
 *  is registered. */
export declare function stopTranscriptRotation(sessionName: string): void;
/** Test-only: count of active rotators. Production code should not
 *  depend on this. */
export declare function getActiveRotationCount(): number;
/** Test-only: clear all active rotators. Production code should not
 *  call this; use stopTranscriptRotation for individual sessions. */
export declare function clearAllTranscriptRotationsForTest(): void;
export {};
//# sourceMappingURL=transcript-rotation.d.ts.map