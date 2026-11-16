import type Database from "better-sqlite3";
export interface ChatMessage {
    id: string;
    rigId: string;
    sender: string;
    kind: string;
    body: string;
    topic: string | null;
    createdAt: string;
}
export interface HistoryOptions {
    topic?: string;
    limit?: number;
    after?: string;
    since?: string;
    sender?: string;
}
export declare class ChatRepository {
    readonly db: Database.Database;
    constructor(db: Database.Database);
    send(rigId: string, sender: string, body: string): ChatMessage;
    sendTopic(rigId: string, sender: string, topic: string, body?: string): ChatMessage;
    /** Whether a topic marker exists for this rig, i.e. history for it can return rows. */
    topicStarted(rigId: string, topic: string): boolean;
    private topicMarker;
    history(rigId: string, opts?: HistoryOptions): ChatMessage[];
    /** True when SQLite's date functions parse the value as a timestamp — the
     *  same parse the julianday() comparison in history() applies. An
     *  unparseable value silently matches no rows, so callers can refuse it
     *  up front instead of reporting an empty history. */
    timestampParses(value: string): boolean;
    latest(rigId: string, count: number): ChatMessage[];
    searchChat(rigId: string, pattern: string): ChatMessage[];
    clear(rigId: string): {
        deleted: number;
    };
    private rowToMessage;
}
//# sourceMappingURL=chat-repository.d.ts.map