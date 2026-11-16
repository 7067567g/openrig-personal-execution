import type { ScopeReadiness, MissionReadiness } from "../proof/judgments.js";
import { type AgentRow, type AgentsBand, type AgentsScope, type C1ArtifactType, type C1Verdict, type ComposedMissionReview, type ComposedRigAgents, type ComposedSliceReview, type DeliveredItem, type LockState, type LockedArtifact, type NeedsYouBand, type NeedsYouItem, type WorkflowRowRef, type ProofArtifact, type ReviewMedia, type ReviewPhase, type SettledRow, type VerdictCell, type VerifyLineage } from "./types.js";
import { parseLogicalCheckboxes, type LogicalCheckboxItem } from "../scope/logical-checkbox.js";
export declare const IDLE_WITH_WORK_THRESHOLD_MIN = 30;
export declare function mediaKind(ref: string): ReviewMedia["kind"] | null;
/** Markdown/HTML media refs in a source string (http(s) refs excluded —
 *  media is co-located slice content, FR-5). */
export declare function extractMediaRefs(markdown: string | null): string[];
/** Normalizes a media ref written relative to `baseDir` (slice-relative "")
 *  into a slice-relative path. Returns null when the ref is absolute or
 *  escapes the slice dir — the caller records the defect (FR-5), never a
 *  silent drop. */
export declare function sliceRelativeMediaPath(ref: string, baseDir: string): string | null;
/** Parses a proof artifact's YAML frontmatter into a ProofArtifact.
 *  Out-of-set / missing verdicts become null (a present artifact is not a
 *  verdict — FR-2); the parse never throws on malformed input. Body media
 *  refs are captured for the §3.4 curated-proof projection. */
export declare function parseC1Header(content: string, relPath: string, droppedAtIso: string): ProofArtifact;
/** The pinned pass-mapping ("passing" is never left to interpretation). */
export declare function isPassing(artifactType: C1ArtifactType, verdict: C1Verdict | null): boolean;
/** Latest-wins per (candidate_sha, artifact_type) — the ratified C1 selection
 *  rule. A non-passing verdict is superseded only by a LATER artifact of the
 *  SAME tuple, never by adjacent artifacts, presence, or approval. */
export declare function selectWinning(artifacts: ProofArtifact[], candidateSha: string | null): Map<C1ArtifactType, ProofArtifact>;
/** The candidate under judgment: the candidate_sha of the latest-dropped gate
 *  artifact (deterministic; ties broken by relPath). Null when no artifact
 *  carries one. */
export declare function deriveCandidateSha(artifacts: ProofArtifact[]): string | null;
export declare function deriveGateCells(artifacts: ProofArtifact[], candidateSha: string | null): VerdictCell[];
export interface GitFacts {
    mainTip: string;
    /** Parsed from `Merge OPR.<id>` subjects; null = unmerged. */
    mergeSha: string | null;
    /** Post-merge: is the merge an ancestor of tip? */
    mergeIsAncestorOfTip: boolean | null;
    /** Pre-merge: commits the candidate's merge-base is behind tip; null = unknown. */
    candidateBehindTip: number | null;
}
export declare function composeLineage(candidateSha: string | null, git: GitFacts, gateCells: VerdictCell[]): VerifyLineage;
export interface ApprovalStampFacts {
    by: string;
    at: string;
    /** One-query cross-check against the pinned scope-approval audit shape. */
    auditRowPresent: boolean;
}
export interface ApprovalFacts {
    /** `--scope spec` stamp (approved-spec-by/at) → plan.lock. */
    spec: ApprovalStampFacts | null;
    /** `--scope delivery` stamp (approved-by/at) → delivered.lock. */
    delivery: ApprovalStampFacts | null;
}
export declare function lockFrom(stamp: ApprovalStampFacts | null): LockState | null;
export interface RecordedGreen {
    green: boolean;
    /** 1 = full gate-verdict set; 2 = adjudicated confirm-faithful; null when not green. */
    regime: 1 | 2 | null;
}
export declare function computeRecordedGreen(gateCells: VerdictCell[], artifacts: ProofArtifact[], candidateSha: string | null): RecordedGreen;
/** Convenience for the mission gatherer: derive the ledger green straight
 *  from a slice's artifacts (candidate + gate cells derived internally). */
