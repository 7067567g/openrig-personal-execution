import { spawn } from "node:child_process";
import type { AppliedLaunchObservation } from "./permission-drift.js";
/** The override added to an eligible launch. */
export declare const CODEX_NETWORK_DEFAULT_OVERRIDE = "sandbox_workspace_write.network_access=true";
export type CodexNetworkDecision = {
    apply: true;
} | {
    apply: false;
    reason: string;
};
export type CodexNetworkDefault = CodexNetworkDecision & {
    elapsedMs: number;
};
/** Reads the network default for a seat that would run in `cwd`. */
export type CodexNetworkDefaultReader = (cwd: string) => Promise<CodexNetworkDefault>;
/**
 * Decides from the two RPC results alone. A missing origin is not proof of no policy (Codex leaves
 * requirement-pinned and packaged-default values out of `origins`), so the requirements answer and
 * the effective value are checked too, and anything unrecognized adds nothing.
 */
export declare function decideCodexNetworkDefault(configRead: unknown, requirementsRead: unknown): CodexNetworkDecision;
/**
 * The segment a launch inserts right after its posture flag: the override when the reader applies
 * it, otherwise "". Only the plain `-s workspace-write` floor is read; a named profile, YOLO or full
 * bypass launch is left exactly as it was, and so is any launch without a reader.
 */
export declare function codexNetworkDefaultArg(read: CodexNetworkDefaultReader | undefined, appliedLaunch: AppliedLaunchObservation, cwd: string, session: string): Promise<string>;
export interface CodexNetworkReaderOptions {
    /** The PATH the seat's launch command runs with. */
    launchPath?: string;
    /** The HOME and CODEX_HOME the seat's session gets. */
    home?: string;
    codexHome?: string;
    /** Answers must arrive within this; then stdin EOF, and TERM/KILL of the reader's process group. */
    deadlineMs?: number;
    graceMs?: number;
    /** Largest stdout the reader buffers. */
    maxOutputBytes?: number;
}
export declare const CODEX_NETWORK_READER_DEADLINE_MS = 4000;
/** The production reader: asynchronous, so the daemon keeps serving while Codex starts. */
export declare function codexNetworkDefaultReader(options?: CodexNetworkReaderOptions): CodexNetworkDefaultReader;
/** stdin EOF first; then TERM, then KILL, to the reader's own process group while any member remains. */
export declare function stopGroup(child: ReturnType<typeof spawn>, graceMs: number): Promise<void>;
//# sourceMappingURL=codex-network-default.d.ts.map