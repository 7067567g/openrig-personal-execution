import type { AttentionRead } from "@openrig-local/daemon/attention";
/** Merge only unavailable dependencies. A successful empty or bounded partial
 * window is a new answer and must remove old items. The caller owns page scope. */
export declare function retainAttentionSources(read: AttentionRead, prior?: AttentionRead): {
    read: AttentionRead;
    errors: string[];
    retained: boolean;
};
//# sourceMappingURL=source-continuity.d.ts.map