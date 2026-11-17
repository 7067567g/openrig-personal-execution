/**
 * S8 Wave A — thin CLI adapter for the managed-run entry guard.
 *
 * This file contains NO home classification and NO launch-record parsing: every
 * decision comes from `@openrig-local/daemon/entry-guard`. Its job is the CLI
 * contract only — `--allow-direct` pre-parse stripping, the exit-2 error shape,
 * and the shared single entry point used by L0 (argv) and L1 (`startDaemon()`).
 */
import { realpathSync } from "node:fs";
import { checkEntry, } from "../daemon/dist/entry-guard-surface.js";
import { getOpenRigHome } from "./openrig-compat.js";
import { wantsJsonOutput } from "./cli-error.js";
const ALLOW_DIRECT = "--allow-direct";
const ALLOW_DIRECT_REASON = "--allow-direct-reason";
/**
 * Remove `--allow-direct` / `--allow-direct-reason <text>` from the WHOLE argv
 * (prefix included), stopping at `--` — after `--` a flag is positional data and
 * must not be stripped (that is the boundary the matrix asserts). The caller must
 * rebuild `argv[2]` from the returned array before lazy command resolution.
 */
export function stripAllowDirect(argv) {
    const out = [];
    let allowDirect = false;
    let allowDirectReason;
    for (let i = 0; i < argv.length; i++) {
        const token = argv[i];
        if (token === "--") {
            out.push(...argv.slice(i));
            break;
        }
        if (token === ALLOW_DIRECT) {
            allowDirect = true;
            continue;
        }
        if (token === ALLOW_DIRECT_REASON) {
            const value = argv[i + 1];
            if (value !== undefined) {
                allowDirectReason = value;
                i += 1;
            }
            continue;
        }
        if (token.startsWith(`${ALLOW_DIRECT_REASON}=`)) {
            allowDirectReason = token.slice(ALLOW_DIRECT_REASON.length + 1);
            continue;
        }
        out.push(token);
    }
    return allowDirectReason === undefined
        ? { argv: out, allowDirect }
        : { argv: out, allowDirect, allowDirectReason };
}
/** The only home resolution the guard uses (openrig-compat is the single source). */
export function resolveGuardHome(env = process.env) {
    const configured = env["OPENRIG_HOME"] ?? env["RIGGED_HOME"];
    if (configured !== undefined && configured !== "")
        return configured;
    return getOpenRigHome();
}
function realHome(home) {
    try {
        return realpathSync(home);
    }
    catch {
        return home;
    }
}
const processState = new Map();
function stateFor(home) {
    const key = realHome(home);
    let state = processState.get(key);
    if (!state) {
        state = { consumed: new Set(), override: false, recovery: false, disabled: false };
        processState.set(key, state);
    }
    return state;
}
/** Test hook: forget in-process consumption/escape state (never touches disk). */
export function resetEntryGuardProcessState(home) {
    if (home === undefined)
        processState.clear();
    else
        processState.delete(realHome(home));
}
/** The one recovery instruction every denial carries (human lines and JSON). */
export const ENTRY_GUARD_HINT = "openrig-run start --run-dir <run-dir>";
export class EntryGuardError extends Error {
    code;
    exitCode = 2;
    /** S9 W-S8-11 — the machine-readable next step that rides the JSON error object. */
    hint;
    constructor(code, message, hint = ENTRY_GUARD_HINT) {
        super(message);
        this.name = "EntryGuardError";
        this.code = code;
        this.hint = hint;
    }
}
function describeVerb(verb, mode) {
    if (verb === "daemon-start")
        return "rig daemon start";
    if (verb === "up")
        return "rig up";
    if (verb === "restore-apply")
        return "rig restore apply";
    if (verb === "workflow-instantiate")
        return "rig workflow instantiate";
    if (verb === "workflow-instantiate-lifecycle")
        return "rig workflow instantiate-lifecycle";
    if (verb === "workflow-run")
        return "rig workflow run";
    if (verb === "snapshot-create")
        return "rig snapshot";
    if (verb === "archive")
        return "rig archive";
    if (verb === "unarchive")
        return "rig unarchive";
    if (verb === "compact")
        return "rig compact";
    if (verb === "seat-launch")
        return "rig seat launch";
    if (verb === "seat-restart")
        return "rig seat restart";
    if (verb === "seat-stop")
        return "rig seat stop";
    if (verb === "seat-clean")
        return "rig seat clean";
    if (verb === "seat-handover")
        return "rig seat handover";
    if (verb === "seat-continue")
        return "rig seat continue";
    if (verb === "workflow-route")
        return "rig workflow route";
    if (verb === "workflow-resume")
        return "rig workflow resume";
    if (verb === "workflow-abort")
        return "rig workflow abort";
    if (verb === "workflow-revision")
        return "rig workflow revise";
    if (verb === "workflow-project")
        return "rig workflow project";
    if (verb === "release")
        return "rig release";
    if (verb === "attach")
        return "rig attach";
    if (verb === "add-member")
        return "rig add";
    if (verb === "grow")
        return "rig grow";
    if (verb === "expand")
        return "rig expand";
    if (verb === "shrink")
        return "rig shrink";
    if (verb === "remove-node")
        return "rig remove";
    if (verb === "launch-node")
        return "rig launch";
    if (verb === "create")
        return "rig create";
    if (verb === "import-rig")
        return "rig import";
    if (verb === "adopt")
        return "rig adopt";
    if (verb === "fork")
        return "rig fork";
    if (verb === "bind")
        return "rig bind";
    if (verb === "bootstrap")
        return "rig bootstrap";
    if (verb === "bundle-install")
        return "rig bundle install";
    if (verb === "reconcile-session")
        return "rig reconcile-session";
    if (verb === "unclaim")
        return "rig unclaim";
    if (verb === "seat-clear-attention")
        return "rig seat clear-attention";
    if (verb === "seat-resume-token")
        return "rig seat set-resume-token";
    return mode === "remote" ? "rig up --host" : "rig <entry command>";
}
/** One-line message shared by L0 (JSON/human renderer) and L1 (EntryGuardError). */
export function denialMessage(decision, home) {
    const label = describeVerb(decision.verb, decision.mode);
    const code = decision.code ?? "entry_guard_denied";
    return `entry guard denied '${label}' on managed run home ${home}: ${decision.reason} (code: ${code}). Use: ${ENTRY_GUARD_HINT}`;
}
/**
 * Evaluate the guard for a command tail (no node/script prefix). Tracks verbs
 * consumed by THIS process so `rig daemon start` can pass L0 and L1 without the
 * second check being read as a re-use of the same token.
 */
