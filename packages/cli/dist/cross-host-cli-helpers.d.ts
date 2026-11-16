import type { CrossHostResult } from "./cross-host-executor.js";
/**
 * Shared CLI-side helpers for commands that gate on `--host`. Centralizes
 * the structured failure formatting + JSON envelope so `send.ts` and
 * `capture.ts` (and any future v1 cross-host command) format identically.
 */
/**
 * OPR.0.4.6.MH4 — structured failure surface for the http transport branch.
 * Each branch names its OWN step taxonomy: the http branch surfaces
 * `runRemoteHttpOp`'s steps (registry/unknown-host/permission-gate/
 * remote-daemon-unreachable/remote-command-failed) with the host named and
 * the remote route's own error text as the detail — never a generic
 * "failed", never a locally-invented message.
 */
export declare function emitRemoteHttpFailure(hostId: string, target: string, result: {
    failedStep: string;
    error?: string;
    data?: unknown;
}, json?: boolean, hint?: string): void;
export declare function emitCrossHostError(hostId: string, code: string, message: string, json?: boolean): void;
export declare function emitCrossHostFailure(hostId: string, target: string, result: CrossHostResult, json?: boolean): void;
export declare function formatCrossHostFailure(hostId: string, target: string, result: Extract<CrossHostResult, {
    ok: false;
}>): string;
//# sourceMappingURL=cross-host-cli-helpers.d.ts.map