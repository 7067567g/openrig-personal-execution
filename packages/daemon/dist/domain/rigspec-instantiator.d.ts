import type Database from "better-sqlite3";
import type { RigRepository } from "./rig-repository.js";
import type { SessionRegistry } from "./session-registry.js";
import type { EventBus } from "./event-bus.js";
import type { NodeLauncher } from "./node-launcher.js";
import type { RigSpecPreflight } from "./rigspec-preflight.js";
import type { LegacyRigSpec as RigSpec, InstantiateOutcome } from "./types.js";
interface RigInstantiatorDeps {
    db: Database.Database;
    rigRepo: RigRepository;
    sessionRegistry: SessionRegistry;
    eventBus: EventBus;
    nodeLauncher: NodeLauncher;
    preflight: RigSpecPreflight;
    tmuxAdapter?: import("../adapters/tmux.js").TmuxAdapter;
}
export declare class RigInstantiator {
    readonly db: Database.Database;
    private rigRepo;
    private sessionRegistry;
    private eventBus;
    private nodeLauncher;
    private preflight;
    private tmuxAdapter?;
    constructor(deps: RigInstantiatorDeps);
    instantiate(spec: RigSpec, opts?: {
        nonInterruptive?: boolean;
    }): Promise<InstantiateOutcome>;
    private computeLaunchOrder;
}
import { type AgentResolverFsOps } from "./agent-resolver.js";
import { StartupOrchestrator } from "./startup-orchestrator.js";
import { PodRepository } from "./pod-repository.js";
import type { RigSpec as PodRigSpec, RigSpecPod, RigSpecPodMember } from "./types.js";
import type { RuntimeAdapter } from "./runtime-adapter.js";
import type { TmuxAdapter } from "../adapters/tmux.js";
import type { ContinuityPolicyMaterializer } from "./continuity-policy-materializer.js";
import { type ReconcileSkillLoadoutResult, type SkillLoadout, type SkillRuntime } from "./skill-catalog.js";
import type { SystemWorldResolution } from "./system-world.js";
import type { SeatEnv } from "./seat-env.js";
interface PodInstantiatorDeps {
    db: Database.Database;
    rigRepo: RigRepository;
    podRepo: PodRepository;
    sessionRegistry: SessionRegistry;
    eventBus: EventBus;
    nodeLauncher: NodeLauncher;
    startupOrchestrator: StartupOrchestrator;
    fsOps: AgentResolverFsOps;
    /** §6 reconciliation: main's managed Claude activity-hook delivery asset paths, forwarded to
     *  preflight (defaults to daemon-shipped assets; tests inject fixtures). Restores main's proven
     *  threading, dropped when the restacked 4.8 instantiator won the warnings-site conflicts. */
    claudeActivityAssets?: {
        relayPath?: string;
        manifestPath?: string;
    };
    adapters: Record<string, RuntimeAdapter>;
    tmuxAdapter?: TmuxAdapter;
    /** PL-016 Item 4: optional agent-image library so AgentSpec
     *  session_source: mode: agent_image entries can resolve to the
     *  image's resume token. Optional — when absent, agent_image session
     *  source surfaces a structured error at instantiation time. */
    agentImageLibrary?: import("./agent-images/agent-image-library-service.js").AgentImageLibraryService;
    exec?: (cmd: string) => Promise<string>;
    /** OPR.0.5.3.6 — resolves the typed topology.root so a spec's shipped
     *  `topology/` chain-file defaults install at materialization (copy-if-absent,
     *  best-effort). Absent → no defaults install (tests, legacy composition). */
    topologyRootResolver?: () => string;
    /** S15 — whether new seats receive the compact default mental-model pack.
     *  Resolved at materialization so config changes affect future launches. */
    onboardingEnabledResolver?: () => boolean;
    /** S04 — live config resolver for the authoritative managed skill catalog. */
    skillsRootResolver?: () => string;
    /** S05 — selected System World. Resolution failures refuse preflight/launch
     *  rather than falling back to a different system selector. */
    systemWorldResolver?: () => SystemWorldResolution;
    /** S04 — exact-byte catalog projection before a harness starts. Optional
     *  for old tests/embedders; production wires the shared reconciler. */
    skillReconciler?: (input: {
        loadout: SkillLoadout;
        runtime: SkillRuntime;
        cwd: string;
        apply: true;
        topologyOwner?: string;
    }) => ReconcileSkillLoadoutResult;
    /** S20 P4 — materializes the selected Claude continuity policy by
     *  registering jobs in the existing watchdog engine after startup succeeds. */
    continuityPolicyMaterializer?: Pick<ContinuityPolicyMaterializer, "arm">;
}
export interface MaterializeResult {
    rigId: string;
    specName: string;
    specVersion: string;
    nodes: Array<{
        logicalId: string;
        status: "materialized";
    }>;
    warnings?: string[];
}
export type MaterializeOutcome = {
    ok: true;
    result: MaterializeResult;
} | {
    ok: false;
    code: "validation_failed";
    errors: string[];
} | {
    ok: false;
    code: "preflight_failed";
    errors: string[];
    warnings: string[];
} | {
    ok: false;
    code: "target_rig_not_found";
    message: string;
} | {
    ok: false;
    code: "materialize_conflict";
    message: string;
} | {
    ok: false;
    code: "materialize_error";
    message: string;
} | {
    ok: false;
    code: "rig_name_running";
    message: string;
    runningRig: {
        id: string;
        name: string;
        runningSessionCount: number;
    };
};
export interface LaunchMaterializedNodeResult {
    logicalId: string;
    nodeId: string;
    status: "launched" | "failed" | "attention_required";
    error?: string;
    sessionName?: string;
}
export type LaunchMaterializedOutcome = {
    ok: true;
    result: {
        nodes: LaunchMaterializedNodeResult[];
        warnings?: string[];
    };
} | {
    ok: false;
    code: "validation_failed";
    errors: string[];
} | {
    ok: false;
    code: "target_rig_not_found";
    message: string;
};
/** A pod-local edge declared alongside an added member (from/to are member ids
 *  within the pod; resolved against the new member + existing pod-mates). */
