import type Database from "better-sqlite3";
import type { EventBus } from "./event-bus.js";
export interface StreamItem {
    streamItemId: string;
    tsEmitted: string;
    streamSortKey: string;
    sourceSession: string;
    body: string;
    format: string;
    hintType: string | null;
    hintUrgency: string | null;
    hintDestination: string | null;
    hintTags: string[] | null;
    interrupt: boolean;
    archivedAt: string | null;
}
export interface StreamEmitInput {
    streamItemId?: string;
    sourceSession: string;
    body: string;
    format?: string;
    hintType?: string | null;
    hintUrgency?: string | null;
    hintDestination?: string | null;
    hintTags?: string[] | null;
    interrupt?: boolean;
    /** P21 §4 era-stamp: the route passes `transport:v1` (sourceSession derived from the transport
     *  header chokepoint). Written onto the stream row; absence = claimed-era. */
    identityProvenance?: string | null;
}
export interface StreamListOptions {
    limit?: number;
    afterSortKey?: string;
    sourceSession?: string;
    hintDestination?: string;
    hintTag?: string;
    since?: string;
    until?: string;
    includeArchived?: boolean;
    direction?: "chronological" | "latest";
}
/**
 * L1 — Stream store. Append-only intake/audit root.
 * Items are immutable after emit (only `archived_at` may be set).
 */
export declare class StreamStore {
    readonly db: Database.Database;
    private readonly eventBus;
    /** P21 §4: detected once — a curated-migration test DB (or a pre-067 daemon) may lack the
     *  era-stamp column, so the writer degrades (omits it) instead of throwing. */
    private readonly hasIdentityProvenanceColumn;
    constructor(db: Database.Database, eventBus: EventBus);
    /**
     * Idempotent emit: same `streamItemId` returns the existing row.
     */
    emit(input: StreamEmitInput): StreamItem;
    getById(streamItemId: string): StreamItem | null;
    list(opts?: StreamListOptions): StreamItem[];
    /**
     * Soft-archive — sets `archived_at`. Items remain in the table for audit.
     */
    archive(streamItemId: string): boolean;
    private getByIdRaw;
    private rowToItem;
}
//# sourceMappingURL=stream-store.d.ts.map