import type { DaemonClient } from "../client.js";
/**
 * OPR.0.4.6.WF3 FR-1 — the shared follow engine behind `rig workflow
 * run` and `rig workflow watch`: two verbs, ONE renderer (the argo
 * shape: same render at attach and live).
 *
 * Transport: the SHIPPED workflow SSE endpoint (`GET
 * /api/workflow/sse`) consumed with the in-repo chatroom reader
 * pattern (fetch + event-stream line decode). Zero daemon changes
 * (BR-2) — this file only reads.
 *
 * Attach race (arch R2, snapshot-first-then-stream): the stream is
 * OPENED first, then a state snapshot (`/trace`) is rendered, then
 * live events flow. Events that duplicate a trail row already in the
 * snapshot are deduped by priorQitemId, so fast early steps that
 * close before attach are still shown exactly once.
 *
 * Exit codes (arch n1 — outcome codes DISTINCT from error codes):
 *   0 = workflow completed
 *   3 = workflow FAILED or aborted (the outcome-as-exit-code kubectl default —
 *       a workflow that fails is a command that fails; never collides
 *       with the shipped 1=4xx / 2=5xx transport codes)
 */
export declare const EXIT_WORKFLOW_FAILED = 3;
export interface FollowInstanceView {
    instanceId: string;
    workflowName?: string;
    status: string;
    currentStepId?: string | null;
    currentFrontier?: string[];
}
export interface FollowTrailRow {
    stepId: string;
    stepRole?: string;
    closedAt?: string;
    closureReason: string;
    actorSession: string;
    nextQitemId?: string | null;
    priorQitemId: string;
}
export interface FollowIo {
    /** stdout line sink (tests inject; default console.log). */
    out: (line: string) => void;
    /** stderr line sink for honest transport-state notices. */
    err: (line: string) => void;
    /** sleep injection so tests never wait wall-clock. */
    sleep: (ms: number) => Promise<void>;
    /** fetch injection for the SSE leg (tests stub the stream). */
    fetchImpl: typeof fetch;
}
export declare function realFollowIo(): FollowIo;
export interface FollowOptions {
    json: boolean;
    io?: FollowIo;
    /** SSE reconnect attempts before degrading to the poll fallback. */
    maxReconnects?: number;
    /** Deadline for opening SSE response headers; streamed bodies remain unbounded. */
    streamConnectTimeoutMs?: number;
    /** Poll fallback interval (ms). */
    pollIntervalMs?: number;
}
/** Outcome → process exit code, per the FR-1 contract. */
export declare function outcomeExitCode(status: string): number;
/**
 * Follow one instance to a terminal state. Returns the exit code the
 * caller should set (0 completed / 3 failed / 1 transport-4xx / 2
 * transport-5xx). Never throws for stream drops — those degrade
 * honestly (reconnect notice → poll-fallback notice), per the
 * chatroom precedent: the render may fall back, it never freezes
 * silently.
 */
export declare function followInstance(client: DaemonClient, instanceId: string, opts: FollowOptions): Promise<number>;
//# sourceMappingURL=workflow-follow.d.ts.map