export declare function composeRecordedGreenForSlice(artifacts: ProofArtifact[]): RecordedGreen;
/** Extracts a `## <heading>` section body, verbatim (character-identical). */
export declare function extractSection(markdown: string | null, heading: string): string | null;
/** The pinned mini-requirements tier at the PRD top (plan.concise.text). */
export declare function extractMiniReqs(prd: string | null): string | null;
/** release-0.4.7 intent-stage — true when the (already-extracted) mini-reqs
 *  section carries at least one numbered item whose text is NOT a scaffold
 *  placeholder (the template scaffolds `1. [...]`).
 *
 *  SINGLE-PARSE PIN (arch AR-2): the derivePhase `prdAuthored` signal AND the
 *  PLAN concise render decision MUST both derive from this ONE parse of the
 *  ONE extractMiniReqs extraction — a second mini-reqs grammar anywhere in
 *  this file would recreate the seam map's R3 divergence class intra-file.
 *
 *  release-0.4.7 micro-bundle A: the LINE grammar now lives in the twin
 *  module's `hasAuthoredNumberedItem` (shared with both scope-audit mini-reqs
 *  arms — the IF-3 dot/paren heal, arch MB-AR-1); this function keeps the
 *  parse-side contract above and delegates the grammar. Prose/bullet-only is
 *  deliberately not-authored — reviewer-L1 ruling 2026-07-11, intent-stage
 *  gate: the numbered tier is where approval starts. */
export declare function hasAuthoredMiniReqs(miniReqs: string | null): boolean;
/** One promised deliverable from the D2 `## Proof contract` (§3.1): the item
 *  text plus an optional planned-mockup ref written as a markdown image on
 *  the same checkbox line (`- [ ] drawer opens right ![mockup](mockups/x.png)`). */
export interface PromisedItem {
    text: string;
    /** VM-006 (arch PIN-C, Option-A raw-key join): the authored contract line
     *  body exactly as written, trim-only — captured BEFORE the inline-image
     *  strip that produces `text`. Acceptance rows on the Progress tab keep
     *  their RAW checkbox text, so this is the carrier that lets the two tabs
     *  join on the SAME relation the acceptance dedup already uses. `text`
     *  stays stripped and byte-unchanged, so `refMatches` and every DELIVERED
     *  render are untouched. */
    rawText: string;
    plannedRef: string | null;
}
export { parseLogicalCheckboxes };
export type { LogicalCheckboxItem };
/** Shared identity for judgment authority and readers; preserve existing receipt hashes. */
export declare function proofItemIdentity(rawText: string): {
    id: string;
    text: string;
};
export declare function extractProofContract(prd: string | null): PromisedItem[];
export declare function extractMiniReqsSelected(prd: string | null, readme: string | null, spec?: string | null): {
    body: string | null;
    fromReadme: boolean;
};
export declare function extractProofContractSelected(prd: string | null, readme: string | null, spec?: string | null): {
    items: PromisedItem[];
    fromReadme: boolean;
    source: "prd" | "spec" | "readme" | null;
};
export interface PhaseSignals {
    /** The spec carries authored STRUCTURE (arch AR-2): a post-placeholder-filter
     *  promised item, or an authored (non-placeholder) mini-reqs numbered item —
     *  read from the per-section SELECTED source (PM dogfood #1: an authored
     *  README section riding the selection counts; a pristine scaffold PRD
     *  still is not a spec). Replaces the old file-presence `prdPresent`. */
    prdAuthored: boolean;
    /** REAL dropped proof artifacts only (`artifacts.length > 0`). PROOF.md is
     *  scaffolded at slice birth, so its file-presence is NOT construction
     *  evidence — its VERDICT content already feeds the review tier via
     *  `verdictOrEvidenceSetPresent` (release-0.4.7 intent-stage). */
    realProofArtifactsPresent: boolean;
    activeQitemPresent: boolean;
    /** Evidence/verdict set present (any recorded verdict OR a claimed PROOF.md + media set). */
    verdictOrEvidenceSetPresent: boolean;
    /** The PLAN plan-lock stamp (`--scope spec`) — authored by fiat: the honest
     *  operator override that promotes a slice to spec regardless of content. */
    specLocked: boolean;
    /** The delivery approval stamp. */
    approved: boolean;
}
/** Top-down by precedence — locked > review > building > spec > intent —
 *  stated explicitly because one signal can satisfy two lanes.
 *
 *  The phase chip describes SDLC ARTIFACT progression, not coordination
 *  activity (arch AR-3): a bare tracking qitem is coordination and counts
 *  toward building only when paired with an authored/locked spec;
 *  coordination itself renders in the queue/agents bands. */