export async function evaluateEntry(argv, options = {}) {
    const home = options.home ?? resolveGuardHome(options.env);
    const env = options.env ?? process.env;
    const state = stateFor(home);
    if (options.allowDirect === true)
        state.override = true;
    if (env["OPENRIG_ALLOW_DIRECT"] === "1")
        state.override = true;
    if (env["OPENRIG_ENTRY_GUARD"] === "off")
        state.disabled = true;
    const decision = checkEntry({
        argv,
        home,
        env,
        ...(options.now ? { now: options.now } : {}),
        allowDirect: options.allowDirect ?? false,
        ...(options.allowDirectReason !== undefined
            ? { allowDirectReason: options.allowDirectReason }
            : {}),
        alreadyConsumed: [...state.consumed],
        ...(options.pid !== undefined ? { pid: options.pid } : {}),
    });
    if (decision.allow && decision.mode === "recovery")
        state.recovery = true;
    if (decision.allow && decision.mode === "entry" && decision.verb) {
        state.consumed.add(decision.verb);
    }
    return decision;
}
/**
 * L0 renderer: JSON goes to stdout as `{ok:false,error:{code,message}}` (the ONLY
 * shape `formatCliError` can produce), human goes to stderr as four lines.
 * Returns the exit code (always 2) so callers can `process.exit(renderDenial(...))`.
 */
export function renderDenial(decision, context, io = {}) {
    const out = io.out ?? ((line) => process.stdout.write(`${line}\n`));
    const err = io.err ?? ((line) => process.stderr.write(`${line}\n`));
    const code = decision.code ?? "entry_guard_denied";
    const label = describeVerb(decision.verb, decision.mode);
    const message = denialMessage(decision, context.home);
    if (wantsJsonOutput(context.argv)) {
        out(JSON.stringify({ ok: false, error: { code, message } }));
    }
    else {
        err(`error: entry guard denied '${label}' on managed run home ${context.home}`);
        err(`  Why: ${decision.reason} (code: ${code})`);
        err(`  Use: ${ENTRY_GUARD_HINT}`);
        err("  See: openrig-run next --run-dir <run-dir>");
    }
    return 2;
}
/**
 * L1 entry point: the same evaluation, but a deny throws `EntryGuardError`
 * (code + exitCode 2) so the existing CLI error path renders it. A launch that
 * already passed L0 in this process (override / recovery / off) is not re-judged.
 */
export async function assertEntry(argv, options = {}) {
    const home = options.home ?? resolveGuardHome(options.env);
    const state = stateFor(home);
    if (state.override || state.recovery || state.disabled || state.consumed.has("daemon-start")) {
        return {
            allow: true,
            code: null,
            reason: "already authorized earlier in this process",
            verb: "daemon-start",
            mode: "entry",
            homeKind: "managed",
            warn: false,
            launchId: null,
        };
    }
    const decision = await evaluateEntry(argv, options);
    if (!decision.allow) {
        throw new EntryGuardError(decision.code ?? "entry_guard_denied", denialMessage(decision, home));
    }
    return decision;
}
//# sourceMappingURL=entry-guard.js.map