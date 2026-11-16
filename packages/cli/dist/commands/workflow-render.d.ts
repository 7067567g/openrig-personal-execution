/**
 * OPR.0.4.6.WF3 FR-2 — the glanceable human renderers for
 * trace/list/show. RENDER-SIDE ONLY (BR-2): these functions format
 * daemon payloads the CLI already receives; `--json` paths never come
 * through here and stay byte-identical to the shipped output.
 *
 * Shapes ported from in-repo precedent: the `rig ps` table mechanics
 * (fitCell/truncate) and the argo-get per-step tree bar (STEP / ACTOR
 * / EXIT / DURATION columns with status glyphs).
 *
 * Present-tolerant fields: WF-2's branch/gate additions
 * (closureEvidence.branch_taken etc.) render when the payload carries
 * them and leave no residue when absent — this module never requires
 * them (WF-3 builds against the pre-WF-2 tip; the fields land with
 * WF-2).
 */
export interface RenderInstance {
    guidance?: {
        lines: string[];
    };
    instanceId: string;
    workflowName?: string;
    workflowVersion?: string;
    status: string;
    createdBySession?: string;
    createdAt?: string;
    currentStepId?: string | null;
    currentFrontier?: string[];
    hopCount?: number;
    /** OPR.0.4.6.FAC1: the instance's bound rig (API-carried; null/absent = unbound, renders nothing). */
    boundRig?: string | null;
    /**
     * WF-1 FR-2's API-carried classification (present since the
     * completion fixback at 384e60f1). RAIL 1 (arch ruling): the CLI
     * CONSUMES this verbatim and never recomputes a threshold or class.
     */
    deadline?: {
        state: string;
        evidence?: {
            stepId?: string | null;
            ownerSession?: string;
            overdueBySeconds?: number;
            ageSeconds?: number;
        } | null;
    };
    /** Present on waiting instances that recorded their park decision. */
    lastContinuationDecision?: {
        blockedOn?: string | null;
    } | null;
    /** S06: packet-addressed frontier facts are derived from the live queue row. */
    frontierPackets?: RenderFrontierPacket[];
    /** S06: unresolved branch failures remain visible even while siblings run. */
    failureOccurrences?: RenderFailureOccurrence[];
    /** Named broken joins; never collapse these to an apparently actionable row. */
    unknowns?: string[];
    exceptionObligations?: Array<{
        qitemId: string;
        ownerSession: string;
        state: string;
        evidenceRef: string | null;
        inspectCommand: string;
    }>;
    exceptionReadiness?: {
        selection: {
            state: string;
            role: string | null;
            source: string;
            entryRole: string | null;
        };
        routes: Array<{
            exceptionClass: string;
            state: string;
            roleResolution: string;
            destinationSession: string | null;
            position: string | null;
            resolvedVia: string | null;
            message: string;
        }>;
        nextAction: string;
    } | null;
    reconciliation?: {
        status: string;
        adopted: boolean | null;
        boundDigest: string | null;
        proposedDigest: string | null;
        composition: {
            mode: string;
            explanation: string;
            boundSlices: string[];
            executableSteps: unknown[];
        };
        changes: Array<{
            kind: string;
            ref: string;
            fields?: string[];
        }>;
        reasons: string[];
        nextAction: string;
        applyCommand?: string;
        operationKey?: string;
    };
    lifecycleBinding?: {
        graphSource?: {
            mode?: string;
            profileSource?: string | null;
            missionSource?: string | null;
        };
    } | null;
    boundaryObligations?: Array<{
        stepId: string;
        required: boolean;
        state: string;
        receiptState: string;
        receipt: {
            evidenceRef: string;
            actorSession: string;
            closedAt: string;
        } | null;
    }>;
}
export interface RenderFrontierPacket {
    packetId: string;
    stepId: string | null;
    ownerSession: string | null;
    queueState: string | null;
    blockedOn: string | null;
    targetedAction: "project" | "route" | "indeterminate";
    dependsOn?: string[];
    receiptRequired?: boolean;
    acceptance?: {
        candidate: string;
        verdicts: string[];
        evidence_ref: string;
    } | null;
}
export interface RenderFailureOccurrence {
    occurrenceId: string;
    stepId: string;
    status: "unresolved" | "resolved";
    failureReason?: string | null;
    redrivePacketId?: string | null;
    targetedAction: "resume" | "none";
}
export interface RenderTrailRow {
    stepId: string;
    stepRole?: string;
    closedAt?: string;
    closureReason: string;
    closureEvidence?: Record<string, unknown> | null;
    actorSession: string;
    nextQitemId?: string | null;
    priorQitemId?: string;
}
/** One command-shaped owner action, including the typed acceptance contract when present. */
export declare function renderProjectAction(instanceId: string, packet: RenderFrontierPacket): string;
export declare function statusGlyph(status: string): string;
/** Compact human duration between two ISO timestamps ("3s", "4m", "2h", "5d"). */
export declare function humanDuration(fromIso: string | undefined, toIso: string | undefined): string;
/** Instance age relative to a supplied "now" (injectable for tests). */
export declare function humanAge(createdAt: string | undefined, nowIso: string): string;
/** Compact render of a plain seconds quantity (same scale rules). */
export declare function humanSeconds(seconds: number): string;
/**
 * The trace tree (mini-req 2's bar: where it is + how it got there,
 * one screen, no JSON literacy required).
 */
export declare function renderTraceTree(instance: RenderInstance, trail: RenderTrailRow[], nowIso?: string): string[];
/**
 * OPR.0.4.6.WF3 FR-3 — the attention marker for a list row (the
 * single marker home). Classes: failed · stuck (consumed VERBATIM
 * from the API-carried deadline classification — rail 1: the CLI
 * never recomputes a threshold or class) · waiting. A row shows its
 * highest-priority class; the `status` verb shows ALL classes per
 * instance (exactly-once, combined reasons).
 */
export declare function attentionMarker(instance: RenderInstance): string;
export interface AttentionRow {
    instanceId: string;
    workflowName: string;
    /** All classes for this instance — exactly-once row, combined. */
    classes: string[];
    reasons: string[];
    /** The actionable affordance (what-to-do-next), per class priority. */
    affordance: string;
}
export interface AttentionRollup {
    counts: {
        total: number;
        active: number;
        waiting: number;
        completed: number;
        failed: number;
        aborted: number;
    };
    attention: AttentionRow[];
}
/**
 * Compose the rollup from list rows. Pure arithmetic over
 * pre-classified rows (the arch ruling's boundary: counting +
 * grouping + rendering is render-side; the ONE correctness-rule
 * composition — the threshold classification — arrives ALREADY DONE
 * in instance.deadline). Per-instance dedup by instanceId (rail 2):
 * an instance with multiple attention reasons renders ONCE with all
 * of them.
 */
export declare function composeAttentionRollup(instances: RenderInstance[]): AttentionRollup;
/** Human render of the rollup — proven-empty, never blank. */
export declare function renderStatus(rollup: AttentionRollup): string[];
/** The list table: INSTANCE · WORKFLOW · STATUS · STEP · AGE · ATTN. */
export declare function renderInstanceList(instances: RenderInstance[], nowIso?: string): string[];
/** The show summary, headed by the status line. */
export declare function renderInstanceShow(instance: RenderInstance, nowIso?: string): string[];
export declare function renderGraphRevision(view: NonNullable<RenderInstance["reconciliation"]>, expanded?: boolean): string[];
//# sourceMappingURL=workflow-render.d.ts.map