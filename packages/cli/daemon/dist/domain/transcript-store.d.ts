export interface TranscriptStoreOpts {
    transcriptsRoot?: string;
    enabled?: boolean;
    staleAfterMs?: number;
}
export type TranscriptIngestState = "live" | "degraded" | "unavailable";
export interface TranscriptIngestHealth {
    state: TranscriptIngestState;
    reason: "capture_fresh" | "capture_unchanged" | "capture_stale" | "capture_empty" | "capture_missing" | "capture_disabled" | "capture_unreadable";
    lastCapturedAt: string | null;
}
export { DEFAULT_TRANSCRIPT_STALE_AFTER_MS } from "./transcript-rotation.js";
export declare class TranscriptStore {
    private readonly root;
    private readonly _enabled;
    private readonly staleAfterMs;
    constructor(opts?: TranscriptStoreOpts);
    get enabled(): boolean;
    getTranscriptPath(rigName: string, sessionName: string): string;
    getIngestHealth(rigName: string, sessionName: string): TranscriptIngestHealth;
    ensureTranscriptDir(rigName: string): boolean;
    writeBoundaryMarker(rigName: string, sessionName: string, reason: string): boolean;
    stripAnsi(text: string): string;
    readTail(rigName: string, sessionName: string, lines: number): string | null;
    private cleanupTailLines;
    /**
     * Read the entire transcript file as a single string. Returns the raw
     * file contents (callers handle ANSI/cleanup as needed for their use
     * case). Returns null if the file is missing OR any I/O error occurs.
     * Returns "" for an existing-but-empty file.
     *
     * Used by GET /api/transcripts/:session/full (M2c-Daemon). Unlike
     * `readTail`, this does not apply terminal-cleanup heuristics — the
     * route's caller (e.g., the restore-packet generator) needs the
     * unfiltered content the runtime emitted. Route-level redaction is
     * applied at the route layer via `redactTranscriptContent` BEFORE
     * serialization (per orch decision approved-option-a:
     * open-route-with-redaction-as-protective-primitive).
     */
    readFull(rigName: string, sessionName: string): string | null;
    grep(rigName: string, sessionName: string, pattern: string): string[] | null;
    private grepSync;
}
//# sourceMappingURL=transcript-store.d.ts.map