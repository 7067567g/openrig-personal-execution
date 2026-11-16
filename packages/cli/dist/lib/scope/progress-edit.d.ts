export type ProgressStatus = "active" | "done" | "blocked";
export declare const PROGRESS_STATUSES: ReadonlyArray<ProgressStatus>;
export declare const DEFAULT_PROGRESS_SECTION = "Rail";
/** Map a status word to the single indexer indicator character. */
export declare function statusIndicator(status: ProgressStatus): " " | "x" | "~";
/** Validate + narrow an arbitrary string to a ProgressStatus, or throw
 *  the 3-part error. The status vocabulary is the ONLY three the indexer
 *  understands. */
export declare function parseStatus(raw: string): ProgressStatus;
export interface ProgressEditResult {
    content: string;
    changed: boolean;
}
/**
 * Append a `- [<indicator>] <text>` row under `## <section>`.
 * - Creates the `## <section>` heading (appended after the last existing
 *   section) when it is absent.
 * - Idempotent: an identical (section, text, status) row is a no-op.
 * - Refuses to create a conflicting duplicate (same text, different
 *   status) — that is a `--set` operation, not an `--add`.
 * - Never touches the frontmatter, the `# H1`, or unrelated lines.
 */
export declare function addProgressRow(content: string, opts: {
    section: string;
    text: string;
    status: ProgressStatus;
}): ProgressEditResult;
/**
 * Rewrite the indicator of the single row whose trimmed text EXACTLY
 * matches `text`. Row selection is exact-trimmed-text (not line number,
 * not a generated id — the indexer mints neither).
 * - 0 matches → error (names the missing text).
 * - >1 matches → error (ambiguous; v0 refuses rather than guess).
 * - Idempotent: setting a row to its current status is a no-op.
 * - Rewrites ONLY the matched line's indicator char; the rest is
 *   preserved byte-for-byte.
 */
export declare function setProgressRow(content: string, opts: {
    text: string;
    status: ProgressStatus;
}): ProgressEditResult;
//# sourceMappingURL=progress-edit.d.ts.map