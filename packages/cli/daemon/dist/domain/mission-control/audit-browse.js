// PL-005 Phase B: read-only audit-history browse over mission_control_actions.
//
// Filters: qitem_id (exact), action_verb (exact), actor_session (exact),
// since/until (acted_at range). Pagination via before_id + limit.
// Returns {rows, has_more, next_before_id} shape so the UI can paginate.
//
// Read-only: no writers, no UPDATE/DELETE methods. Phase A's
// MissionControlActionLog is the only writer; this layer only queries.
import { MISSION_CONTROL_VERBS, } from "./mission-control-action-log.js";
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
export class MissionControlAuditQueryError extends Error {
    code;
    details;
    constructor(code, message, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = "MissionControlAuditQueryError";
    }
}
export class MissionControlAuditBrowse {
    db;
    constructor(db) {
        this.db = db;
    }
    query(input) {
        if (input.actionVerb && !MISSION_CONTROL_VERBS.includes(input.actionVerb)) {
            throw new MissionControlAuditQueryError("verb_unknown", `unknown action_verb '${input.actionVerb}'; supported: ${MISSION_CONTROL_VERBS.join(", ")}`, { actionVerb: input.actionVerb, supported: [...MISSION_CONTROL_VERBS] });
        }
        const limit = clampLimit(input.limit);
        const where = [];
        const params = [];
        if (input.qitemId) {
            where.push("qitem_id = ?");
            params.push(input.qitemId);
        }
        if (input.actionVerb) {
            where.push("action_verb = ?");
            params.push(input.actionVerb);
        }
        if (input.actorSession) {
            where.push("actor_session = ?");
            params.push(input.actorSession);
        }
        // OPR.0.4.4.19 FR-9 — filter on the pinned audit_notes_json shape via
        // SQLite JSON1 (ships with better-sqlite3). NULL audit_notes_json rows
        // simply don't match.
        if (input.scopeTier) {
            where.push("json_extract(audit_notes_json, '$.scope_tier') = ?");
            params.push(input.scopeTier);
        }
        if (input.scopeId) {
            where.push("json_extract(audit_notes_json, '$.scope_id') = ?");
            params.push(input.scopeId);
        }
        if (input.scopePath) {
            where.push("json_extract(audit_notes_json, '$.scope_path') = ?");
            params.push(input.scopePath);
        }
        if (input.approvalScope) {
            where.push("json_extract(audit_notes_json, '$.approval_scope') = ?");
            params.push(input.approvalScope);
        }
        if (input.since) {
            where.push("acted_at >= ?");
            params.push(input.since);
        }
        if (input.until) {
            where.push("acted_at <= ?");
            params.push(input.until);
        }
        if (input.beforeId) {
            // Look up the cursor row's rowid so pagination uses SQLite's
            // monotonic insertion order (deterministic) rather than ULID
            // action_id (whose same-ms tail is random; non-deterministic
            // for tiebreaks). Filed lesson:
            // feedback_ulid_tiebreaker_nondeterministic.md.
            where.push("rowid < (SELECT rowid FROM mission_control_actions WHERE action_id = ?)");
            params.push(input.beforeId);
        }
        const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
        // Fetch limit+1 to detect hasMore without a separate count query.
        // ORDER BY acted_at DESC primary; rowid DESC tiebreak (deterministic
        // insertion order; safer than ULID action_id for same-ms ties).
        const sql = `SELECT * FROM mission_control_actions ${whereClause}
       ORDER BY acted_at DESC, rowid DESC LIMIT ?`;
        const rows = this.db.prepare(sql).all(...params, limit + 1);
        const hasMore = rows.length > limit;
        const trimmed = hasMore ? rows.slice(0, limit) : rows;
        const nextBeforeId = hasMore && trimmed.length > 0 ? trimmed[trimmed.length - 1].action_id : null;
        return {
            rows: trimmed.map(rowToEntry),
            hasMore,
            nextBeforeId,
        };
    }
}
function clampLimit(input) {
    if (input === undefined || !Number.isFinite(input))
        return DEFAULT_LIMIT;
    if (input < 1)
        return 1;
    if (input > MAX_LIMIT)
        return MAX_LIMIT;
    return Math.floor(input);
}
function rowToEntry(row) {
    return {
        actionId: row.action_id,
        actionVerb: row.action_verb,
        qitemId: row.qitem_id,
        actorSession: row.actor_session,
        actedAt: row.acted_at,
        beforeState: row.before_state_json
            ? JSON.parse(row.before_state_json)
            : null,
        afterState: row.after_state_json
            ? JSON.parse(row.after_state_json)
            : null,
        reason: row.reason,
        annotation: row.annotation,
        notifyAttempted: row.notify_attempted !== 0,
        notifyResult: row.notify_result,
        auditNotes: row.audit_notes_json
            ? JSON.parse(row.audit_notes_json)
            : null,
        identityProvenance: row.identity_provenance ?? null,
    };
}
//# sourceMappingURL=audit-browse.js.map