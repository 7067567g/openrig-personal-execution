import readline from "node:readline";
import { type PiCredentialEvidence } from "./pi-readiness.js";
import { type PiUsageFact } from "../domain/pi-usage-facts.js";
import { type ChargeProvenance } from "./pi-openrouter-charge.js";
import { type PiRunnerState, type RunnerRuntime } from "./pi-runner-protocol.js";
export declare const MAX_PI_INPUT_BYTES: number;
export declare function createRunnerInput(input: NodeJS.ReadStream, output: NodeJS.WriteStream, onSubmit: (block: string) => void): readline.Interface;
export interface MirrorAndActivity {
    /** Lines to print to the pane (already human-readable). */
    mirrorLines: string[];
    /** Raw text to append to the current mirror line (streamed deltas). */
    mirrorAppend?: string;
    /** Activity POST payload (hookEvent/subtype), when the event maps to one. */
    activity?: {
        hookEvent: string;
        subtype: string | null;
    };
    /** Streaming-state transition, when the event carries one. */
    streaming?: boolean;
    /** A typed terminal failure; the core coalesces its exhausted-retry notice. */
    errorNotice?: string;
}
export declare function mapPiEvent(event: Record<string, unknown>, runtime?: RunnerRuntime): MirrorAndActivity;
export interface RunnerIo {
    /** Write one JSONL command to pi stdin. */
    sendRpc(cmd: Record<string, unknown>): void;
    /** Print a full line to the pane. */
    mirrorLine(line: string): void;
    /** Append raw text to the current pane line (streamed deltas). */
    mirrorAppend(text: string): void;
    /** POST to the daemon activity endpoint. May resolve to the parsed JSON
     *  response (null on transport failure) so identity delivery can retry. */
    postActivity(payload: Record<string, unknown>): void | Promise<Record<string, unknown> | null>;
    /** Persist the runner-state sidecar. */
    writeSidecar(state: PiRunnerState): void;
    /** OMP can announce a path before a session file exists. */
    sessionFileExists?(path: string): boolean;
    /** Terminate OMP when get_state cannot establish a resumable seat. */
    stopChild?(): void;
    /** OPR.0.7.0.2 (only with --usage-facts): POST usage facts from persisted entries to the daemon. Best-effort;
     *  resolves true only when the daemon accepted them. */
    postUsageFacts?(payload: Record<string, unknown>): Promise<boolean | {
        charged: string[];
    }>;
    /** OPR.0.7.0.2 K4 (only with --openrouter-charge): queue OpenRouter charge lookups for facts the daemon stored;
     *  `charged` already have a charge there. */
    enqueueChargeLookups?(piSessionId: string, items: Array<{
        fact: PiUsageFact;
        provenance: ChargeProvenance;
    }>, charged: ReadonlySet<string>): void;
    /** OPR.0.7.0.2 K4: Pi's OpenRouter credential metadata now (taken at start and at every refresh). */
    credentialEvidence?(): PiCredentialEvidence;
    /** The first line of a Pi session file (its header), or null when it can't be read. */
    readFirstLine?(path: string): string | null;
    /** The entry ids of a complete, valid Pi session file (a fork's parent); null when it isn't one. Never blocks. */
    readSessionEntryIds?(path: string): Promise<ReadonlySet<string> | null>;
    now(): string;
}
/**
 * OPR.0.7.0.2: the entry ids of a fork's parent session file, read only to decide a tie with the fork header.
 * Absence from the result is a claim that the parent doesn't have the entry, so only a complete, valid file
 * answers: a regular file (checked on the opened handle, opened non-blocking so a FIFO or device can't stall the
 * runner), at most `limitBytes` actually read from that handle, a session header first, every line a whole
 * entry with an id, and no torn last line. Anything else is null (the tie stays unknown and is retried). Ids only.
 */
