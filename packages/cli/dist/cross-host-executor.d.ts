import { type ChildProcess } from "node:child_process";
import type { HostEntry } from "./host-registry.js";
/**
 * Structured result of a cross-host command. Distinguishes SSH-layer failures
 * (couldn't reach the remote shell) from remote-command failures (reached the
 * remote shell, but the command itself returned non-zero). This distinction
 * is load-bearing: collapsing both into "failed" hides the operational
 * difference between "fix your SSH" and "fix your remote rig daemon."
 */
export type CrossHostResult = {
    ok: true;
    failedStep: "none";
    stdout: string;
    stderr: string;
    remoteExitCode: 0;
} | {
    ok: false;
    failedStep: "ssh-unreachable";
    sshStderr: string;
} | {
    ok: false;
    failedStep: "permission-gate";
    sshStderr: string;
    hint?: string;
} | {
    ok: false;
    failedStep: "remote-daemon-unreachable";
    stdout: string;
    stderr: string;
    remoteExitCode: number;
} | {
    ok: false;
    failedStep: "remote-command-failed";
    stdout: string;
    stderr: string;
    remoteExitCode: number;
} | {
    ok: false;
    failedStep: "remote-command-not-found";
    stdout: string;
    stderr: string;
    remoteExitCode: number;
    hint: string;
};
export type { FailedStep } from "./cross-host-types.js";
/**
 * Pluggable spawn function for testing. The default uses Node's
 * `child_process.spawn` directly. Tests inject a mock that returns a
 * controllable process-like object.
 */
export type SpawnFn = (command: string, args: readonly string[]) => ChildProcess;
export interface RunCrossHostCommandOpts {
    /** Optional stdin to write to the spawned ssh process (forwarded to remote stdin). */
    stdin?: string;
    /** Inject a non-default spawn function (used in tests). */
    spawn?: SpawnFn;
    /** Connect timeout in seconds for the underlying ssh invocation. Default: 10. */
    connectTimeoutSeconds?: number;
    /**
     * A2 (P23) HTTP/SSH origin parity: the ORIGIN's identity triple (member@rig@selfHostId), composed by
     * the caller from the seat env + this host's selfHostId (an upstream triple preserved verbatim, never
     * re-stamped). When present, it is prefixed as `OPENRIG_SESSION_NAME=<triple>` INSIDE the remote
     * `sh -lc` line so the remote's DaemonClient stamps the ORIGIN identity (matching A4's HTTP header) —
     * the SSH relay would otherwise resolve its OWN seat and degrade attribution. Absent ⇒ no prefix
     * (byte-unchanged). This is a DERIVED origin, never a caller-supplied identity claim.
     */
    originTriple?: string;
}
/**
 * Run a remote rig command via single-hop ssh. Returns a structured result
 * that maps each failure mode named in the dossier to a distinct
 * `failedStep` value.
 *
 * Important: this function does NOT collapse remote `--verify` semantics into
 * the SSH exit code. Callers that pass `--verify` get the remote command's
 * stdout (containing `Verified: yes`/`no`) verbatim; the remote rig is
 * authoritative on verification. SSH success (exit 0) just means "we reached
 * the remote shell and it ran the command", not "the verify passed."
 */
export declare function runCrossHostCommand(host: HostEntry, argv: readonly string[], opts?: RunCrossHostCommandOpts): Promise<CrossHostResult>;
/**
 * Map the spawned ssh exit code + stderr signature to a structured result.
 *
 * - Exit 0 → success.
 * - Exit 255 → ssh-layer failure. If stderr matches a known permission/auth
 *   gate (Permission denied, Keychain, host key verification), classify as
 *   `permission-gate` with inline guidance for the reported SSH failure.
 *   Otherwise classify as `ssh-unreachable`.
 * - Any other non-zero → ssh succeeded but the remote rig command failed.
 *   If the remote stderr matches the daemon-not-running signature, classify
 *   as `remote-daemon-unreachable`; otherwise `remote-command-failed`.
 */
export declare function classifyResult(exitCode: number, stdout: string, stderr: string): CrossHostResult;
export declare function looksLikePermissionGate(stderr: string): boolean;
/**
 * Single-quote shell escaping. Wraps the input in single quotes, escaping
 * any embedded single quotes via `'\''`. Safe for passing as a single arg
 * to a remote POSIX shell.
 */
export declare function shellQuote(s: string): string;
//# sourceMappingURL=cross-host-executor.d.ts.map