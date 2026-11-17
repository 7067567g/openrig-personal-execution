#!/usr/bin/env node
import module from "node:module";
import path from "node:path";
import { existsSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
const REEXEC_GUARD_ENV = "OPENRIG_BIN_REEXEC";
// Each `rig` is a new process: Node's on-disk compile cache lets the next call skip compiling the modules
// again. The cache dates from Node v22.1.0, but this JavaScript API from v22.8.0: before it, `?.()` does
// nothing. NODE_COMPILE_CACHE and NODE_DISABLE_COMPILE_CACHE still control it.
module.enableCompileCache?.();
export function resolveBinEntry(invokedPath = process.argv[1], moduleUrl = import.meta.url) {
    const wrapperPath = invokedPath ? realpathSync(invokedPath) : realpathSync(fileURLToPath(moduleUrl));
    const packageRoot = path.resolve(path.dirname(wrapperPath), "..");
    return path.join(packageRoot, "dist", "index.js");
}
export function isDirectRun(argv1 = process.argv[1], moduleUrl = import.meta.url) {
    if (!argv1)
        return false;
    try {
        return realpathSync(argv1) === realpathSync(fileURLToPath(moduleUrl));
    }
    catch {
        return false;
    }
}
export function resolveNodeReexecBinary(currentExecPath = process.execPath, invokedPath = process.argv[1], env = process.env, exists = existsSync, realpath = realpathSync) {
    if (!invokedPath)
        return null;
    if (env[REEXEC_GUARD_ENV] === "1")
        return null;
    try {
        const binDir = realpath(path.dirname(invokedPath));
        const siblingNode = path.join(binDir, process.platform === "win32" ? "node.exe" : "node");
        if (!exists(siblingNode))
            return null;
        const normalizedSiblingNode = realpath(siblingNode);
        const normalizedCurrentExec = realpath(currentExecPath);
        if (normalizedSiblingNode === normalizedCurrentExec)
            return null;
        return normalizedSiblingNode;
    }
    catch {
        return null;
    }
}
function maybeReexecWithSiblingNode(argv = process.argv) {
    const preferredNode = resolveNodeReexecBinary(process.execPath, argv[1], process.env);
    if (!preferredNode)
        return;
    const scriptPath = argv[1] ? realpathSync(argv[1]) : fileURLToPath(import.meta.url);
    // An alias is not runtime authority. Keep a working interpreter; only switch
    // when the installed native dependency actually loads under the alternative.
    if (canLoadInstalledNative(process.execPath, scriptPath))
        return;
    if (!canLoadInstalledNative(preferredNode, scriptPath))
        return;
    const result = spawnSync(preferredNode, [scriptPath, ...argv.slice(2)], {
        stdio: "inherit",
        env: {
            ...process.env,
            [REEXEC_GUARD_ENV]: "1",
        },
    });
    if (result.error) {
        throw result.error;
    }
    process.exit(result.status ?? 0);
}
export function canLoadInstalledNative(node, wrapper) {
    const probe = spawnSync(node, ["--input-type=module", "-e",
        "import {createRequire} from 'node:module'; const require=createRequire(process.argv[1]); const D=require('better-sqlite3'); new D(':memory:').close();",
        wrapper,
    ], { encoding: "utf8", timeout: 5000, stdio: ["ignore", "pipe", "pipe"] });
    return probe.status === 0;
}
/** A command whose modules cannot be loaded fails as any other command does: the shared error object on stdout under
 *  `--json`, `error: …` on stderr otherwise, and exit 1. A human run also gets the stack, which names the module and
 *  line that failed, as Node's own crash did. The error helpers are imported only here: statically, they and the
 *  client they import would load before the compile cache is on. Should they fail to load too, Node's crash stands. */
async function failedToLoad(argv, error, io) {
    let helpers;
    try {
        helpers = await import("./cli-error.js");
    }
    catch {
        throw error;
    }
    const { formatCliError, wantsJsonOutput } = helpers;
    const failure = formatCliError(error);
    const out = io.out ?? ((l) => process.stdout.write(l + "\n"));
    const err = io.err ?? ((l) => process.stderr.write(l + "\n"));
    if (wantsJsonOutput(argv.slice(2))) {
        out(JSON.stringify(failure));
    }
    else {
        err(`error: ${failure.error.message}`);
        if (error instanceof Error && error.stack)
            err(error.stack);
    }
    (io.exit ?? ((c) => process.exit(c)))(1);
}
export async function run(argv = process.argv, io = {}) {
    const normalizedArgv = [...argv];
    if (normalizedArgv[1]) {
        normalizedArgv[1] = realpathSync(normalizedArgv[1]);
    }
    const entryPath = resolveBinEntry(normalizedArgv[1], import.meta.url);
    // S8 Wave A — L0 entry guard. Every path through this wrapper (lazy and full) sees
    // the same argv here, which is why the hook lives in run() and not in a command.
    // S10 r3 — this boundary FAILS CLOSED when the sibling guard module is missing or
    // broken. A mixed/older install must not silently run lifecycle commands unguarded;
    // the shared CLI error shape names the unusable module instead.
    const guardedArgv = await applyEntryGuard(normalizedArgv, entryPath, io);
    if (!guardedArgv)
        return;
    // A named command loads only its own module (lazy-program.ts), which ships beside the entry.
    if (guardedArgv.length > 2) {
        const lazyPath = path.join(path.dirname(entryPath), "lazy-program.js");
        let lazy;
        let program;
        try {
            lazy = await import(pathToFileURL(lazyPath).href);
            program = await lazy.createLazyProgram(guardedArgv[2]);
        }
        catch (error) {
            await failedToLoad(guardedArgv, error, io);
            return;
        }
        if (program) {
            await lazy.runProgram(program, guardedArgv, io);
            return;
        }
    }
    const entryUrl = pathToFileURL(entryPath).href;
    let mod;
    try {
        mod = await import(entryUrl);
    }
    catch (error) {
        await failedToLoad(guardedArgv, error, io);
        return;
    }
    // Slice 17: the PUBLIC bin is the real front door — bare `rig` in a TTY
    // opens the TUI here, not only under a direct `node dist/index.js` run
    // (guard finding 1: importing the entry makes its isDirectRun false).
    // Feature-detected so the wrapper still runs an older sibling entry.
    const owned = mod.runFrontDoor ? await mod.runFrontDoor(guardedArgv) : false;
    if (owned)
        return;
    // Slice 15: run through the shared error path so `--json` failures emit a JSON
    // error object with a nonzero exit instead of plain Commander text.
    await mod.runProgram(mod.createProgram(), guardedArgv, io);
}
const ENTRY_GUARD_UNAVAILABLE_CODE = "entry_guard_unavailable";
/**
 * Build the fail-closed error the wrapper reports when its sibling guard cannot be
 * loaded. It carries the CLI's machine-readable `code` so both `--json` output and
 * the human stderr line identify the mixed/broken install.
 */
function entryGuardUnavailable(dir, cause) {
    const error = new Error(`entry guard module at ${path.join(dir, "entry-guard.js")} is missing or unusable; ` +
        `refusing to run a lifecycle command unguarded: ${cause}`);
    error.code = ENTRY_GUARD_UNAVAILABLE_CODE;
    return error;
}
/**
 * Load the sibling guard module or throw `entry_guard_unavailable` (S10 r3).
 *
 * A wrapper next to an older sibling entry is a mixed install, and mixed installs
 * are not evidence that the L0 boundary exists. Fail closed rather than returning
 * the unguarded argv: otherwise every lifecycle command in that install silently
 * bypasses the guard.
 */
async function loadEntryGuard(dir) {
    let mod;
    try {
        mod = await import(pathToFileURL(path.join(dir, "entry-guard.js")).href);
    }
    catch (error) {
        throw entryGuardUnavailable(dir, error instanceof Error ? error.message : String(error));
    }
    const missing = [
        ["stripAllowDirect", mod.stripAllowDirect],
        ["evaluateEntry", mod.evaluateEntry],
        ["renderDenial", mod.renderDenial],
        ["resolveGuardHome", mod.resolveGuardHome],
    ]
        .filter(([, value]) => typeof value !== "function")
        .map(([name]) => name);
    if (missing.length > 0) {
        throw entryGuardUnavailable(dir, `missing exports: ${missing.join(", ")}`);
    }
    return mod;
}
/**
 * Strip the escape-hatch flags, run the L0 decision, and return the argv the rest of
 * the wrapper (and Commander) must see. Returns null when the guard denied and the
 * process was exited (nothing may run after a deny).
 */
async function applyEntryGuard(argv, entryPath, io) {
    let guard;
    try {
        guard = await loadEntryGuard(path.dirname(entryPath));
    }
    catch (error) {
        await failedToLoad(argv, error, io);
        return null;
    }
    const stripped = guard.stripAllowDirect(argv);
    const home = guard.resolveGuardHome(process.env);
    const decision = await guard.evaluateEntry(stripped.argv.slice(2), {
        home,
        env: process.env,
        allowDirect: stripped.allowDirect,
        ...(stripped.allowDirectReason !== undefined
            ? { allowDirectReason: stripped.allowDirectReason }
            : {}),
    });
    if (!decision.allow) {
        const code = guard.renderDenial(decision, { argv: stripped.argv, home }, io);
        (io.exit ?? ((c) => process.exit(c)))(code);
        return null;
    }
    return stripped.argv;
}
if (isDirectRun()) {
    maybeReexecWithSiblingNode(process.argv);
    await run(process.argv);
}
//# sourceMappingURL=bin-wrapper.js.map