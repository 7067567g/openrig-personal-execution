import { spawn as nodeSpawn } from "node:child_process";
import { loadHostRegistry, type SshHostEntry } from "./../host-registry.js";
export type ParsedFileArg = {
    kind: "local";
    path: string;
} | {
    kind: "remote";
    hostId: string;
    path: string;
};
export type FileArgParse = {
    ok: true;
    arg: ParsedFileArg;
} | {
    ok: false;
    error: string;
};
export declare const REMOTE_PATH_CHARSET: RegExp;
/** The FR-4 short closed named deny list (dot-directory segments). */
export declare const DENIED_SEGMENTS: readonly [".openrig", ".ssh", ".codex", ".claude"];
export declare function parseFilePathArg(raw: string, isRegisteredHost?: (id: string) => boolean): FileArgParse;
export type PathCheck = {
    ok: true;
    normalizedPath: string;
} | {
    ok: false;
    error: string;
};
/** Local side: ~-expand, resolve (traversal collapses here), then deny-check
 *  the RESOLVED form. The resolved form is what rsync receives. */
export declare function checkLocalPath(raw: string): PathCheck;
/** Remote side: posix-normalize, then the wall — absolute-only (arch Q5),
 *  no surviving traversal, the shell-inert charset (G18-P3), and the
 *  denied-segment list. Errors TEACH (offending char + workaround). */
export declare function checkRemotePath(raw: string, hostId: string): PathCheck;
export interface CopySide {
    kind: "local" | "remote";
    /** Normalized path (resolved local / posix-normalized remote). */
    path: string;
    /** Present on remote sides. */
    host?: SshHostEntry;
}
export interface CopyPlan {
    src: CopySide;
    dst: CopySide;
    dryRun: boolean;
}
export type PlanResult = {
    ok: true;
    plan: CopyPlan;
} | {
    ok: false;
    error: string;
    code: string;
};
export interface PlanDeps {
    registryLoader?: typeof loadHostRegistry;
}
/** Validate the whole invocation — EVERY rejection here happens before any
 *  spawn (the fail-closed set; spawn-spy-asserted in tests). */
export declare function planFileCopy(rawSrc: string, rawDst: string, opts?: {
    dryRun?: boolean;
} & PlanDeps): PlanResult;
/** The ONLY place rsync arguments are assembled. Properties (test-asserted):
 *  no deletion-class flag ever present; NO -s/--protect-args (uniform argv
 *  across GNU rsync and openrsync — the G18-P3 absence pin); `--` ALWAYS
 *  precedes the two path operands; option positions are fixed. */
export declare function buildRsyncArgv(plan: CopyPlan): string[];
export type FileCopyFailedStep = "none" | "rsync-missing" | "permission-gate" | "ssh-unreachable" | "remote-command-failed";
export interface FileCopyResult {
    ok: boolean;
    failedStep: FileCopyFailedStep;
    exitCode: number | null;
    stdout: string;
    stderr: string;
    /** Parsed from rsync --stats when available. */
    bytesTransferred?: number;
    filesTransferred?: number;
    hint?: string;
}
type SpawnFn = typeof nodeSpawn;
/** rsync's classes are the executor taxonomy MINUS remote-daemon-unreachable
 *  (rsync needs no daemon — arch ruling 2). */
export declare function classifyRsyncResult(exitCode: number | null, stdout: string, stderr: string): FileCopyResult;
export declare function runFileCopy(plan: CopyPlan, deps?: {
    spawn?: SpawnFn;
}): Promise<FileCopyResult>;
export {};
//# sourceMappingURL=file-transfer.d.ts.map