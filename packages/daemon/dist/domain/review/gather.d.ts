import type Database from "better-sqlite3";
import type { SliceIndexer } from "../slices/slice-indexer.js";
import { type SliceComposeInputs } from "./compose.js";
import type { AgentsBand, AgentsScope, ComposedMissionReview, ComposedRigAgents, ComposedSliceReview, WorkflowRowRef } from "./types.js";
import type { AgentActivityStore } from "../agent-activity-store.js";
export interface ReviewGathererDeps {
    db: Database.Database;
    indexer: SliceIndexer;
    /** Repo path for git lineage facts (the workspace default repo); null = degrade to unknown. */
    gitRepoPath?: string | null;
    /** OPR.0.4.4.22 — hook-activity reads for the agent state glyph (FR-2).
     *  Optional: absent → every glyph degrades to honest `unknown` (never
     *  guessed). Synchronous SQLite reads; no polling, no agent contact. */
    activityStore?: AgentActivityStore | null;
    /** Injected clock so composition stays reproducible in tests. */
    now?: () => string;
}
/** OPR.0.4.6.WF4 Q6 — the ● (agent-leg) workflow-identity stamp, derived from
 *  the item's OWN STRUCTURED TAGS (`workflow:<name>` / `instance:<id>` /
 *  `step:<id>` — the WF-5-ratified queryable identity), NEVER from summary /
 *  identity / evidenceRef prose. Returns the pointer only when BOTH required
 *  keys are present; a non-workflow row (no `instance:`/`workflow:` tag) →
 *  `undefined`, so its AttentionInput stays byte-identical (omit-when-absent).
 *  Pointer-only: the three identity keys, never status/deadline/class. */
export declare function workflowRefFromTags(tagsJson: string | null): WorkflowRowRef | undefined;
export declare class ReviewGatherer {
    private readonly db;
    private readonly indexer;
    private readonly gitRepoPath;
    private readonly activityStore;
    private readonly now;
    constructor(deps: ReviewGathererDeps);
    composeSlice(name: string): ComposedSliceReview | null;
    /** Composition plus the on-disk context the freeze renderer needs (FR-6). */
    composeSliceWithContext(name: string): {
        composed: ComposedSliceReview;
        sliceDir: string;
        mediaRefs: string[];
    } | null;
    composeMission(mission: string): ComposedMissionReview | null;
    private composeMissionInBatch;
    /**
     * OPR.0.4.4.22 — the composed rig-agents read root (FR-1..FR-4): NEEDS
     * YOU + AGENTS (health line) + SETTLED at rig scope. Pure projection over
     * queue + hook-activity; nothing contacts an agent. The roster is
     * active-holders UNION recently-holding (transitions-on-scope-TODAY — the
     * plan-review-ruled display window, named in provenance).
     */
    composeRig(): ComposedRigAgents;
    /** The scope-parameterized agents projection — ONE contract, all consumers. */
    composeAgents(scope: AgentsScope): AgentsBand | null;
    gatherSlice(name: string): SliceComposeInputs | null;
    /** §3.1's ONLY genuinely new datum: the pinned plan set, a frontmatter READ
     *  (`locked-artifacts:` list on the slice README — the scope-fs pattern,
     *  zero new file kinds, zero new write machinery). Malformed entries are
     *  skipped, never invented. */
    private parseLockedArtifacts;
    private readFile;
    private missionDirExists;
    private readMissionMeta;
    /** FR-8 freeze-moment brief write target: {absolute path, current content}. */
    missionBriefTarget(mission: string): {
        briefPath: string;
        content: string;
    } | null;
    private parseFrontmatter;
    /** Markdown image/video refs across the composed sources (FR-5 defect scan). */
    private collectMediaRefs;
    private tableExists;
    private columnExists;
    /** Human-routed attention rows carrying the given tag (the §5 predicate is
     *  Packet 1's; until it lands, human-tier/human-dest/park-on-human rows are
     *  selected with the same shape). */
    /** OPR.0.4.6.WF5 FR-3 — recorded workflow-instance views for the ▲
     *  band: failed + in-flight instances, the WF-1 evaluator verdict
     *  (consumed, never recomputed — the module import IS the single
     *  home), the open exception item by TAG QUERY (never summary
     *  parsing), and the non-open-frontier anomaly check. Read-only;
     *  absent tables (pre-workflow DBs) return []. */
    private gatherWorkflowExceptions;
    private attentionForTag;
    /** Sessions holding active work on the slices named by `sliceTags`: each slice's
     *  directory name and frontmatter id (null = rig-wide).
     *  Region membership derives from work-on-scope, never rig co-residency.
     *  Runtime/idle telemetry is honest-unknown at v1 (queue-derived only). */
    private agentsForSlices;
    /** FR-1 roster: agents HOLDING active work on any slice-tagged item, UNION
     *  agents RECENTLY holding (their slice-tagged items transitioned today —
     *  the ruled display window). Membership derives from work-on-scope,
     *  never rig co-residency. */
    private rigRoster;
    /** FR-2 telemetry enrichment: runtime from the sessions/nodes tables, the
     *  active/idle light from recorded hook activity (AgentActivityStore).
     *  Anything unprovable stays honest-unknown — never guessed. */
    private withTelemetry;
    private sessionRuntimes;
    /** Rig-scope NEEDS YOU: ALL human-routed active items (no tag filter). */
    private attentionAll;
    /** FR-4: today's closed handoffs from the transitions log — the SETTLED
     *  band and the health line's handoff count come from the SAME query
     *  (two renders, one computation). */
    private settledToday;
    /** FR-3/FR-4: in-progress slice work past closure_required_at, rig-wide.
     *  Feeds both the derived NEEDS YOU exception and the health count. */
    private overdueWork;
    private hasActiveQitem;
    /** §4 — the two staged-approval stamps (arch F-A: the SHIPPED verb's
     *  frontmatter fields), each cross-checked against the pinned
     *  scope-approval audit shape (`approval_scope` inside audit_notes_json).
     *  A stamp with no matching row -> auditVerified false (UNVERIFIED stamp,
     *  rendered loudly — never a block). */
    private gatherApproval;
    private git;
    private gatherGitFacts;
}
//# sourceMappingURL=gather.d.ts.map