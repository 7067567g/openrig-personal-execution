// OPR.0.4.6.02 C2 — the terminal-views store.
//
// SAVED views persist to `terminal-views.yaml` at the OPENRIG_HOME root
// (VM-isolatable via OPENRIG_HOME). They are write-once/read-at-launch: the
// daemon reads them at launch and the operator's saved layouts survive
// restarts. Each saved member carries a STRUCTURED `host` field (a host id,
// never a `member@rig@host` string — MH BR-1).
//
// DERIVED views (per-rig / per-mission / per-slice) are computed LIVE from the
// live seat inventory + the review agents band and are NEVER written to disk
// (A3). That invariant is structural, not conventional: this module exposes
// `deriveViewMembers` (a pure mapper) and a `save()` that only ever accepts a
// `SavedView` — there is no code path that persists a derived view.
//
// Writes are atomic (tmp + rename on the same filesystem) and byte-stable:
// serialization uses a fixed field order and OMITS absent optionals (never
// null), so a read→save round-trip of the same logical content is idempotent.
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { getDefaultOpenRigPath } from "../../openrig-compat.js";
const EMPTY_FILE = { version: 1, views: [] };
/** Build a member object in fixed key order, omitting absent optionals (never null). */
function normalizeMember(m) {
    const out = { seat: m.seat };
    if (m.label != null && m.label !== "")
        out.label = m.label;
    if (m.host != null && m.host !== "")
        out.host = m.host;
    if (m.tmuxSession != null && m.tmuxSession !== "")
        out.tmuxSession = m.tmuxSession;
    if (m.readOnly === true)
        out.readOnly = true;
    return out;
}
function normalizeView(v) {
    return { id: v.id, name: v.name, members: v.members.map(normalizeMember) };
}
/** Canonical byte-stable serialization of the whole file (fixed order, omit-when-absent). */
function serialize(file) {
    const normalized = {
        version: 1,
        views: file.views.map(normalizeView),
    };
    return stringifyYaml(normalized);
}
export class TerminalViewsStore {
    path;
    constructor(path = getDefaultOpenRigPath("terminal-views.yaml")) {
        this.path = path;
    }
    /** The resolved on-disk path (useful for tests / diagnostics). */
    getPath() {
        return this.path;
    }
    /**
     * Read-at-launch. An absent file yields the empty set. A malformed file
     * throws (honest — never a silent reset that would discard operator layouts).
     */
    read() {
        if (!existsSync(this.path))
            return { version: 1, views: [] };
        const raw = readFileSync(this.path, "utf-8");
        const parsed = parseYaml(raw);
        if (parsed == null)
            return { version: 1, views: [] };
        if (typeof parsed !== "object") {
            throw new Error(`terminal views file at ${this.path} must be a YAML object with a 'views' array`);
        }
        const obj = parsed;
        const views = obj["views"];
        if (!Array.isArray(views)) {
            throw new Error(`terminal views file at ${this.path}: 'views' must be an array`);
        }
        return { version: 1, views: views };
    }
    list() {
        return this.read().views;
    }
    get(id) {
        return this.read().views.find((v) => v.id === id) ?? null;
    }
    /**
     * Persist a SAVED view (upsert by id). Atomic (tmp + rename) and byte-stable.
     * Returns the resulting file. Only accepts `SavedView` — a derived view can
     * never reach disk through this path (A3).
     */
    save(view) {
        const current = this.read();
        const idx = current.views.findIndex((v) => v.id === view.id);
        const next = [...current.views];
        if (idx >= 0)
            next[idx] = view;
        else
            next.push(view);
        const file = { version: 1, views: next };
        this.writeAtomic(file);
        return { version: 1, views: file.views.map(normalizeView) };
    }
    /** Remove a saved view by id (idempotent). Atomic. */
    remove(id) {
        const current = this.read();
        const file = {
            version: 1,
            views: current.views.filter((v) => v.id !== id),
        };
        this.writeAtomic(file);
        return { version: 1, views: file.views.map(normalizeView) };
    }
    writeAtomic(file) {
        const tmp = `${this.path}.tmp`;
        writeFileSync(tmp, serialize(file), "utf-8");
        renameSync(tmp, this.path);
    }
}
/**
 * Map a live seat inventory into composer-ready members. PURE and IN-MEMORY —
 * the result is handed straight to `composeView`; it is NEVER written to the
 * saved-views file. Non-tmux / session-less rows are dropped from the derived
 * set (a derived view only tiles attachable seats; saved views name absents).
 */
export function deriveViewMembers(rows, opts = {}) {
    const members = [];
    for (const row of rows) {
        if (row.attachmentType !== "tmux")
            continue;
        const seat = row.canonicalSessionName;
        if (!seat)
            continue;
        const tmuxSession = row.tmuxSession ?? row.canonicalSessionName;
        const agent = row.logicalId ?? seat;
        const label = opts.labelSuffix ? `${agent} · ${opts.labelSuffix}` : agent;
        members.push({
            seat,
            label,
            ...(row.runtime ? { runtime: row.runtime } : {}),
            tmuxSession,
            host: opts.host ?? null,
            readOnly: opts.readOnly === true,
            // Derived views are live: presence in the inventory IS the liveness
            // signal for the derived set; a stricter has-session probe layers on at
            // compose time for local members if the caller supplies one.
            alive: true,
        });
    }
    return members;
}
//# sourceMappingURL=terminal-views-store.js.map