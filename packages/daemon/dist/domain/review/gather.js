// Living Notes Packet 2 — the input gatherer (OPR.0.4.4.20).
//
// The impure shell around the pure composer: reads slice docs + proof
// artifacts from disk, attention/agent rows from SQLite, approval stamps
// from frontmatter (cross-checked against the Packet-1 audit-target
// contract), and git facts from the workspace's default repo. Every source
// that cannot be read degrades honestly (nulls / "unknown") — the composer
// renders the named degrade, never invented content.
import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import YAML from "yaml";
import { findFrontmatterBlock } from "../frontmatter.js";
import { sessionMemberLabel } from "../session-name.js";
import { parseScopeTags } from "../slices/qitem-membership.js";
import { composeMissionReview, composeRecordedGreenForSlice, composeSliceReview, deriveCandidateSha, extractMediaRefs, extractSection, } from "./compose.js";
import { composeAgentsBand, composeRigAgents } from "./compose.js";
import { runSyncSite } from "../sync-site-wrap.js";
import { readSliceReadiness, readMissionReadiness } from "../proof/judgments.js";
import { readProofArtifacts } from "./proof-io.js";
import { evaluateStepDeadline } from "../workflow-deadline.js";
import { isHumanSeatSession } from "../human-route-enforcer.js";
import { resolveNodeFileVia } from "../scope/node-file.js";
const ACTIVE_STATES = ["pending", "in-progress", "claimed", "blocked", "handed-off"];
/** OPR.0.4.6.WF4 Q6 — the ● (agent-leg) workflow-identity stamp, derived from
 *  the item's OWN STRUCTURED TAGS (`workflow:<name>` / `instance:<id>` /
 *  `step:<id>` — the WF-5-ratified queryable identity), NEVER from summary /
 *  identity / evidenceRef prose. Returns the pointer only when BOTH required
 *  keys are present; a non-workflow row (no `instance:`/`workflow:` tag) →
 *  `undefined`, so its AttentionInput stays byte-identical (omit-when-absent).
 *  Pointer-only: the three identity keys, never status/deadline/class. */