export declare function derivePhase(s: PhaseSignals): ReviewPhase;
export interface ComposedDelivered {
    items: DeliveredItem[];
    extraProof: ReviewMedia[];
    /** Feeds ▲ insufficient-proof (FR-4) and the board's building-cell n/m (FR-7). */
    missingCount: number;
    /** Artifact media refs that escape the slice dir (FR-5 defect findings). */
    escapingRefs: string[];
}
/**
 * `delivered.items` IS the join, reframed (§3.1): each `## Proof contract`
 * deliverable pairs with the CURATED proof media of the artifacts covering it
 * and QA's recorded comparison signal.
 *
 * `verified` binds to the SHIPPED C1 fields (arch F3), never presence:
 *   verified   — a covering qa|adjudication artifact records the comparison
 *                (self_check) AND its recorded verdict is passing;
 *   unverified — some covering artifact exists but no passing recorded QA
 *                comparison (QA's why-kicked-back note still surfaces);
 *   missing    — promised, nothing delivered.
 * Fail-open by construction: these are render states, never blocks.
 */
export declare function composeDelivered(promised: PromisedItem[], artifacts: ProofArtifact[], readiness?: ScopeReadiness): ComposedDelivered;
export interface AttentionInput {
    qitemId: string;
    summary: string | null;
    leg: string;
    where: string;
    createdAtIso: string | null;
    priority: string | null;
    tier: string | null;
    evidenceRef: string | null;
    unblocks: string | null;
    destinationSession: string | null;
    closureRequiredAtIso: string | null;
    /** OPR.0.4.6.WF4 Q6 — set by the gatherer when the item carries an
     *  `instance:<id>` workflow-exception tag; carried verbatim to the row. */
    workflow?: WorkflowRowRef;
}
export interface AgentInput {
    agentName: string;
    sessionName: string;
    runtime: AgentRow["runtime"];
    /** Queue-proven park target (human/qitem/etc.); null means no parked row state. */
    parkedOn: string | null;
    /** null = telemetry down (honest-unknown). */
    idle: boolean | null;
    idleSinceIso: string | null;
    doing: string | null;
    holdsCount: number;
    lastTransitionIso: string | null;
    slices: string[];
}
/** The delivered-completeness facts the ▲ insufficient-proof rule reads
 *  (was the old join's counts; §3.1 re-bind — the signal is the
 *  delivered.items MISSING count). */
export interface DeliveredCounts {
    promisedCount: number;
    missingCount: number;
}
/** The four ▲ exception rules over captured signals. Every row carries its
 *  evidence + crossed threshold; no evidence -> no exception (never a bare
 *  accusation). A ▲ is information for the human, invisible to the flagged
 *  agent's workflow. */
export declare function deriveExceptions(agents: AgentInput[], attention: AttentionInput[], delivered: DeliveredCounts, scopeLabel: string, nowIso: string, latestArtifactIso: string | null, governingStampIso: string | null): NeedsYouItem[];
export declare function composeNeedsYou(attention: AttentionInput[], derived: NeedsYouItem[], confirmFaithful: NeedsYouItem[], computedOver: string, nowIso: string): NeedsYouBand;
/** OPR.0.4.6.WF5 FR-3 — one recorded workflow-instance view for the ▲
 *  band. The GATHERER assembles these from recorded state only
 *  (workflow_instances + queue rows + the WF-1 evaluator verdict + the
 *  open exception item by tag query); this module derives rows PURELY. */
export interface WorkflowExceptionInput {
    instanceId: string;
    workflowName: string;
    status: string;
    currentStepId: string | null;
    /** The WF-1 evaluator's verdict state for the frontier ("healthy" or
     *  the overdue states) + its evidence line, precomposed by the
     *  gatherer. Never recomputed here (one-threshold-home). */
    deadlineState: string;
    deadlineEvidence: string | null;
    /** True when a frontier id resolves to a NON-OPEN packet (the
     *  out-of-band corruption state — WF-3 FR-6's guard is the
     *  prevention; this row is the detection backstop). */
    frontierRefsNonOpenPacket: boolean;
    /** The OPEN exception item for this instance (tag query), if any. */
    openItem: {
        qitemId: string;
        destinationSession: string;
        humanRouted: boolean;
        createdAtIso: string | null;
        summary: string | null;
    } | null;
}
/**
 * OPR.0.4.6.WF5 FR-3 — the workflow_instances ▲ source + THE AWARENESS
 * CHANNEL. One-count across channels (BR-3): an exception with a live
 * HUMAN-routed ● item renders NOTHING here (the item IS the human's
 * row); an ORCHESTRATOR-routed ● item renders exactly ONE awareness row
 * (same identity, second projection — the human KNOWS at altitude); a
 * failed instance with NO item renders the ▲ backstop naming BOTH the
 * exception AND the missing-item anomaly (the backstop firing is itself
 * evidence of a bug). Healthy instances render zero rows (the band's
 * zero-noise negative). Durable-by-derivation: recomputed from recorded
 * state on every composition; rows clear on state-exit (recomposition,
 * never hand-clearing).
 */
