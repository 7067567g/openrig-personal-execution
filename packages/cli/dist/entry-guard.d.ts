import { type EntryDecision } from "@openrig-local/daemon/entry-guard";
import { type RunProgramIo } from "./cli-error.js";
export interface StripResult {
    /** argv with the escape-hatch flags removed; argv[0..1] are preserved. */
    argv: string[];
    allowDirect: boolean;
    allowDirectReason?: string;
}
/**
 * Remove `--allow-direct` / `--allow-direct-reason <text>` from the WHOLE argv
 * (prefix included), stopping at `--` — after `--` a flag is positional data and
 * must not be stripped (that is the boundary the matrix asserts). The caller must
 * rebuild `argv[2]` from the returned array before lazy command resolution.
 */
export declare function stripAllowDirect(argv: readonly string[]): StripResult;
/** The only home resolution the guard uses (openrig-compat is the single source). */
export declare function resolveGuardHome(env?: NodeJS.ProcessEnv): string;
/** Test hook: forget in-process consumption/escape state (never touches disk). */
export declare function resetEntryGuardProcessState(home?: string): void;
export interface GuardOptions {
    home?: string;
    env?: NodeJS.ProcessEnv;
    now?: Date;
    allowDirect?: boolean;
    allowDirectReason?: string;
    pid?: number;
}
/** The one recovery instruction every denial carries (human lines and JSON). */
export declare const ENTRY_GUARD_HINT = "openrig-run start --run-dir <run-dir>";
export declare class EntryGuardError extends Error {
    readonly code: string;
    readonly exitCode = 2;
    /** S9 W-S8-11 — the machine-readable next step that rides the JSON error object. */
    readonly hint: string;
    constructor(code: string, message: string, hint?: string);
}
/** One-line message shared by L0 (JSON/human renderer) and L1 (EntryGuardError). */
export declare function denialMessage(decision: EntryDecision, home: string): string;
/**
 * Evaluate the guard for a command tail (no node/script prefix). Tracks verbs
 * consumed by THIS process so `rig daemon start` can pass L0 and L1 without the
 * second check being read as a re-use of the same token.
 */
export declare function evaluateEntry(argv: readonly string[], options?: GuardOptions): Promise<EntryDecision>;
export interface DenialContext {
    /** Full argv (node + script + command), used for JSON detection. */
    argv: readonly string[];
    home: string;
}
/**
 * L0 renderer: JSON goes to stdout as `{ok:false,error:{code,message}}` (the ONLY
 * shape `formatCliError` can produce), human goes to stderr as four lines.
 * Returns the exit code (always 2) so callers can `process.exit(renderDenial(...))`.
 */
export declare function renderDenial(decision: EntryDecision, context: DenialContext, io?: RunProgramIo): number;
/**
 * L1 entry point: the same evaluation, but a deny throws `EntryGuardError`
 * (code + exitCode 2) so the existing CLI error path renders it. A launch that
 * already passed L0 in this process (override / recovery / off) is not re-judged.
 */
export declare function assertEntry(argv: readonly string[], options?: GuardOptions): Promise<EntryDecision>;
//# sourceMappingURL=entry-guard.d.ts.map