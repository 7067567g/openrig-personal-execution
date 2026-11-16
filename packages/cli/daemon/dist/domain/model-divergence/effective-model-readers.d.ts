/** Read at most the last TAIL_BYTES of a file as utf-8, split into whole lines (the first,
 *  possibly-truncated line is dropped). Missing/unreadable → []. */
export declare function readTailLines(path: string, tailBytes?: number): string[];
/** The model from the seat's newest determinate, non-synthetic model-bearing assistant record, or
 *  null when no such record is in the tail window (a just-launched or synthetic-only seat has none
 *  — the detector treats null as PENDING, not as a match). */
export declare function readClaudeEffectiveModel(transcriptPath: string): string | null;
/** The codex runtime's own current model per its NEWEST turn_context (primary; both rollout
 *  formats) or world_state collaboration_mode (belt). Scans backward from EOF in tail-sized
 *  windows up to MAX_SCAN_BYTES: the signal is sparse relative to bulk event lines (r1's live
 *  census put records 0.4-0.8MB from EOF on the big rollouts), so one tail window is not always
 *  enough, but 8MB bounds the read far under the loop-stall class. */
export declare function readCodexEffectiveModel(rolloutPath: string, maxScanBytes?: number): string | null;
//# sourceMappingURL=effective-model-readers.d.ts.map