export declare function deriveWorkflowExceptions(workflows: WorkflowExceptionInput[], scopeLabel: string, nowIso: string): NeedsYouItem[];
/** The third NAMED ▲ heuristic's visible v1 default (slice-22 FR-3:
 *  too-long-in-state — no transition beyond threshold). Lives HERE because
 *  compose.ts is the single threshold home (P2 arch note N2): changes land
 *  once and every altitude inherits. Same markdown-steered tuning
 *  fast-follow as IDLE_WITH_WORK_THRESHOLD_MIN. */
export declare const TOO_LONG_IN_STATE_THRESHOLD_MIN = 120;
/**
 * Slice-22 FR-3 — the agent-scope ▲ set: exactly the three NAMED heuristics
 * (idle-with-assigned-work, overdue handoff, too-long-in-state). The first
 * two REUSE deriveExceptions' rules (called with zero delivered counts and
 * no artifact/stamp facts, so the slice-only insufficient-proof /
 * stale-after-change rules cannot fire); too-long-in-state is added here —
 * additively, so slice-scope composition is byte-unchanged. No evidence →
 * no exception (unknown is not idle; unknown lastTransition is not
 * too-long).
 */
export declare function deriveAgentScopeExceptions(agents: AgentInput[], attention: AttentionInput[], scopeLabel: string, nowIso: string): NeedsYouItem[];
export interface RigComposeInputs {
    agents: AgentInput[];
    overdue: AttentionInput[];
    attention: AttentionInput[];
    settled: SettledRow[];
    handoffsToday: number;
    overdueCount: number;
    /** The FR-1 roster display window, named on-surface in provenance
     *  (plan-review ruling: "computed from queue+ps · window: today"). */
    rosterWindow: string;
    /** OPR.0.4.6.WF5 FR-3: recorded workflow-instance views (optional). */
    workflows?: WorkflowExceptionInput[];
    nowIso: string;
}
/** Slice-22 FR-1..FR-4 — the rig-scope composition root. PURE: same inputs,
 *  byte-identical output (idempotence is a money proof). */
export declare function composeRigAgents(inputs: RigComposeInputs): ComposedRigAgents;
/** Region membership derives from work-on-THIS-scope, never rig co-residency. */
export declare function composeAgentsBand(agents: AgentInput[], scope: AgentsScope, exceptions: NeedsYouItem[], nowIso: string): AgentsBand;
export interface SliceComposeInputs {
    readiness?: ScopeReadiness;
    slice: {
        name: string;
        id: string | null;
        title: string;
        missionId: string | null;
    };
    /** Raw file contents (null = absent). */
    readme: string | null;
    /** Which node filename supplied `readme`; absent preserves legacy caller behavior. */
    nodeFileName?: "SPEC.md" | "README.md";
    prd: string | null;
    proofMd: string | null;
    artifacts: ProofArtifact[];
    /** The pinned plan set — a frontmatter READ (`locked-artifacts:` on the slice README). */
    lockedArtifacts: LockedArtifact[];
    /** Media refs found in composed sources; absolute/escaping paths are defect findings (FR-5). */
    mediaRefs: string[];
    /** True when the slice's proof/ dir exists (the "see all proof" drill-in target). */
    proofDirExists: boolean;
    attention: AttentionInput[];
    agents: AgentInput[];
    /** OPR.0.4.6.WF5 FR-3: recorded workflow-instance views (optional —
     *  absent renders byte-identically to pre-WF-5). */
    workflows?: WorkflowExceptionInput[];
    activeQitemPresent: boolean;
    git: GitFacts;
    approval: ApprovalFacts;
    nowIso: string;
}
/** A self-asserted PASS in the slice's own PROOF.md (never a verdict). */
export declare function proofClaimsPass(proofMd: string | null): boolean;
export declare function composeSliceReview(inputs: SliceComposeInputs): ComposedSliceReview;
export interface MissionSliceEntry {
    review: ComposedSliceReview;
    /** Recorded-verdict green for the completion ledger (computeRecordedGreen
     *  over the slice's artifacts — supplied by the gatherer, which holds them). */
    green: boolean;
}
export interface MissionComposeInputs {
    readiness?: MissionReadiness;
    mission: {
        name: string;
        id: string | null;
        title: string;
        intent?: string | null;
    };
    slices: MissionSliceEntry[];
    missionAttention: AttentionInput[];
    agents: AgentInput[];
    nowIso: string;
}
export declare function composeMissionReview(inputs: MissionComposeInputs): ComposedMissionReview;
//# sourceMappingURL=compose.d.ts.map