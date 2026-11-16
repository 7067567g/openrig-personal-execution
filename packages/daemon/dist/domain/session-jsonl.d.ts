export interface JsonlExchange {
    role: string;
    content: string;
}
/**
 * Parse a provider session JSONL at `path` into the LAST `n` {role, content} exchanges (bounded recap).
 * Honest-degraded: missing/unreadable file → []; unparseable/metadata/text-less lines are skipped.
 */
export declare function parseJsonlExchanges(path: string, n: number): JsonlExchange[];
//# sourceMappingURL=session-jsonl.d.ts.map