export function workflowRefFromTags(tagsJson) {
    if (!tagsJson)
        return undefined;
    let tags;
    try {
        tags = JSON.parse(tagsJson) ?? [];
    }
    catch {
        return undefined;
    }
    let instanceId;
    let workflowName;
    let stepId;
    for (const t of tags) {
        if (t.startsWith("instance:"))
            instanceId = t.slice("instance:".length);
        else if (t.startsWith("workflow:"))
            workflowName = t.slice("workflow:".length);
        else if (t.startsWith("step:"))
            stepId = t.slice("step:".length);
    }
    if (!instanceId || !workflowName)
        return undefined;
    return { instanceId, workflowName, ...(stepId ? { stepId } : {}) };
}
export class ReviewGatherer {
    db;
    indexer;
    gitRepoPath;
    activityStore;
    now;
    constructor(deps) {
        this.db = deps.db;
        this.indexer = deps.indexer;
        this.gitRepoPath = deps.gitRepoPath ?? null;
        this.activityStore = deps.activityStore ?? null;
        this.now = deps.now ?? (() => new Date().toISOString());
    }
    composeSlice(name) {
        const inputs = this.gatherSlice(name);
        return inputs ? composeSliceReview(inputs) : null;
    }
    /** Composition plus the on-disk context the freeze renderer needs (FR-6). */
    composeSliceWithContext(name) {
        const slice = this.indexer.get(name);
        const inputs = this.gatherSlice(name);
        if (!slice || !inputs)
            return null;
        return { composed: composeSliceReview(inputs), sliceDir: slice.slicePath, mediaRefs: inputs.mediaRefs };
    }
    composeMission(mission) {
        // qitem-ccf87c0d corrective — one mission compose is ONE composite
        // operation: the cold list() plus gatherSlice()->indexer.get() per
        // mission slice share ONE membership batch (pre-scope each uncached get
        // built its own 2-scan batch: 2+2N membership scans — 82 at 40 slices).
        return this.indexer.withMembershipBatch(() => this.composeMissionInBatch(mission));
    }
    composeMissionInBatch(mission) {
        const slices = this.indexer.list().filter((s) => s.missionId === mission);
        if (slices.length === 0 && !this.missionDirExists(mission))
            return null;
        const nowIso = this.now();
        // The ledger's recorded-verdict green rides beside each composed review
        // (FR-7): the gatherer holds the artifacts, so it derives the mission-
        // altitude completion fact the slice contract no longer carries (§11).
        const composed = slices
            .map((s) => {
            const inputs = this.gatherSlice(s.name);
            if (!inputs)
                return null;
            return {
                review: composeSliceReview(inputs),
                green: composeRecordedGreenForSlice(inputs.artifacts).green,
            };
        })
            .filter((s) => s !== null);
        const missionMeta = this.readMissionMeta(mission);
        return composeMissionReview({
            readiness: readMissionReadiness(path.join(this.indexer.slicesRoot, mission)),
            mission: { name: mission, id: missionMeta.id, title: missionMeta.title, intent: missionMeta.intent },
            slices: composed,
            missionAttention: this.attentionForTag(`mission:${mission}`, `slice:`),
            agents: this.agentsForSlices(slices.flatMap((s) => this.indexer.sliceTagKeys(s.name)), { missionName: mission }),
            nowIso,
        });
    }
    /**
     * OPR.0.4.4.22 — the composed rig-agents read root (FR-1..FR-4): NEEDS
     * YOU + AGENTS (health line) + SETTLED at rig scope. Pure projection over
     * queue + hook-activity; nothing contacts an agent. The roster is
     * active-holders UNION recently-holding (transitions-on-scope-TODAY — the
     * plan-review-ruled display window, named in provenance).
     */
    composeRig() {
        const nowIso = this.now();
        const todayStart = `${nowIso.slice(0, 10)}T00:00:00.000Z`;
        const agents = this.withTelemetry(this.rigRoster(todayStart), nowIso);
        const attention = this.attentionAll();
        const overdue = this.overdueWork(nowIso);
        const { settled, handoffsToday } = this.settledToday(todayStart);
        return composeRigAgents({
            agents,
            overdue,
            attention,
            settled,
            handoffsToday,
            overdueCount: overdue.length,
            rosterWindow: "today",
            workflows: this.gatherWorkflowExceptions(nowIso),
            nowIso,
        });
    }
    /** The scope-parameterized agents projection — ONE contract, all consumers. */
    composeAgents(scope) {
        const nowIso = this.now();
        if (scope === "rig") {
            return composeAgentsBand(this.agentsForSlices(null), scope, [], nowIso);
        }
        if (scope.startsWith("slice:")) {
            const name = scope.slice("slice:".length);
            if (!this.indexer.get(name))
                return null;
            return composeAgentsBand(this.agentsForSlices(this.indexer.sliceTagKeys(name)), scope, [], nowIso);
        }
        const mission = scope.slice("mission:".length);
        const slices = this.indexer.list().filter((s) => s.missionId === mission);
        if (slices.length === 0 && !this.missionDirExists(mission))
            return null;
        // C3 (pm ruling i): mission-tag-DIRECT membership — `mission:X`-tagged
        // active work counts even when its slice tag isn't indexed, so a
        // dir-exists/zero-indexed mission no longer composes a confident-empty
        // band from an always-empty name list.
        return composeAgentsBand(this.agentsForSlices(slices.flatMap((s) => this.indexer.sliceTagKeys(s.name)), { missionName: mission }), scope, [], nowIso);
    }
    // -------------------------------------------------------------------------
    gatherSlice(name) {
        const slice = this.indexer.get(name);
        if (!slice)
            return null;
        const nodeFile = resolveNodeFileVia(slice.slicePath, (p) => this.readFile(p));
        const readme = nodeFile?.content ?? null;
        const prd = this.readFile(path.join(slice.slicePath, "IMPLEMENTATION-PRD.md"));
        const proofMd = this.readFile(path.join(slice.slicePath, "PROOF.md"));
        const artifacts = readProofArtifacts(slice.slicePath);
        const tagKeys = this.indexer.sliceTagKeys(name);
        const attention = this.attentionForTag(`slice:${name}`);
        const agents = this.agentsForSlices(tagKeys);
        const frontmatter = this.parseFrontmatter(readme);
        const approval = this.gatherApproval(slice, frontmatter);
        const candidateRef = deriveCandidateSha(artifacts);
        return {
            slice: {
                name: slice.name,
                id: typeof frontmatter["id"] === "string" ? frontmatter["id"] : null,
                title: slice.displayName,
                missionId: slice.missionId,
            },
            readme,
            nodeFileName: nodeFile ? path.basename(nodeFile.path) : undefined,
            prd,
            proofMd,
            artifacts,
            readiness: readSliceReadiness(slice.slicePath),
            lockedArtifacts: this.parseLockedArtifacts(frontmatter),
            mediaRefs: this.collectMediaRefs([readme, prd, proofMd]),
            proofDirExists: fs.existsSync(path.join(slice.slicePath, "proof")),
            attention,
            agents,
            workflows: this.gatherWorkflowExceptions(this.now()),
            activeQitemPresent: this.hasActiveQitem(name),
            git: this.gatherGitFacts(frontmatter, candidateRef),
            approval,
            nowIso: this.now(),
        };
    }
    /** §3.1's ONLY genuinely new datum: the pinned plan set, a frontmatter READ
     *  (`locked-artifacts:` list on the slice README — the scope-fs pattern,
     *  zero new file kinds, zero new write machinery). Malformed entries are
     *  skipped, never invented. */
    parseLockedArtifacts(fm) {
        const raw = fm["locked-artifacts"];
        if (!Array.isArray(raw))
            return [];
        const out = [];
        for (const entry of raw) {
            if (entry === null || typeof entry !== "object")
                continue;
            const e = entry;
            const p = typeof e["path"] === "string" ? e["path"].trim() : "";
            if (!p)
                continue;
            out.push({
                name: typeof e["name"] === "string" && e["name"].trim() ? e["name"].trim() : p,
                path: p,
                kind: typeof e["kind"] === "string" && e["kind"].trim() ? e["kind"].trim() : "artifact",
            });
        }
        return out;
    }
    readFile(p) {
        try {
            return fs.readFileSync(p, "utf8");
        }
        catch {
            return null;
        }
    }
    missionDirExists(mission) {
        // The indexer knows slices; a slice-less mission still composes (empty board).
        return this.indexer.list().some((s) => s.missionId === mission);
    }
    readMissionMeta(mission) {
        const anySlice = this.indexer.list().find((s) => s.missionId === mission);
        if (anySlice) {
            const missionDir = path.dirname(path.dirname(anySlice.slicePath));
            const readme = resolveNodeFileVia(missionDir, (p) => this.readFile(p))?.content ?? null;
            const fm = this.parseFrontmatter(readme);
            // FR-8: the brief's "What & why" projects VERBATIM as the intent opener.
            const brief = this.readFile(path.join(missionDir, "MISSION_BRIEF.md"));
            return {
                id: typeof fm["id"] === "string" ? fm["id"] : null,
                title: typeof fm["title"] === "string" ? fm["title"] : mission,
                intent: extractSection(brief, "What & why"),
                missionDir,
            };
        }
        return { id: null, title: mission, intent: null, missionDir: null };
    }
    /** FR-8 freeze-moment brief write target: {absolute path, current content}. */
    missionBriefTarget(mission) {
        const meta = this.readMissionMeta(mission);
        if (!meta.missionDir)
            return null;
        const briefPath = path.join(meta.missionDir, "MISSION_BRIEF.md");
        const content = this.readFile(briefPath);
        return content === null ? null : { briefPath, content };
    }
    parseFrontmatter(content) {
        if (!content)
            return {};
        const block = findFrontmatterBlock(content);
        if (!block)
            return {};
        try {
            return (YAML.parse(block.yaml) ?? {});
        }
        catch {
            return {};
        }
    }
    // VM-006 (A1): readProofArtifacts moved VERBATIM to ./proof-io.ts — the one
    // home shared with the slice-detail projector; gather delegates to it.
    /** Markdown image/video refs across the composed sources (FR-5 defect scan). */
    collectMediaRefs(sources) {
        return sources.flatMap((s) => extractMediaRefs(s));
    }
    tableExists(name) {
        try {
            const row = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name);
            return row !== undefined;
        }
        catch {
            return false;
        }
    }
    columnExists(table, column) {
        try {
            const rows = this.db.prepare(`PRAGMA table_info(${table})`).all();
            return rows.some((r) => r.name === column);
        }
        catch {
            return false;
        }
    }
    /** Human-routed attention rows carrying the given tag (the §5 predicate is
     *  Packet 1's; until it lands, human-tier/human-dest/park-on-human rows are
     *  selected with the same shape). */
    /** OPR.0.4.6.WF5 FR-3 — recorded workflow-instance views for the ▲
     *  band: failed + in-flight instances, the WF-1 evaluator verdict
     *  (consumed, never recomputed — the module import IS the single
     *  home), the open exception item by TAG QUERY (never summary
     *  parsing), and the non-open-frontier anomaly check. Read-only;
     *  absent tables (pre-workflow DBs) return []. */
    gatherWorkflowExceptions(nowIso) {
        try {
            const instances = this.db
                .prepare(`SELECT instance_id, workflow_name, status, current_step_id, current_frontier_json
           FROM workflow_instances WHERE status IN ('failed','active','waiting')`)
                .all();
            const now = new Date(nowIso);
            const out = [];
            for (const row of instances) {
                let frontier = [];
                try {
                    frontier = JSON.parse(row.current_frontier_json) ?? [];
                }
                catch {
                    frontier = [];
                }
                const packets = frontier.map((id) => this.db
                    .prepare(`SELECT qitem_id, state, destination_session, ts_created, claimed_at, closure_required_at
                 FROM queue_items WHERE qitem_id = ?`)
                    .get(id));
                const frontierRefsNonOpenPacket = (row.status === "active" || row.status === "waiting") &&
                    packets.some((p) => p && !["pending", "in-progress", "blocked"].includes(p.state));
                const verdict = evaluateStepDeadline({
                    instanceId: row.instance_id,
                    status: row.status,
                    currentFrontier: frontier,
                    currentStepId: row.current_step_id,
                }, packets.map((p) => p
                    ? {
                        qitemId: p.qitem_id,
                        state: p.state,
                        destinationSession: p.destination_session,
                        tsCreated: p.ts_created,
                        claimedAt: p.claimed_at,
                        closureRequiredAt: p.closure_required_at,
                    }
                    : null), now);
                const item = this.db
                    .prepare(`SELECT qitem_id, destination_session, tier, ts_created, summary
             FROM queue_items
             WHERE state IN ('pending','in-progress','blocked')
               AND tags LIKE ? AND tags LIKE ?
             ORDER BY ts_created DESC LIMIT 1`)
                    .get(`%"instance:${row.instance_id}"%`, `%"workflow-exception"%`);
                out.push({
                    instanceId: row.instance_id,
                    workflowName: row.workflow_name,
                    status: row.status,
                    currentStepId: row.current_step_id,
                    deadlineState: verdict.state,
                    deadlineEvidence: verdict.evidence
                        ? `step ${verdict.evidence.stepId ?? "?"} packet ${verdict.evidence.packetId} held by ${verdict.evidence.ownerSession} — ${verdict.evidence.overdueBySeconds}s past the ${verdict.evidence.anchor} anchor`
                        : null,
                    frontierRefsNonOpenPacket,
                    openItem: item
                        ? {
                            qitemId: item.qitem_id,
                            destinationSession: item.destination_session,
                            humanRouted: item.tier === "human-gate" || /^human(?:-[A-Za-z0-9._-]+)?@(kernel|host)$/.test(item.destination_session),
                            createdAtIso: item.ts_created,
                            summary: item.summary,
                        }
                        : null,
                });
            }
            return out;
        }
        catch (err) {
            // Pre-workflow DBs (no tables) compose byte-identically to
            // pre-WF-5; anything else fails LOUD (the WF-3 narrowed-catch
            // lesson — a broad catch here would silently blind the band).
            if (err instanceof Error && /no such table/i.test(err.message))
                return [];
            throw err;
        }
    }
    attentionForTag(tag, excludeTagPrefix) {
        if (!this.tableExists("queue_items"))
            return [];
        // Canonical membership: parse the queried tag once; the SQL LIKE is an
        // unquoted PREFILTER (now catches comma-legacy rows), and parseScopeTags
        // is the authoritative row-level confirm (rejects the prefilter's
        // substring/suffix over-matches). attentionForTag's real defect was the
        // comma-legacy UNDER-match — the old JSON-quoted `%"slice:X"%` never
        // appears inside a comma-joined element.
        const tagIsSlice = tag.startsWith("slice:");
        const tagIsMission = tag.startsWith("mission:");
        const tagName = tagIsSlice
            ? tag.slice("slice:".length)
            : tagIsMission
                ? tag.slice("mission:".length)
                : null;
        // A slice answers to its directory name and its frontmatter id alike.
        const sliceKeys = tagIsSlice ? this.indexer.sliceTagKeys(tagName) : [];
        const likeKeys = tagIsSlice ? sliceKeys.map((key) => `slice:${key}`) : [tag];
        const hasEvidenceRef = this.columnExists("queue_items", "evidence_ref");
        const summaryCol = this.columnExists("queue_items", "summary") ? "summary" : "NULL AS summary";
        const rows = this.db
            .prepare(`SELECT qitem_id, ts_created, ts_updated, destination_session, state, priority, tier, tags, ${summaryCol},
                blocked_on, closure_required_at${hasEvidenceRef ? ", evidence_ref" : ""}
         FROM queue_items
         WHERE state IN (${ACTIVE_STATES.map(() => "?").join(",")})
           AND (${likeKeys.map(() => "tags LIKE ?").join(" OR ")})
           AND (tier = 'human-gate'
                OR destination_session LIKE 'human%'
                OR (state = 'blocked' AND blocked_on LIKE 'human%'))`)
            .all(...ACTIVE_STATES, ...likeKeys.map((key) => `%${key}%`));
        return rows
            .filter((r) => {
            // Row-level canonical confirm (authoritative over the prefilter).
            const scopes = parseScopeTags(r.tags);
            if (tagIsSlice && !sliceKeys.some((key) => scopes.slices.has(key)))
                return false;
            if (tagIsMission && !scopes.missions.has(tagName))
                return false;
            // d2: excludeTagPrefix aligned to the canonical set (its documented
            // intent — "rows that carry a slice tag") so comma-legacy rows are
            // excluded like clean ones; unknown prefixes keep raw semantics.
            if (excludeTagPrefix === "slice:")
                return scopes.slices.size === 0;
            if (excludeTagPrefix) {
                try {
                    const tags = JSON.parse(r.tags ?? "[]") ?? [];
                    return !tags.some((t) => t.startsWith(excludeTagPrefix));
                }
                catch {
                    return true;
                }
            }
            return true;
        })
            .map((r) => {
            // OPR.0.4.6.WF4 Q6 — stamp the ● workflow pointer from the item's own
            // tags; OMITTED for non-workflow rows (byte-identity-by-omission).
            const workflow = workflowRefFromTags(r.tags);
            return {
                qitemId: r.qitem_id,
                summary: r.summary,
                leg: r.state === "blocked" ? "park-on-human" : "human-routed",
                where: r.destination_session,
                createdAtIso: r.ts_created,
                priority: r.priority,
                tier: r.tier,
                evidenceRef: r.evidence_ref ?? null,
                unblocks: r.state === "blocked" ? r.qitem_id : null,
                destinationSession: r.destination_session,
                closureRequiredAtIso: r.closure_required_at,
                ...(workflow ? { workflow } : {}),
            };
        });
    }
    /** Sessions holding active work on the slices named by `sliceTags`: each slice's
     *  directory name and frontmatter id (null = rig-wide).
     *  Region membership derives from work-on-scope, never rig co-residency.
     *  Runtime/idle telemetry is honest-unknown at v1 (queue-derived only). */
    agentsForSlices(sliceTags, opts = {}) {
        const missionName = opts.missionName ?? null;
        if (!this.tableExists("queue_items"))
            return [];
        const summaryCol = this.columnExists("queue_items", "summary") ? "summary" : "NULL AS summary";
        const rows = this.db
            .prepare(`SELECT qitem_id, ts_created, ts_updated, destination_session, state, priority, tier, tags, ${summaryCol},
                blocked_on, closure_required_at
         FROM queue_items
         WHERE state IN (${ACTIVE_STATES.map(() => "?").join(",")})`)
            .all(...ACTIVE_STATES);
        const bySession = new Map();
        for (const r of rows) {
            if (isHumanSeatSession(r.destination_session))
                continue;
            const scopes = parseScopeTags(r.tags);
            const rowSlices = [...scopes.slices];
            // Membership (canonical): a row belongs when it carries one of the
            // named slices OR — for the mission band (C3, pm ruling i) — the
            // mission tag directly, so `mission:X`-tagged work counts even when
            // its slice tag isn't indexed. missionName is null for rig/slice
            // flows (byte-identical to pre-fix).
            if (sliceTags !== null &&
                !rowSlices.some((s) => sliceTags.includes(s)) &&
                !(missionName !== null && scopes.missions.has(missionName)))
                continue;
            const entry = bySession.get(r.destination_session) ?? { rows: [], slices: new Set() };
            entry.rows.push(r);
            for (const s of rowSlices)
                entry.slices.add(s);
            bySession.set(r.destination_session, entry);
        }
        return [...bySession.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([session, e]) => {
            const latest = e.rows.reduce((acc, r) => (r.ts_updated > acc.ts_updated ? r : acc), e.rows[0]);
            const parked = e.rows
                .filter((r) => !!r.blocked_on)
                .reduce((acc, r) => (!acc || r.ts_updated > acc.ts_updated ? r : acc), null);
            return {
                agentName: sessionMemberLabel(session), // OPR.0.4.6.MH1 FR-8: shared contract
                sessionName: session,
                runtime: "unknown",
                parkedOn: parked?.blocked_on ?? null,
                idle: null, // honest-unknown: queue rows alone cannot prove liveness
                idleSinceIso: null,
                doing: parked?.summary ?? latest.summary,
                holdsCount: e.rows.length,
                lastTransitionIso: (parked ?? latest).ts_updated,
                slices: [...e.slices].sort(),
            };
        });
    }
    // --- OPR.0.4.4.22 rig-scope helpers (all synchronous SQLite reads) ---
    /** FR-1 roster: agents HOLDING active work on any slice-tagged item, UNION
     *  agents RECENTLY holding (their slice-tagged items transitioned today —
     *  the ruled display window). Membership derives from work-on-scope,
     *  never rig co-residency. */
    rigRoster(todayStartIso) {
        const holders = this.agentsForSlices(null);
        if (!this.tableExists("queue_items"))
            return holders;
        const summaryCol = this.columnExists("queue_items", "summary") ? "summary" : "NULL AS summary";
        // Recently-holding: destination of a slice-tagged qitem whose latest
        // update landed today but is no longer in an active state.
        const rows = this.db
            .prepare(`SELECT qitem_id, ts_created, ts_updated, destination_session, state, priority, tier, tags, ${summaryCol},
                blocked_on, closure_required_at
         FROM queue_items
         WHERE ts_updated >= ?
           AND state NOT IN (${ACTIVE_STATES.map(() => "?").join(",")})
           AND tags LIKE '%"slice:%'`)
            .all(todayStartIso, ...ACTIVE_STATES);
        const known = new Set(holders.map((h) => h.sessionName));
        const recent = new Map();
        for (const r of rows) {
            if (isHumanSeatSession(r.destination_session))
                continue;
            if (known.has(r.destination_session))
                continue;
            let tags = [];
            try {
                tags = JSON.parse(r.tags ?? "[]") ?? [];
            }
            catch {
                tags = [];
            }
            const rowSlices = tags.filter((t) => t.startsWith("slice:")).map((t) => t.slice("slice:".length));
            if (rowSlices.length === 0)
                continue;
            const entry = recent.get(r.destination_session) ?? { latest: r, slices: new Set() };
            if (r.ts_updated > entry.latest.ts_updated)
                entry.latest = r;
            for (const s of rowSlices)
                entry.slices.add(s);
            recent.set(r.destination_session, entry);
        }
        const recentInputs = [...recent.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([session, e]) => ({
            agentName: sessionMemberLabel(session), // OPR.0.4.6.MH1 FR-8: shared contract
            sessionName: session,
            runtime: "unknown",
            parkedOn: null,
            idle: null,
            idleSinceIso: null,
            // FR-1: an agent with no tracked ACTIVE item renders the truth —
            // itself a coordination signal; nothing is invented.
            doing: "no tracked work item",
            holdsCount: 0,
            lastTransitionIso: e.latest.ts_updated,
            slices: [...e.slices].sort(),
        }));
        return [...holders, ...recentInputs].sort((a, b) => a.sessionName.localeCompare(b.sessionName));
    }
    /** FR-2 telemetry enrichment: runtime from the sessions/nodes tables, the
     *  active/idle light from recorded hook activity (AgentActivityStore).
     *  Anything unprovable stays honest-unknown — never guessed. */
    withTelemetry(agents, nowIso) {
        const runtimes = this.sessionRuntimes();
        return agents.map((a) => {
            const runtime = runtimes.get(a.sessionName) ?? "unknown";
            let idle = a.idle;
            let idleSinceIso = a.idleSinceIso;
            if (this.activityStore) {
                try {
                    const activity = this.activityStore.getLatestForNode({ sessionName: a.sessionName, now: new Date(nowIso) });
                    if (activity?.state === "running") {
                        idle = false;
                        idleSinceIso = null;
                    }
                    else if (activity?.state === "idle") {
                        idle = true;
                        idleSinceIso = activity.eventAt ?? activity.sampledAt ?? null;
                    }
                    // needs_input / unknown / null → stays honest-unknown.
                }
                catch {
                    // Telemetry read failure = unknown, never a guess.
                }
            }
            const normalizedRuntime = runtime === "claude-code" || runtime === "codex" || runtime === "terminal" ? runtime : "unknown";
            return { ...a, runtime: normalizedRuntime, idle, idleSinceIso };
        });
    }
    sessionRuntimes() {
        const out = new Map();
        if (!this.tableExists("sessions") || !this.tableExists("nodes"))
            return out;
        try {
            const rows = this.db
                .prepare(`SELECT s.session_name AS session_name, n.runtime AS runtime
           FROM sessions s JOIN nodes n ON n.id = s.node_id
           WHERE s.session_name IS NOT NULL`)
                .all();
            for (const r of rows)
                if (r.runtime)
                    out.set(r.session_name, r.runtime);
        }
        catch {
            /* degrade to unknown runtimes */
        }
        return out;
    }
    /** Rig-scope NEEDS YOU: ALL human-routed active items (no tag filter). */
    attentionAll() {
        if (!this.tableExists("queue_items"))
            return [];
        const hasEvidenceRef = this.columnExists("queue_items", "evidence_ref");
        const summaryCol = this.columnExists("queue_items", "summary") ? "summary" : "NULL AS summary";
        const rows = this.db
            .prepare(`SELECT qitem_id, ts_created, ts_updated, destination_session, state, priority, tier, tags, ${summaryCol},
                blocked_on, closure_required_at${hasEvidenceRef ? ", evidence_ref" : ""}
         FROM queue_items
         WHERE state IN (${ACTIVE_STATES.map(() => "?").join(",")})
           AND (tier = 'human-gate'
                OR destination_session LIKE 'human%'
                OR (state = 'blocked' AND blocked_on LIKE 'human%'))`)
            .all(...ACTIVE_STATES);
        return rows.map((r) => {
            // OPR.0.4.6.WF4 Q6 — stamp the ● workflow pointer from the item's own
            // tags; OMITTED for non-workflow rows (byte-identity-by-omission).
            const workflow = workflowRefFromTags(r.tags);
            return {
                qitemId: r.qitem_id,
                summary: r.summary,
                leg: r.state === "blocked" ? "park-on-human" : "human-routed",
                where: r.destination_session,
                createdAtIso: r.ts_created,
                priority: r.priority,
                tier: r.tier,
                evidenceRef: r.evidence_ref ?? null,
                unblocks: r.state === "blocked" ? r.qitem_id : null,
                destinationSession: r.destination_session,
                closureRequiredAtIso: r.closure_required_at,
                ...(workflow ? { workflow } : {}),
            };
        });
    }
    /** FR-4: today's closed handoffs from the transitions log — the SETTLED
     *  band and the health line's handoff count come from the SAME query
     *  (two renders, one computation). */
    settledToday(todayStartIso) {
        if (!this.tableExists("queue_transitions"))
            return { settled: [], handoffsToday: 0 };
        const summaryJoin = this.tableExists("queue_items") && this.columnExists("queue_items", "summary")
            ? "LEFT JOIN queue_items q ON q.qitem_id = t.qitem_id"
            : null;
        try {
            const rows = this.db
                .prepare(`SELECT t.qitem_id AS qitem_id, t.ts AS ts, t.actor_session AS actor_session,
                  t.closure_target AS closure_target${summaryJoin ? ", q.summary AS summary" : ", NULL AS summary"}
           FROM queue_transitions t
           ${summaryJoin ?? ""}
           WHERE t.closure_reason = 'handed_off_to' AND t.ts >= ?
           ORDER BY t.ts DESC`)
                .all(todayStartIso);
            const settled = rows.map((r) => ({
                fromSession: r.actor_session,
                toSession: r.closure_target ?? "unknown",
                summary: r.summary,
                closedAtIso: r.ts,
                qitemId: r.qitem_id,
            }));
            return { settled, handoffsToday: settled.length };
        }
        catch {
            return { settled: [], handoffsToday: 0 };
        }
    }
    /** FR-3/FR-4: in-progress slice work past closure_required_at, rig-wide.
     *  Feeds both the derived NEEDS YOU exception and the health count. */
    overdueWork(nowIso) {
        if (!this.tableExists("queue_items"))
            return [];
        try {
            const summaryCol = this.columnExists("queue_items", "summary") ? "summary" : "NULL AS summary";
            const rows = this.db
                .prepare(`SELECT qitem_id, ts_created, ts_updated, destination_session, state, priority, tier, tags, ${summaryCol},
                  blocked_on, closure_required_at
           FROM queue_items
           WHERE state = 'in-progress'
             AND closure_required_at IS NOT NULL
             AND closure_required_at < ?
             AND tags LIKE '%"slice:%'`)
                .all(nowIso);
            return rows.map((r) => {
                // OPR.0.4.6.WF4 Q6 — stamp the ● workflow pointer from the item's own
                // tags; OMITTED for non-workflow rows (byte-identity-by-omission).
                const workflow = workflowRefFromTags(r.tags);
                return {
                    qitemId: r.qitem_id,
                    summary: r.summary,
                    leg: "overdue",
                    where: r.destination_session,
                    createdAtIso: r.ts_created,
                    priority: r.priority,
                    tier: r.tier,
                    evidenceRef: null,
                    unblocks: null,
                    destinationSession: r.destination_session,
                    closureRequiredAtIso: r.closure_required_at,
                    ...(workflow ? { workflow } : {}),
                };
            });
        }
        catch {
            return [];
        }
    }
    hasActiveQitem(name) {
        if (!this.tableExists("queue_items"))
            return false;
        // TWO-TIER DOCTRINE: this is a SIGNAL-tier answer (phase / band /
        // attention) — it answers from canonical membership ONLY. The DISPLAY
        // tier (the queue-tab's qitemIds) may carry the gated legacy substring
        // fallback; never promote a display-tier match into a signal. (P3)
        //
        // B1 fix: the qitemIds (leg 2) membership check is DROPPED. It inherited
        // matchQitems' sanctioned legacy substring/body fallback, so in a
        // zero-typed corpus a body-mention-only row promoted activeQitemPresent
        // to true (phase BUILD) while the strict band was empty — the exact
        // one-compose-two-answers divergence this slice kills. Equivalence: any
        // canonically-confirmable row necessarily contains the literal
        // `slice:<name>` substring (P1 construction), so leg 1's UNTRUNCATED
        // prefilter finds every canonical member; leg 2 could only ever ADD
        // non-canonical (display-tier) ids — precisely the class that must not
        // reach the phase signal.
        //
        // Leg 1 streams: iterate() + break on the FIRST canonical confirm. NO SQL
        // LIMIT — a pre-confirmation LIMIT would recreate B2 here (a suffix-storm
        // could hide the true member and flip the phase signal); streaming + break
        // gives the same bounded cost with no truncation hole.
        const keys = this.indexer.sliceTagKeys(name);
        const stmt = this.db.prepare(`SELECT tags FROM queue_items WHERE state IN (${ACTIVE_STATES.map(() => "?").join(",")}) AND (${keys.map(() => "tags LIKE ?").join(" OR ")})`);
        for (const r of stmt.iterate(...ACTIVE_STATES, ...keys.map((key) => `%slice:${key}%`))) {
            const tagged = parseScopeTags(r.tags).slices;
            if (keys.some((key) => tagged.has(key)))
                return true;
        }
        return false;
    }
    /** §4 — the two staged-approval stamps (arch F-A: the SHIPPED verb's
     *  frontmatter fields), each cross-checked against the pinned
     *  scope-approval audit shape (`approval_scope` inside audit_notes_json).
     *  A stamp with no matching row -> auditVerified false (UNVERIFIED stamp,
     *  rendered loudly — never a block). */
    gatherApproval(slice, fm) {
        const str = (k) => {
            const v = fm[k];
            if (typeof v === "string" && v.trim())
                return v.trim();
            if (v instanceof Date)
                return v.toISOString();
            return null;
        };
        const sliceId = str("id");
        const auditRowPresent = (approvalScope) => {
            if (!this.tableExists("mission_control_actions"))
                return false;
            try {
                return (this.db
                    .prepare(`SELECT 1 FROM mission_control_actions
               WHERE action_verb='approve'
                 AND audit_notes_json LIKE ?
                 AND (audit_notes_json LIKE ? OR audit_notes_json LIKE ?)
               LIMIT 1`)
                    .get(`%"approval_scope":"${approvalScope}"%`, 
                // A null slice id must never match an empty scope_id row.
                sliceId ? `%"scope_id":"${sliceId}"%` : `%"scope_id":"${slice.name}"%`, `%${slice.name}%`) !== undefined);
            }
            catch {
                return false;
            }
        };
        const stamp = (byKey, atKey, approvalScope) => {
            const by = str(byKey);
            const at = str(atKey);
            if (!by || !at)
                return null;
            return { by, at, auditRowPresent: auditRowPresent(approvalScope) };
        };
        return {
            spec: stamp("approved-spec-by", "approved-spec-at", "spec"),
            delivery: stamp("approved-by", "approved-at", "delivery"),
        };
    }
    git(args) {
        const gitRepoPath = this.gitRepoPath;
        if (!gitRepoPath)
            return null;
        try {
            return runSyncSite("review.gather.git", () => execFileSync("git", args, { cwd: gitRepoPath, timeout: 4000, encoding: "utf8" })).trim();
        }
        catch {
            return null;
        }
    }
    gatherGitFacts(fm, candidateSha) {
        const mainTip = this.git(["rev-parse", "--short", "HEAD"]) ?? "unknown";
        const sliceId = typeof fm["id"] === "string" ? fm["id"] : null;
        let mergeSha = null;
        if (sliceId) {
            const found = this.git(["log", "--fixed-strings", `--grep=Merge ${sliceId}`, "--format=%h", "-1"]);
            mergeSha = found && found.length > 0 ? found : null;
        }
        let mergeIsAncestorOfTip = null;
        if (mergeSha) {
            const out = this.git(["merge-base", "--is-ancestor", mergeSha, "HEAD"]);
            // exec throws (returns null) on non-ancestor exit 1; success returns "".
            mergeIsAncestorOfTip = out !== null;
        }
        let candidateBehindTip = null;
        if (!mergeSha && candidateSha) {
            const base = this.git(["merge-base", candidateSha, "HEAD"]);
            if (base) {
                const count = this.git(["rev-list", "--count", `${base}..HEAD`]);
                candidateBehindTip = count !== null && /^\d+$/.test(count) ? Number(count) : null;
            }
        }
        return { mainTip, mergeSha, mergeIsAncestorOfTip, candidateBehindTip };
    }
}
//# sourceMappingURL=gather.js.map