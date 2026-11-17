import { Command } from "commander";
import type { StatusDeps } from "./status.js";
import { loadHostRegistry } from "../host-registry.js";
import { runCrossHostCommand, type RunCrossHostCommandOpts } from "../cross-host-executor.js";
interface NodeEntry {
    rigId: string;
    rigName: string;
    logicalId: string;
    podId: string | null;
    podNamespace?: string | null;
    /** Slice 13 fix 2 — the serving daemon's boot-reconciled self-id, stamped per row at the source
     *  (null before the daemon reconciles). Distinct from the -A fan-out's `hostId`, which is the
     *  CALLER'S registry alias for the host it queried. */
    hostSelfId?: string | null;
    canonicalSessionName: string | null;
    nodeKind: "agent" | "infrastructure";
    runtime: string | null;
    model: string | null;
    /** Effective permission-policy REF (member ref > rig ref), or null. */
    permissionPolicy?: string | null;
    permissionPolicySource?: "node" | "rig" | null;
    /** Persisted effective launch posture; "unknown" when no provenance is attached. */
    launchPosture?: "floor" | "full_bypass" | "auto" | "unknown";
    launchPostureSource?: "node" | "rig" | null;
    /** Persisted rig-level non-interruptive choice; null = unknown (old daemon/schema). */
    nonInterruptive?: boolean | null;
    sessionStatus: string | null;
    intentionallyStopped?: boolean;
    startupStatus: "pending" | "ready" | "attention_required" | "failed" | null;
    restoreOutcome: string;
    oriented?: string;
    lifecycleState?: "running" | "detached" | "recoverable" | "attention_required";
    tmuxAttachCommand: string | null;
    resumeCommand: string | null;
    latestError: string | null;
    /** Slice 15 — `terminal-active` primitive. true=producing output,
     *  false=silent past threshold, null=no signal. NEVER derived from
     *  hasAssignedWork (non-inference contract). */
    terminalActive?: boolean | null;
    /** S19 — the served taxonomy state (display pre-derived by the daemon's one bridge). */
    activityState?: {
        activity: string;
        display: string;
        needsInput: {
            count: number;
            reason: string | null;
        };
        decidedBy: string | null;
    } | null;
    identityVerdict?: {
        reason?: string | null;
    } | null;
    /** A community agent app's seat: its label, maintainer and declared limits. */
    agentApp?: {
        app: string;
        maintainer: string | null;
        limits: string[];
        identity: string;
        needsInput: string;
        presetError?: string;
    };
    /** Slice 15 — `has-work-to-do` primitive. Derived from queue_items;
     *  NEVER derived from terminalActive. */
    hasAssignedWork?: boolean;
    /** Total active assignments (pending + in-progress + blocked). */
    assignedWorkCount?: number;
    /** Slice 15 — pending qitem count for this seat (cheap aggregate). */
    pendingWorkCount?: number;
    inProgressWorkCount?: number;
    blockedWorkCount?: number;
    /** OPR.0.3.4.11 — held reason from node.held event. */
    heldReason?: string | null;
    agentActivity?: {
        state: "running" | "needs_input" | "idle" | "unknown";
        reason: string;
        evidenceSource: string;
        sampledAt: string;
        evidence: string | null;
        rawEvent?: string | null;
        stale?: boolean;
        fallback?: boolean;
    };
    contextUsage?: {
        availability: "known" | "unknown";
        usedPercentage: number | null;
        fresh: boolean;
        state?: "critical" | "warning" | "low" | "unknown";
        sampledAt: string | null;
    };
    /** OPR.0.4.0.34 — resume summary from the daemon node-inventory. resumeToken
     *  is the SECRET: surfaced as a present-boolean in compact, value only in --full. */
    resumeType?: string | null;
    resumeToken?: string | null;
    /** OPR.0.4.0.34 — startup-completion timestamp; the compact `lastActivity`
     *  fallback when no agentActivity sample exists. */
    startupCompletedAt?: string | null;
    [key: string]: unknown;
}
/** The ONE active-rig predicate (LEG-7 extraction, fold-wave qitem 79159e6f): a rig is active unless
 *  its lifecycle status is exactly "stopped". Shared by the bare-default table projection and the
 *  rigsOnHost scope count so the "1 of N" label and the shown rows can never diverge (the
 *  derived-label-must-carry-liveness class the LEG-2 QA flagged). */
