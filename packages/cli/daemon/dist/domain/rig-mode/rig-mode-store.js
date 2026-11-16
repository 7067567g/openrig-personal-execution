// Slice 09 — daemon-persisted typed primitive (SQLite-backed).
//
// Follows the workspace-primitive precedent: structured table,
// JSON column for the 10-field record (validator owns integrity at
// write time). NO parallel/forked store (HG-5).
//
// The store exposes:
//   - setBinding(scope, qualifier, mode, record)  → upserts a row
//                                                    (mode is binding-level
//                                                    Component-2 identity;
//                                                    record is the frozen
//                                                    10-field Component-3
//                                                    settings)
//   - getBinding(scope, qualifier)                → reads one row
//   - listBindings()                              → all rows (for show)
//   - resolveEffective(readContext)               → most-specific binding
//   - deleteBinding(scope, qualifier)             → unset
//
// Update authority is operator-only: setBinding hard-codes
// `set_by = 'operator'`. The HTTP route + CLI are the only authoring
// surfaces; agent code paths read but never write. (HG-4)
//
// HG-SAFE preserved here: this store NEVER writes to permission
// allowlists / runtime configs / auth / tmux / lifecycle. It writes
// to ONE table (operator_context_mode_bindings) and reads JSON. A
// future contributor cannot widen permission authority via this
// service because the surface area is the bindings table only.
import { SCOPE_SPECIFICITY, missionModeQualifier, } from "./rig-mode-types.js";
import { validateModeName, validateRecord } from "./rig-mode-validator.js";
function rowToBinding(row) {
    return {
        id: row.id,
        mode: row.mode,
        record: JSON.parse(row.record_json),
        qualifier: row.qualifier,
        setAt: row.set_at,
        setBy: "operator",
    };
}
function bindingId(scope, qualifier) {
    return `${scope}:${qualifier ?? "host"}`;
}
export function bindingCategory(mode) {
    return mode === "human-led" || mode === "delegated" ? "posture" : "mode";
}
/** The ids a binding at this scope and qualifier can carry: today's id, or, when that id is held by the other category,
 *  `<category>@<today's id>`. A legacy id always begins with a scope name and a colon, so the second form can't be one. */
function bindingIds(scope, qualifier, category) {
    const plain = bindingId(scope, qualifier);
    return [plain, `${category}@${plain}`];
}
/** Every row at this scope and qualifier, at most one per category, in the one order that every single-binding read
 *  and an unqualified delete use: latest set first, then by id, so a same-millisecond tie never depends on insertion. */
