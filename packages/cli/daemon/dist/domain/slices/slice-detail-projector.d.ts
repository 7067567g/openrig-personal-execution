import type Database from "better-sqlite3";
import type { SliceIndexer, SliceRecord, SliceProofPacket } from "./slice-indexer.js";
import type { WorkflowSpecCache } from "../workflow-spec-cache.js";
import { type ScopeReadiness } from "../proof/judgments.js";
import { type SpecGraphPayload, type PhaseDefinition, type CurrentStepPayload } from "../workflow/slice-workflow-projection.js";
export interface StoryEvent {
    ts: string;
    /** Spec-defined step.id when the event traces back through a workflow
     *  step trail; null when the event is untagged (no trail mapping or
     *  the slice has no bound workflow_instance). v1 removed the v0
     *  hardcoded legacy phase enum. */
    phase: string | null;
    kind: string;
    actorSession: string | null;
    qitemId: string | null;
    summary: string;
    detail: Record<string, unknown> | null;
}
export interface AcceptanceItem {
    text: string;
    done: boolean;
    source: {
        file: string;
        line: number;
    };
    /** VM-006 (FR-4, additive): how `done` was derived on a slice with an
     *  authored proof contract — the author's tick vs the QA-verdict lift.
     *  Omitted entirely when the slice has no authored contract or the row is
     *  not done; no consumer is required to read it. */
    doneVia?: "checkbox" | "qa-verdict";
}
export interface AcceptancePayload {
    totalItems: number;
    doneItems: number;
    percentage: number;
    items: AcceptanceItem[];
    closureCallout: string | null;
    /** v1 dimension #3: bound workflow_instance's current step + the
     *  spec-declared allowed next steps. Null when the slice has no
     *  bound instance (UI falls back to PROGRESS.md checkbox view only). */
    currentStep: CurrentStepPayload | null;
}
export interface DecisionRow {
    actionId: string;
    ts: string;
    actor: string;
    verb: string;
    qitemId: string;
    reason: string | null;
    beforeState: string | null;
    afterState: string | null;
}
export interface DocsTreeEntry {
    name: string;
    type: "file" | "dir";
    size: number | null;
    mtime: string | null;
    /** Relative path under the slice folder. */
    relPath: string;
}
export interface ProofPacketRendered {
    dirName: string;
    /** Headline markdown file (latest mtime). */
    primaryMarkdown: {
        relPath: string;
        content: string;
    } | null;
    /** All other markdown files in the proof packet directory (latest-first). */
    additionalMarkdown: Array<{
        relPath: string;
        content: string;
    }>;
    /** Screenshot relative paths suitable for /api/slices/:name/proof-asset/<path> serving. */
    screenshots: string[];
    /** Video relative paths suitable for the <video> player. */
    videos: string[];
    /** Trace zip relative paths (download links only — not auto-rendered). */
    traces: string[];
    /** Heuristic pass/fail badge derived from primary markdown content. */
    passFailBadge: "pass" | "fail" | "partial" | "unknown";
}
export interface TopologyRigEntry {
    rigId: string;
    rigName: string;
    sessionNames: string[];
}
export interface TopologyPayload {
    affectedRigs: TopologyRigEntry[];
    /** Total unique seats touching the slice across all rigs. */
    totalSeats: number;
    /** v1 dimension #1: workflow_spec graph (nodes + edges) when the
     *  slice is bound to a workflow_instance. Null when unbound (UI falls
     *  back to the v0 per-rig session listing). */
    specGraph: SpecGraphPayload | null;
}
export interface WorkflowBindingPayload {
    instanceId: string;
    workflowName: string;
    workflowVersion: string;
    status: string;
    currentStepId: string | null;
    currentFrontier: string[];
    hopCount: number;
    createdAt: string;
    completedAt: string | null;
    /** Other workflow_instances also touching this slice's qitem set;
     *  v1 picks the most recent as the primary binding (per PRD), and
     *  exposes the rest here so the UI can render a "+N more" indicator. */
    additionalInstanceIds: string[];
}
export interface SliceDetailPayload {
    readiness: ScopeReadiness;
    name: string;
    missionId: string | null;
    slicePath: string;
    displayName: string;
    railItem: string | null;
    status: string;
    rawStatus: string | null;
    qitemIds: string[];
    commitRefs: string[];
    lastActivityAt: string | null;
    /** v1: bound workflow_instance metadata (most-recent if multiple),
     *  null when no workflow_instance touches this slice's qitems. */
    workflowBinding: WorkflowBindingPayload | null;
    story: {
        events: StoryEvent[];
        /** v1 dimension #2: spec-declared phase definitions when bound;
         *  null when unbound (UI falls back to ungrouped chronological). */
        phaseDefinitions: PhaseDefinition[] | null;
    };
    acceptance: AcceptancePayload;
    decisions: {
        rows: DecisionRow[];
    };
    docs: {
        tree: DocsTreeEntry[];
    };
    tests: {
        proofPackets: ProofPacketRendered[];
        aggregate: {
            passCount: number;
            failCount: number;
        };
    };
    topology: TopologyPayload;
}
export interface SliceDetailProjectorOpts {
    db: Database.Database;
    indexer: SliceIndexer;
    /** v1: optional WorkflowSpecCache used to resolve the bound
     *  workflow_instance's spec for spec-graph + phase + current-step
     *  projection. When omitted, the projector silently degrades to v0
     *  behavior (everything renders as before; v1 fields are null). */
    workflowSpecCache?: WorkflowSpecCache;
}
export declare class SliceDetailProjector {
    private readonly db;
    private readonly indexer;
    private readonly workflowSpecCache;
    constructor(opts: SliceDetailProjectorOpts);
    withIndexer(indexer: SliceIndexer): SliceDetailProjector;
    project(slice: SliceRecord): SliceDetailPayload;
    /** The rig the instance is bound to, so `member@{rig}` targets show the seat the packet went to. */
    private boundRigOf;
    private tryGetSpec;
    /**
     * Builds a qitem_id → step_id map by reading the bound instance's
     * workflow_step_trails. Each trail row's prior_qitem_id maps to the
     * step that closed (`step_id`), and next_qitem_id maps to the
     * subsequent step's first packet. Used by buildStory to tag each
     * StoryEvent with the spec-defined phase the qitem traces back to.
     */
    private buildTrailQitemToStepMap;
    private buildStory;
    private buildAcceptance;
    private buildDecisions;
    private buildDocsTree;
    /** Read a single doc file from the slice folder for the Docs tab. Returns null if missing or outside the slice folder. */
    readDoc(sliceName: string, relPath: string): string | null;
    private buildTests;
    /**
     * Read a proof-packet asset (markdown content or check existence of binary
     * files like screenshots/videos). Path-traversal guarded by absPath prefix
     * check.
     */
    readProofAsset(proofPacket: SliceProofPacket, relPath: string): string | null;
    /** Returns the absolute on-disk path of a proof asset for binary serving. Path-traversal guarded. */
    resolveProofAssetPath(proofPacket: SliceProofPacket, relPath: string): string | null;
    private buildTopology;
}
//# sourceMappingURL=slice-detail-projector.d.ts.map