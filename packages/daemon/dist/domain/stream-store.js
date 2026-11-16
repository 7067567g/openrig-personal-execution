import { monotonicFactory } from "ulid";
const ulid = monotonicFactory();
/**
 * L1 — Stream store. Append-only intake/audit root.
 * Items are immutable after emit (only `archived_at` may be set).
 */
export class StreamStore {
    db;
    eventBus;
    /** P21 §4: detected once — a curated-migration test DB (or a pre-067 daemon) may lack the
     *  era-stamp column, so the writer degrades (omits it) instead of throwing. */
    hasIdentityProvenanceColumn;
    constructor(db, eventBus) {
        this.db = db;
        this.eventBus = eventBus;
        this.hasIdentityProvenanceColumn = this.db.prepare("PRAGMA table_info(stream_items)").all().some((col) => col.name === "identity_provenance");
    }
    /**
     * Idempotent emit: same `streamItemId` returns the existing row.
     */
    emit(input) {
        const tsEmitted = new Date().toISOString();
        const id = input.streamItemId ?? ulid();
        const existing = this.getByIdRaw(id);
        if (existing)
            return this.rowToItem(existing);
        const sortKey = ulid();
        const interrupt = input.interrupt ? 1 : 0;
        const tagsJson = input.hintTags ? JSON.stringify(input.hintTags) : null;
        const persistTxn = this.db.transaction(() => {
            if (this.hasIdentityProvenanceColumn) {
                this.db
                    .prepare(`INSERT INTO stream_items (
              stream_item_id, ts_emitted, stream_sort_key, source_session, body,
              format, hint_type, hint_urgency, hint_destination, hint_tags, interrupt, identity_provenance
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                    .run(id, tsEmitted, sortKey, input.sourceSession, input.body, input.format ?? "text", input.hintType ?? null, input.hintUrgency ?? null, input.hintDestination ?? null, tagsJson, interrupt, input.identityProvenance ?? null);
            }
            else {
                this.db
                    .prepare(`INSERT INTO stream_items (
              stream_item_id, ts_emitted, stream_sort_key, source_session, body,
              format, hint_type, hint_urgency, hint_destination, hint_tags, interrupt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                    .run(id, tsEmitted, sortKey, input.sourceSession, input.body, input.format ?? "text", input.hintType ?? null, input.hintUrgency ?? null, input.hintDestination ?? null, tagsJson, interrupt);
            }
            return this.eventBus.persistWithinTransaction({
                type: "stream.emitted",
                streamItemId: id,
                sourceSession: input.sourceSession,
                hintDestination: input.hintDestination ?? null,
                hintType: input.hintType ?? null,
                hintUrgency: input.hintUrgency ?? null,
                interrupt: Boolean(input.interrupt),
            });
        });
        const persistedEvent = persistTxn();
        this.eventBus.notifySubscribers(persistedEvent);
        return this.rowToItem(this.getByIdRaw(id));
    }
    getById(streamItemId) {
        const row = this.getByIdRaw(streamItemId);
        return row ? this.rowToItem(row) : null;
    }
    list(opts) {
        const limit = opts?.limit ?? 100;
        const conditions = [];
        const params = [];
        if (!opts?.includeArchived) {
            conditions.push("archived_at IS NULL");
        }
        if (opts?.afterSortKey) {
            conditions.push("(ts_emitted, stream_sort_key) > (SELECT ts_emitted, stream_sort_key FROM stream_items WHERE stream_sort_key = ?)");
            params.push(opts.afterSortKey);
        }
        if (opts?.sourceSession) {
            conditions.push("source_session = ?");
            params.push(opts.sourceSession);
        }
        if (opts?.hintDestination) {
            conditions.push("hint_destination = ?");
            params.push(opts.hintDestination);
        }
        if (opts?.hintTag) {
            conditions.push("EXISTS (SELECT 1 FROM json_each(stream_items.hint_tags) WHERE json_each.value = ?)");
            params.push(opts.hintTag);
        }
        if (opts?.since) {
            conditions.push("ts_emitted >= ?");
            params.push(opts.since);
        }
        if (opts?.until) {
            conditions.push("ts_emitted <= ?");
            params.push(opts.until);
        }
        const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        params.push(limit);
        const latest = opts?.direction === "latest";
        const rows = this.db
            .prepare(`SELECT * FROM stream_items ${where} ORDER BY ts_emitted ${latest ? "DESC" : "ASC"}, stream_sort_key ${latest ? "DESC" : "ASC"} LIMIT ?`)
            .all(...params);
        return (latest ? rows.reverse() : rows).map((r) => this.rowToItem(r));
    }
    /**
     * Soft-archive — sets `archived_at`. Items remain in the table for audit.
     */
    archive(streamItemId) {
        const result = this.db
            .prepare("UPDATE stream_items SET archived_at = datetime('now') WHERE stream_item_id = ? AND archived_at IS NULL")
            .run(streamItemId);
        return result.changes > 0;
    }
    getByIdRaw(streamItemId) {
        return this.db
            .prepare("SELECT * FROM stream_items WHERE stream_item_id = ?")
            .get(streamItemId);
    }
    rowToItem(row) {
        return {
            streamItemId: row.stream_item_id,
            tsEmitted: row.ts_emitted,
            streamSortKey: row.stream_sort_key,
            sourceSession: row.source_session,
            body: row.body,
            format: row.format,
            hintType: row.hint_type,
            hintUrgency: row.hint_urgency,
            hintDestination: row.hint_destination,
            hintTags: row.hint_tags ? JSON.parse(row.hint_tags) : null,
            interrupt: row.interrupt === 1,
            archivedAt: row.archived_at,
        };
    }
}
//# sourceMappingURL=stream-store.js.map