function rowsAt(db, scope, qualifier) {
    return db.prepare(`
    SELECT id, scope, qualifier, mode, record_json, set_at, set_by
    FROM operator_context_mode_bindings
    WHERE scope = ? AND qualifier IS ?
    ORDER BY set_at DESC, id
  `).all(scope, qualifier);
}
export class RigModeStore {
    db;
    now;
    constructor(db, opts) {
        this.db = db;
        this.now = opts?.now ?? (() => new Date());
    }
    /**
     * Operator-only set. Validates the candidate record + the
     * scope/qualifier shape, then upserts. Returns the typed binding
     * on success.
     *
     * scope == 'global_host' REQUIRES qualifier === null;
     * scope != 'global_host' REQUIRES a non-empty qualifier string.
     * Both are operator/host invariants — the route validates and
     * the store rejects on disagreement.
     */
    setBinding(scope, qualifier, mode, candidateRecord) {
        const errors = [];
        if (scope === "global_host" && qualifier !== null) {
            errors.push(`Global-host bindings cannot carry a qualifier (got ${JSON.stringify(qualifier)}). Pass null for the global_host scope.`);
        }
        if (scope !== "global_host" && (typeof qualifier !== "string" || qualifier.length === 0)) {
            errors.push(`${scope} bindings require a qualifier (rigId / workstreamId / qitemId). Got ${JSON.stringify(qualifier)}.`);
        }
        const modeCheck = validateModeName(mode);
        if (!modeCheck.ok)
            errors.push(modeCheck.error);
        const validation = validateRecord(candidateRecord);
        if (!validation.ok)
            errors.push(...validation.errors);
        if (errors.length > 0 || !modeCheck.ok || !validation.ok) {
            return { ok: false, errors };
        }
        const record = validation.record;
        if (record.scope !== scope) {
            return {
                ok: false,
                errors: [
                    `Record scope mismatch: binding scope is "${scope}" but record.scope is "${record.scope}". The record's scope field MUST agree with the binding scope.`,
                ],
            };
        }
        // A write replaces only the row of its own category here; the other category's row is kept.
        const category = bindingCategory(modeCheck.mode);
        const setAt = this.now().toISOString();
        const id = this.db.transaction(() => {
            const same = rowsAt(this.db, scope, qualifier).find((r) => bindingCategory(r.mode) === category);
            if (same) {
                this.db.prepare("UPDATE operator_context_mode_bindings SET mode = ?, record_json = ?, set_at = ? WHERE id = ?")
                    .run(modeCheck.mode, JSON.stringify(record), setAt, same.id);
                return same.id;
            }
            const [plain, qualified] = bindingIds(scope, qualifier, category);
            const taken = this.db.prepare("SELECT 1 FROM operator_context_mode_bindings WHERE id = ?").get(plain);
            const fresh = taken ? qualified : plain;
            this.db.prepare(`INSERT INTO operator_context_mode_bindings (id, scope, qualifier, mode, record_json, set_at, set_by)
        VALUES (?, ?, ?, ?, ?, ?, 'operator')`).run(fresh, scope, qualifier, modeCheck.mode, JSON.stringify(record), setAt);
            return fresh;
        })();
        return {
            ok: true,
            binding: {
                id,
                mode: modeCheck.mode,
                record,
                qualifier,
                setAt,
                setBy: "operator",
            },
        };
    }
    /** The binding at this scope and qualifier: the latest set, when a mode and a posture are both kept there. */
    getBinding(scope, qualifier) {
        const row = rowsAt(this.db, scope, qualifier)[0];
        return row ? rowToBinding(row) : null;
    }
    /** Each category's binding at this scope and qualifier, latest set first. */
    getBindings(scope, qualifier) {
        return rowsAt(this.db, scope, qualifier).map(rowToBinding);
    }
    listBindings() {
        const rows = this.db.prepare(`
      SELECT id, scope, qualifier, mode, record_json, set_at, set_by
      FROM operator_context_mode_bindings
      ORDER BY scope, qualifier NULLS FIRST, id
    `).all();
        return rows.map(rowToBinding);
    }
    /** Delete one binding: the given category's, or without one the latest set (the one getBinding returns). A row of
     *  the other category at the same target is kept. */
    deleteBinding(scope, qualifier, category) {
        return this.removeBinding(scope, qualifier, category) !== null;
    }
    /** As deleteBinding, returning the removed binding. */
    removeBinding(scope, qualifier, category) {
        return this.db.transaction(() => {
            const rows = rowsAt(this.db, scope, qualifier);
            const row = category ? rows.find((r) => bindingCategory(r.mode) === category) : rows[0];
            if (!row)
                return null;
            this.db.prepare("DELETE FROM operator_context_mode_bindings WHERE id = ?").run(row.id);
            return rowToBinding(row);
        })();
    }
    /**
     * Resolve the most-specific applicable binding for a read context.
     * Returns null when no binding matches — callers MUST treat null as
     * `unknown_posture` per convention §Q6 (do NOT default to `desk`).
     *
     * Specificity ranks (qitem > workstream > rig > global_host) are
     * defined in rig-mode-types.SCOPE_SPECIFICITY. For each scope the
     * resolver picks the binding whose qualifier matches the read
     * context. Among multiple matching bindings, the most-specific
     * scope wins.
     */
    resolveEffective(ctx, modes) {
        // Each scope contributes every category kept there, latest set first.
        const candidates = [];
        if (ctx.qitemId)
            candidates.push(...this.getBindings("qitem", ctx.qitemId));
        if (ctx.workstreamId)
            candidates.push(...this.getBindings("workstream", ctx.workstreamId));
        if (ctx.projectId && ctx.missionId)
            candidates.push(...this.getBindings("mission", missionModeQualifier(ctx.projectId, ctx.missionId)));
        if (ctx.projectId)
            candidates.push(...this.getBindings("project", ctx.projectId));
        if (ctx.rigId)
            candidates.push(...this.getBindings("rig", ctx.rigId));
        candidates.push(...this.getBindings("global_host", null));
        if (candidates.length === 0)
            return null;
        if (modes && candidates.some((b) => !validateModeName(b.mode).ok || !validateRecord(b.record).ok
            || !bindingIds(b.record.scope, b.qualifier, bindingCategory(b.mode)).includes(b.id))) {
            throw new Error("stored mode binding is invalid");
        }
        candidates.sort((a, b) => SCOPE_SPECIFICITY[b.record.scope] - SCOPE_SPECIFICITY[a.record.scope]);
        const winner = candidates.find((b) => !modes || modes.includes(b.mode));
        if (!winner)
            return null;
        return {
            binding: winner,
            resolvedScope: winner.record.scope,
        };
    }
}
//# sourceMappingURL=rig-mode-store.js.map