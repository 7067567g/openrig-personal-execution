import type { Command } from "commander";
/**
 * Commander option parser — a positive integer (>= 1). Rejects negative, zero,
 * and non-numeric values (finding 4). Throws InvalidArgumentError, which the
 * shared error path (below) renders as a JSON error under `--json`.
 */
export declare function positiveIntArg(value: string): number;
/** Commander option parser factory — the value must be one of `allowed` (finding 3). */
export declare function enumArg(allowed: readonly string[]): (value: string) => string;
/** True when the invocation requested machine output (`--json` or `-o/--output/--format json`). */
export declare function wantsJsonOutput(argv: readonly string[]): boolean;
/** Commander's non-error terminations (help/version) — exit cleanly, no error object. */
export declare function isCleanCommanderExit(err: unknown): boolean;
export declare function formatCliError(err: unknown): {
    ok: false;
    error: {
        code: string;
        message: string;
        hint?: string;
    };
};
/** Recursively give every command exitOverride so parse errors throw instead of exiting. */
export declare function applyExitOverride(program: Command): void;
export interface RunProgramIo {
    out?: (line: string) => void;
    err?: (line: string) => void;
    exit?: (code: number) => void;
}
/**
 * Response-integrity render: a daemon transport failure (bad-response /
 * slow-response / no-connect) becomes the repo's 3-part fact/consequence/action
 * error in BOTH json and human modes (Commander's writeErr does NOT fire for an
 * error thrown inside an action, so a human run would otherwise be SILENT).
 * Returns true when it handled `e`. A bad/slow response is NEVER rendered with
 * daemon-not-running language — the request was delivered; the outcome is unknown.
 */
export declare function renderDaemonTransportError(e: unknown, io: {
    out: (l: string) => void;
    err: (l: string) => void;
    json: boolean;
}): boolean;
/**
 * Parse+run the program through the shared error path. Injectable IO for tests.
 * Returns the process exit code (0 on success / clean help/version).
 */
export declare function runProgram(program: Command, argv: string[], io?: RunProgramIo): Promise<number>;
//# sourceMappingURL=cli-error.d.ts.map