export interface AddMemberEdge {
    from: string;
    to: string;
    kind: string;
}
export interface AddMemberResult {
    podId: string;
    podNamespace: string;
    node: {
        logicalId: string;
        nodeId: string;
        status: "launched" | "failed" | "attention_required";
        error?: string;
        sessionName?: string;
    };
    /** Pod-local edges persisted with the add (empty when none declared). The
     *  endpoints are qualified logical ids. Edges carry no runtime behavior yet
     *  (OPR.0.3.3.24 fence) - they record declared topology intent. */
    edges: Array<{
        from: string;
        to: string;
        kind: string;
    }>;
    warnings?: string[];
}
/**
 * Outcome of the `add_member` converge op (OPR.0.3.3.24). Mirrors the
 * MaterializeOutcome error vocabulary where it overlaps (validation_failed /
 * preflight_failed) and adds the add-member-specific honest codes
 * (rig_not_found / pod_not_found / member_conflict / edge_unresolved). Every
 * failure carries a human-actionable message or error list (the 3-part
 * honest-error contract that the converge interface surfaces to CLI + MCP).
 */
export type AddMemberOutcome = {
    ok: true;
    result: AddMemberResult;
} | {
    ok: false;
    code: "rig_not_found";
    message: string;
} | {
    ok: false;
    code: "pod_not_found";
    message: string;
} | {
    ok: false;
    code: "member_conflict";
    message: string;
} | {
    ok: false;
    code: "edge_unresolved";
    message: string;
} | {
    ok: false;
    code: "materialize_error";
    message: string;
} | {
    ok: false;
    code: "validation_failed";
    errors: string[];
} | {
    ok: false;
    code: "preflight_failed";
    errors: string[];
    warnings: string[];
};
export declare class PodRigInstantiator {
    readonly db: Database.Database;
    private deps;
    constructor(deps: PodInstantiatorDeps);
    /** One configured catalog root for preflight, materialization, and launch. */
    resolveSkillsRoot(): string | undefined;
    private systemWorldResolutionContext;
    private inheritedPermissionPolicy;
    materialize(rigSpecYaml: string, rigRoot: string, opts?: {
        targetRigId?: string;
        suppressSummaryEvent?: boolean;
        cwdOverride?: string;
    }): Promise<MaterializeOutcome>;
    /**
     * materialize with a STRUCTURED front (OPR.0.3.3.24): the YAML-free sibling of
     * materialize(). Runs the SAME front-end (validate + preflight, via the
     * preflight CORE using this adapter's fsOps) on an already-built raw spec
     * OBJECT, then the persistence core - so `expand` (and the add_member op) drop
     * the synthetic-spec YAML round-trip. Byte-identical to materialize(yaml): same
     * validate(externalQualifiedIds), same preflight checks, same MaterializeOutcome
     * error codes (validation_failed / preflight_failed / target_rig_not_found /
     * materialize_conflict). fsOps stays encapsulated here (the expansion service
     * has none) - this wrapper is mechanics only, no behaviour/layering change.
     */
    materializeStructured(raw: unknown, rigRoot: string, opts?: {
        targetRigId?: string;
        suppressSummaryEvent?: boolean;
        cwdOverride?: string;
    }): Promise<MaterializeOutcome>;
    /**
     * materialize CORE (OPR.0.3.3.24): the persistence body of materialize, taking
     * an already-parsed + validated + preflighted PodRigSpec. Creates pods +
     * member nodes (via the create-node primitive) + edges + events in one
     * transaction. Parse/validate/preflight is the caller's separable front-end
     * (materialize() for YAML; expand/add_member build + validate a structured
     * spec). This is the cut that lets `expand` drop its synthetic-spec hack and
     * `add_member` reuse the exact create path — create+launch only, no identity
     * migration.
     */
    materializeValidatedSpec(rigSpec: PodRigSpec, rigRoot: string, preflightWarnings: string[], opts?: {
        targetRigId?: string;
        suppressSummaryEvent?: boolean;
        cwdOverride?: string;
        /** S9: ordinary member growth targets this already-persisted pod. */
        existingPodNamespace?: string;
    }): Promise<MaterializeOutcome>;
    launchMaterialized(rigSpecYaml: string, rigRoot: string, targetRigId: string): Promise<LaunchMaterializedOutcome>;
    /**
     * launch CORE (OPR.0.3.3.24): given an already-parsed+validated spec whose
     * nodes are already materialized, compute launch order and bring each node
     * live via the launch-binding primitive. Extracted from launchMaterialized so
     * `expand` (and the add_member op) launch a structured spec WITHOUT a YAML
     * round-trip; launchMaterialized(yaml) is the parse/validate/normalize front
     * over it. Behaviour identical (loop body relocated verbatim).
     */
    launchValidatedSpec(rigSpec: PodRigSpec, rigRoot: string, targetRigId: string, cwdOverride?: string): Promise<LaunchMaterializedOutcome>;
    /**
     * add_member converge op (OPR.0.3.3.24): add a single MEMBER to an EXISTING
     * pod in a live rig. S9 makes this the ordinary-growth front over the same
     * materializeValidatedSpec + launchValidatedSpec effect ingress used by pod
     * expansion; this method owns validation and result shaping, not a sibling
     * create/launch transaction.
     *
     * Identity-migration-FREE: the new node mints a fresh node id + fresh logical
     * id + fresh `@rigged_*` at launch; no existing seat's logical id,
     * continuity_state, queue routing, or session is re-keyed. This is the
     * source-visible fault line that lets add_member ship while move/fork wait for
     * the 0.4.0 identity stack.
     *
     * It resolves the EXISTING pod's DB id via `podRepo.getPodByNamespace`, then
     * explicitly tells the shared materializer to reuse that pod. The pod-exists
     * guard is lifted only for this named target; the per-member duplicate-logical-
     * id guard is KEPT (AC-3).
     */
    addMemberToPod(rigId: string, podNamespace: string, memberFragment: Record<string, unknown>, rigRoot: string, opts?: {
        cwdOverride?: string;
        edges?: Array<{
            from: string;
            to: string;
            kind: string;
        }>;
    }): Promise<AddMemberOutcome>;
    /** Recover the legacy gap where projection failed before startup context was
     * persisted. This is an explicit first-start retry, never a resume/fresh fallback.
     * The operator supplies the original member source after exiting and cleaning
     * the failed shell. Existing validation, projection and startup delivery own all
     * effects; no node, history, token or startup-context row is fabricated here. */
    retryFirstStart(rigId: string, nodeId: string, memberFragment: Record<string, unknown>, rigRoot: string): Promise<{
        ok: false;
        code: string;
        message: string;
    } | {
        ok: true;
        rigId: string;
        nodeId: string;
        logicalId: string;
        status: "launched";
        sessionName?: string;
        warnings?: string[];
    }>;
    instantiate(rigSpecYaml: string, rigRoot: string, opts?: {
        nonInterruptive?: boolean;
        cwdOverride?: string;
        env?: SeatEnv;
        installRoot?: string;
        force?: boolean;
        prelaunchHook?: (rigId: string, replacedRigIds: readonly string[]) => Promise<{
            ok: true;
            rollback?: () => Promise<void>;
        } | {
            ok: false;
            code: string;
            message: string;
            retainRig?: boolean;
        }>;
    }): Promise<InstantiateOutcome>;
    private instantiateOnce;
    private computePodLaunchOrder;
    private processTerminalMember;
    private findMemberContext;
    /**
     * create-node primitive (OPR.0.3.3.24): mint a fresh node row for one member
     * (fresh stable id + fresh qualified logical id, `pod_id` = the given pod) plus
     * the matching `node.added` event. Extracted from materialize's loop so the
     * `add_member` converge op and a de-YAML'd `expand` create a member node
     * WITHOUT fabricating a synthetic rig spec. Identity-migration-FREE: addNode
     * mints a brand-new identity; nothing existing re-keys. The caller pushes the
     * returned `event` into its transaction's persisted-events list.
     */
    createMemberNode(input: {
        rigId: string;
        qualifiedId: string;
        member: RigSpecPodMember;
        podId: string;
        rigRoot: string;
        cwdOverride?: string;
    }): {
        node: import("./types.js").Node;
        event: import("./event-bus.js").NotifyToken;
    };
    /**
     * launch-binding primitive (OPR.0.3.3.24): given an already-created node and
     * its member context, bring it fully live — harness launch + startup
     * projection + delivery + readiness + `@rigged_*` metadata. Dispatches the
     * terminal vs agent launch path. Extracted as an independently-callable
     * primitive so launchMaterialized's loop, `expand`, and the `add_member`
     * converge op all launch a node WITHOUT fabricating a synthetic rig spec.
     * Behaviour is identical to the prior inline dispatch.
     */
    launchBinding(input: {
        rigId: string;
        rigSpec: PodRigSpec;
        rigRoot: string;
        pod: RigSpecPod;
        member: RigSpecPodMember;
        qualifiedId: string;
        nodeId: string;
        cwdOverride?: string;
        envOverride?: SeatEnv;
    }): Promise<{
        status: "launched" | "failed" | "attention_required";
        error?: string;
        evidence?: string;
        sessionName?: string;
        warnings?: string[];
    }>;
    /**
     * OPR.0.4.8.3 Seam B — the ONE precedence + resolution point for a seat's permission
     * policy at launch: member ref > rig ref > absent (undefined = the env-driven floor).
     * Custom refs resolve relative to the rig root (the declaring RigSpec's directory in a
     * materialized rig). Returns undefined when no ref is attached at either level.
     */
    private resolveMemberPolicyAttachment;
    /** Seam B Guard-F2: the STRICT materialize/add-member persist — provenance here is
     *  LOAD-BEARING restart state; a real write failure must fail the surrounding
     *  transaction, never commit a node without it. (The repository setter itself still
     *  no-ops on pre-057 legacy fixture DBs — that narrow compatibility is preserved.) */
    private persistNodePolicyProvenanceStrict;
    /** Seam B: the LAUNCH-time refresh stays best-effort (idempotent re-write on an already-
     *  materialized node; a transient failure must not block a launch). */
    private persistNodePolicyProvenance;
    private launchExistingAgentMember;
    private launchExistingTerminalMember;
    private updateNodeResolvedConfig;
    private buildTerminalResolvedStartupFiles;
    private buildResolvedStartupFiles;
    private dedupeProjectedManagedStartupFiles;
    private buildSessionIdentityAction;
    /**
     * Resolve any remaining 'auto' delivery hints to concrete hints at plan time.
     * Uses the shared resolveConcreteHint resolver (single source of truth).
     * After this, no file should have deliveryHint === 'auto'.
     */
    private resolveAutoHints;
}
export {};
//# sourceMappingURL=rigspec-instantiator.d.ts.map