export declare function isActiveRig(entry: {
    status?: string | null;
}): boolean;
interface PsCliOptions {
    json?: boolean;
    cleanup?: boolean;
    resources?: boolean;
    nodes?: boolean;
    full?: boolean;
    verbose?: boolean;
    limit?: string;
    fields?: string;
    summary?: boolean;
    filter?: string;
    host?: string;
    allHosts?: boolean;
    hosts?: string;
    active?: boolean;
    running?: boolean;
    allRigs?: boolean;
    rig?: string;
    session?: string;
    /** OPR.0.3.3.19 - include archived rigs (default excludes them). Parity
     *  with `rig stream list --include-archived`. */
    includeArchived?: boolean;
}
export interface PsDeps extends StatusDeps {
    /**
     * Cross-host hooks. Both default to the production loaders/executors; tests
     * inject in-package mocks so no real ssh / no real ~/.ssh / no real network
     * is touched. Mirrors the SendDeps/CaptureDeps shape from the closed
     * cross-host-rig-commands slice (cdce3a6).
     */
    hostRegistryLoader?: () => ReturnType<typeof loadHostRegistry>;
    crossHostRun?: (host: Parameters<typeof runCrossHostCommand>[0], argv: readonly string[], opts?: RunCrossHostCommandOpts) => ReturnType<typeof runCrossHostCommand>;
}
/**
 * OPR.0.4.4.21 FR-2/FR-3 — THE centralized disclosure-ladder validator.
 * Runs BEFORE the local/HTTP-host/SSH/fan-out dispatch split so every path
 * obeys one grammar (qa1 plan-review: remote mode bypassed the session-rig
 * injection and fanned wide). Principle (arch-ratified): IMPLICIT SCOPE
 * DEFAULTS DON'T CROSS HOST BOUNDARIES — the session-rig default has no
 * stable referent on a remote host (a same-named rig there would silently
 * misresolve), so remote per-node views are explicit-or-error.
 * Returns the teaching error text, or null when the invocation is valid.
 */
export declare function validatePsLadder(opts: PsCliOptions, callerRig: string | undefined): string | null;
/** One line per community agent app seat: what OpenRig knows about it, and what it doesn't. */
export declare function formatAgentAppLine(seat: string, app: NonNullable<NodeEntry["agentApp"]>): string;
export declare function formatDeclaredModel(model: string | null | undefined): string;
export declare function formatNonInterruptive(value: boolean | null | undefined): "true" | "false" | "unknown";
export declare function compactNodeProjection(nodes: NodeEntry[]): Array<Record<string, unknown>>;
/**
 * `rig ps` — the consolidated fleet map + explicit disclosure ladder.
 *
 * OPR.0.4.4.21: the default is ALL active rigs, one compact O(rigs) row each
 * (the current-rig-only default is retired). The token-safety invariant: no
 * invocation returns per-node detail across all rigs unless explicitly
 * flagged (--nodes -A), and even then rows are projected unless --full.
 * Default `rig ps --json` keeps the bare-array shape for back-compat; the
 * truncation/envelope shape only applies when at least one of
 * `--limit`/`--summary`/`--fields`/`--filter` is specified.
 */
export declare function psCommand(depsOverride?: PsDeps): Command;
export declare function padNodeRow(rig: string, pod: string, member: string, session: string, runtime: string, model: string, status: string, startup: string, oriented: string, lifecycle: string, terminal: string, work: string, activity: string, ctx: string, restore: string, error: string): string;
export declare function padCompactNodeRow(rig: string, session: string, lifecycle: string, activity: string, work: string, reason: string): string;
export {};
//# sourceMappingURL=ps.d.ts.map