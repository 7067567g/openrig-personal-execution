import type { Binding } from "./types.js";
import type { ProjectionPlan } from "./projection-planner.js";
export interface NodeBinding extends Binding {
    cwd: string;
    model?: string;
    effort?: string;
    codexConfigProfile?: string;
    /** OPR.0.4.8.3 Seam B: the seat's RESOLVED launch posture from its permission_policy
     * attachment (member > rig precedence, resolved by the core resolver at materialize /
     * restore). Absent = no policy attached → the env-driven floor/YOLO decision stands.
     * Present = authoritative for this seat (overrides the env read in BOTH directions). */
    launchPosture?: "floor" | "full_bypass" | "auto";
    /** Explicit Claude native mode; checked against the bound managed executable. */
    permissionMode?: string;
    /** Persisted rig opt-in to per-launch warning acceptance, only at full_bypass. */
    nonInterruptive?: boolean;
    /** Launch-only operational default, derived from the persisted kernel rig and explicit selections. */
    kernelAuthority?: boolean;
    /** Derived at launch only when no authored policy, seat choice or native profile applies. */
    teamPermissionDefault?: boolean;
    /** Reserved successor generation; current tenure remains the input fence until commit. */
    launchGeneration?: string;
    /** #25: the rig's `managed_blocks.claude-code` file. Absent = CLAUDE.md. Only the Claude adapter reads it. */
    claudeManagedBlockFile?: import("./managed-blocks.js").ClaudeManagedBlockFile;
}
export interface ResolvedStartupFile {
    /** Explicit per-seat role orientation; never inferred from the filename. */
    orientation?: "role";
    path: string;
    absolutePath: string;
    ownerRoot: string;
    deliveryHint: "auto" | "guidance_merge" | "skill_install" | "send_text";
    required: boolean;
    appliesOn: ("fresh_start" | "restore")[];
    /** Optional discriminator; startup artifacts are files only. */
    kind?: "file";
}
export interface InstalledResource {
    effectiveId: string;
    category: string;
    installedPath: string;
}
export interface ProjectionResult {
    warnings?: string[];
    projected: string[];
    skipped: string[];
    failed: Array<{
        effectiveId: string;
        error: string;
    }>;
}
export interface StartupDeliveryResult {
    warnings?: string[];
    delivered: number;
    failed: Array<{
        path: string;
        error: string;
    }>;
}
export interface ReadinessResult {
    ready: boolean;
    reason?: string;
    code?: string;
}
export declare const ATTENTION_REQUIRED_READINESS_CODES: Set<string>;
export declare function isAttentionRequiredReadinessCode(code: string | undefined): boolean;
export type HarnessLaunchRecovery = "retry_fresh" | "attention_required";
export type HarnessLaunchResult = {
    ok: true;
    resumeToken?: string;
    resumeType?: string;
    appliedLaunch?: import("./permission-drift.js").AppliedLaunchObservation;
    launchedProcess?: import("./native-process-lineage.js").ClaudeLaunchedProcess;
} | {
    ok: false;
    error: string;
    recovery?: HarnessLaunchRecovery;
    evidence?: string;
    missingConversation?: true;
    launchedProcess?: import("./native-process-lineage.js").ClaudeLaunchedProcess;
};
/**
 * Resolve 'auto' delivery hint to a concrete hint.
 * Single source of truth — used by both the startup partition and adapter delivery.
 * Rules match existing adapter logic byte-for-byte.
 */
export declare function resolveConcreteHint(path: string, content: string): "guidance_merge" | "skill_install" | "send_text";
/**
 * Member-level fork-source input translated by the startup orchestrator from
 * the rigspec member's `sessionSource` field. v1 narrow MVP: kind="native_id"
 * only; other shapes are rejected at schema validation today.
 *
 * Adapters that support fork (claude-code, codex) build their respective
 * fork command from this input and capture the NEW post-fork token, never
 * the parent. Adapters that don't support fork (terminal) refuse with a
 * clear runtime-mismatch error.
 */
export interface ForkSource {
    kind: "native_id" | "artifact_path" | "name" | "last";
    value?: string;
    /** Set only by a seat handover: a launch whose new id isn't captured yet still succeeds, with the id
     *  pending, so the handover can commit the ready successor. Every other fork caller keeps the
     *  refusal on a missed capture. */
    pendingIdAllowed?: boolean;
}
/**
 * The five-method runtime adapter contract.
 * Adapters own projection, delivery, harness launch, reconciliation, and readiness.
 * Startup action execution is NOT part of this contract — that belongs
 * to the startup orchestrator after checkReady().
 */
export interface RuntimeAdapter {
    /** Claude's managed capability/launch seam, shared with seat selection. */
    readonly claudeManagedLaunch?: import("./claude-managed-launch.js").ClaudeManagedLaunch;
    readonly runtime: string;
    /** The file an adapter's project() writes for a skill when it lives outside
     *  the Claude project tree, for "already in place" detection. Absent = the
     *  instantiator's default target. */
    skillTargetPath?(tmuxSession: string | null, effectiveId: string): string | null;
    /** List currently installed/projected resources for a node. */
    listInstalled(binding: NodeBinding): Promise<InstalledResource[]>;
    /** Project resources from a projection plan to the runtime target locations. */
    project(plan: ProjectionPlan, binding: NodeBinding): Promise<ProjectionResult>;
    /** Deliver startup files. Claude's post-launch path can reuse the orchestrator's checked send.
     * The adapter still owns file reads, ordering, provisioning and required/optional errors. */
    deliverStartup(files: ResolvedStartupFile[], binding: NodeBinding, sendInteractiveText?: (text: string) => Promise<void>): Promise<StartupDeliveryResult>;
    /**
     * Launch the harness (claude/codex/terminal) inside the tmux session.
     *
     * `resumeToken` and `forkSource` are mutually exclusive. If both are
     * provided, adapters MUST refuse with a clear error rather than guess.
     * `forkSource` triggers a fork from the named source; the captured
     * resumeToken in the result is the NEW post-fork token, never the parent.
     */
    launchHarness(binding: NodeBinding, opts: {
        name: string;
        resumeToken?: string;
        forkSource?: ForkSource;
    }): Promise<HarnessLaunchResult>;
    /** Check if the runtime harness is responsive and ready. */
    checkReady(binding: NodeBinding): Promise<ReadinessResult>;
}
//# sourceMappingURL=runtime-adapter.d.ts.map