export declare function readPiSessionEntryIds(path: string, limitBytes?: number, 
/** Test seam only: called after the stat and after the read, to change the file at those points. */
testHooks?: {
    afterStat?: () => void | Promise<void>;
    afterRead?: () => void | Promise<void>;
}): Promise<ReadonlySet<string> | null>;
export declare class RunnerCore {
    private io;
    private identity;
    private opts;
    private streaming;
    private sessionFile;
    private sessionId;
    private lastEntryId;
    private ready;
    private assistantErrorShown;
    private started;
    /** OMP attention (runtime_error | permission_prompt) that must survive the
     *  end of the turn; cleared by the next agent_start. */
    private attention;
    /** Whether the last activity posted is that attention. Later activity in
     *  the same turn (a tool call after a denied approval) replaces it. */
    private attentionIsLatest;
    /** Set once the daemon confirms it persisted the resume token. */
    private identityPersisted;
    private identityInFlight;
    /** OPR.0.7.0.2: the session header boundary; null until it has been read (read again until it can be). */
    private usageBoundary;
    /** OPR.0.7.0.2 K4: the last credential observation, and each entry's provenance judged when first observed. */
    private lastCredentialEvidence;
    /** Sticky for this process: what an observation showed Pi may have loaded (see credentialTaint). */
    private credentialTainted;
    private readonly chargeProvenance;
    /** OPR.0.7.0.2: a fork parent read is under way (at most one at a time). */
    private parentReadInFlight;
    /** OPR.0.7.0.2: the last get_entries batch reported, replayed when a parent read completes. */
    private latestUsageEntries;
    /** Entry ids the daemon has accepted with a known origin. Anything else is sent again on the next refresh;
     *  the daemon stores each (session, entry) once regardless. */
    private readonly postedUsageEntryIds;
    /** #1275: OMP protocol v2. The limit offered while negotiating, then the decoder once OMP accepts. */
    private v2Limit;
    private frameDecoder;
    constructor(io: RunnerIo, identity: {
        sessionName: string;
        nodeId?: string;
        launchId?: string;
        generation?: string;
    }, opts?: {
        catchUpSince?: string;
        runtime?: RunnerRuntime;
        usageFacts?: boolean;
        openRouterCharge?: boolean;
        /** K4: the credential observation taken before Pi was spawned. */
        launchCredentialEvidence?: PiCredentialEvidence;
    });
    /** Runner readiness is the sidecar's acknowledged get_state, not RPC transport ready. */
    isReady(): boolean;
    /** Kick off identity capture. Called once pi's RPC stream is up; for OMP, with its `ready` frame. */
    start(ready?: Record<string, unknown>): void;
    /** One LF-delimited JSONL record from pi stdout. */
    handlePiLine(rawLine: string): void;
    /** A frame that can't be reassembled is lost, and said so. If it was a get_entries reply, the cursor stays where it was. */
    private reportDroppedFrame;
    private get runtime();
    /** One aggregated paste block from pane stdin. */
    handleUserBlock(block: string): void;
    /** Child process exit — honest, loud, durable. */
    handlePiExit(code: number | null): void;
    private handleResponse;
    /** OPR.0.7.0.2: report usage from the persisted entries a get_entries response returned (catch-up after a
     *  restart, or the refresh after each agent_end). Pi only, and only with --usage-facts. Never live updates. */
    /** K4: what an observation shows Pi may hold for the rest of the process (an extension, a credential-bearing
     *  models.json entry, or a reading that couldn't be made) is sticky at once. */
    private noteTaint;
    private reportUsageFacts;
    private raiseAttention;
    private clearAttention;
    private handleEvent;
    /** Re-deliver OMP identity until the daemon confirms the resume token.
     *  Called from a timer so a daemon restart during the first turn cannot
     *  leave a seat with history but no restorable token. */
    retrySessionIdentity(): void;
    private postSessionIdentity;
    private activityPayload;
    private writeSidecar;
}
interface RunnerArgs {
    runtime?: RunnerRuntime;
    sessionName: string;
    stateRoot: string;
    cwd: string;
    launchId: string;
    model?: string;
    trust: "approve" | "no-approve";
    sessionFile?: string;
    forkRef?: string;
    /** OPR.0.7.0.2: report usage facts from persisted entries (the daemon passes it when usage.pi_cost_facts is on). */
    usageFacts?: boolean;
    openRouterCharge?: boolean;
}
export declare function parseRunnerArgs(argv: string[]): RunnerArgs;
/** The runner-side sidecar handshake, extracted for hermetic testing (guard
 *  re-verdict, qitem-20260707013815): read the PRIOR record's durable cursor
 *  FIRST, then stamp the launch-scoped pending record — the write carries the
 *  cursor forward so no reset in the chain can erase it. `catchUpSince` is
 *  only surfaced when resuming: a fresh/fork session has no prior projection
 *  to catch up. */
export declare function prepareRunnerSidecar(fsOps: {
    readFile(p: string): string;
    writeFile(p: string, c: string): void;
    exists(p: string): boolean;
}, runnerStatePath: string, launchId: string, resuming: boolean, now: () => string): {
    catchUpSince: string | undefined;
};
export interface ExecutableResolverOps {
    isExecutable(path: string): boolean;
    realpath(path: string): string;
    /** Run a launcher (argv, no shell) and return its trimmed stdout. */
    run(file: string, args: string[], env: NodeJS.ProcessEnv): string;
}
/** Resolve `name` to the absolute path of the real binary, using the
 *  runner's own environment. The child later runs under a per-seat HOME, and
 *  version-manager shims (mise) find their target through HOME, so the shim
 *  itself must never be what the child executes. */
export declare function resolveRuntimeExecutable(name: string, env: NodeJS.ProcessEnv, ops?: ExecutableResolverOps): {
    ok: true;
    path: string;
} | {
    ok: false;
    error: string;
};
/** Enrich an actual CLI rejection, without guessing compatibility from a version
 * or from help (older Pi prints help before validating unknown long flags). */
export declare function piLaunchCapabilityError(command: string, trust: "approve" | "no-approve", line: string, readVersion: () => string): string | undefined;
export declare function main(argv?: string[]): Promise<void>;
export {};
//# sourceMappingURL=pi-runner.d.ts.map