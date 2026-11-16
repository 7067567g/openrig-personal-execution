import { exec, execFile, spawn } from "node:child_process";
import { accessSync, constants, statSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { promisify } from "node:util";
const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);
// exec's 1 MiB default holds about a dozen 1000-line panes; a batched capture chains 24 (#161). A bound, not an allocation.
export const TMUX_MAX_BUFFER = 64 * 1024 * 1024;
/**
 * The first regular executable `name` on `pathEnv`, in execvp order. Null when there is none, or when an
 * entry before it is relative or empty: those depend on the cwd, so the bare name is left to the shell.
 */
export function resolveOnPath(name, pathEnv) {
    for (const dir of (pathEnv ?? "").split(":")) {
        if (!isAbsolute(dir))
            return null;
        const candidate = join(dir, name);
        try {
            if (!statSync(candidate).isFile())
                continue;
            accessSync(candidate, constants.X_OK);
            return candidate;
        }
        catch { /* not here: the next entry */ }
    }
    return null;
}
// Looked up once per PATH value: a tmux installed earlier on PATH later is seen after a daemon restart.
let resolved;
function resolvedOnPath(name) {
    const pathEnv = process.env.PATH;
    if (resolved?.name !== name || resolved.pathEnv !== pathEnv)
        resolved = { name, pathEnv, file: resolveOnPath(name, pathEnv) };
    return resolved.file;
}
/** The file could not be started at all (missing, not executable, a missing interpreter, no `#!` line): nothing ran. */
function isSpawnError(err) {
    return err?.syscall?.startsWith("spawn") === true;
}
function extractExecOutput(err) {
    if (!err || typeof err !== "object")
        return "";
    const stdout = typeof err.stdout === "string"
        ? err.stdout.trim()
        : "";
    const stderr = typeof err.stderr === "string"
        ? err.stderr.trim()
        : "";
    return [stdout, stderr].filter(Boolean).join("\n");
}
/** The exec error with its output appended for a human reader, and tmux's own stderr kept apart as `execStderr`: a
 *  chained capture prints the earlier panes to stdout before it fails, and that pane text must not classify it. */
function withExecOutput(err) {
    if (!(err instanceof Error))
        return err;
    const output = extractExecOutput(err);
    const thrown = output && !err.message.includes(output) ? new Error(`${err.message}\n${output}`) : err;
    const stderr = err.stderr;
    return typeof stderr === "string" ? Object.assign(thrown, { execStderr: stderr }) : thrown;
}
/**
 * Production ExecFn for TmuxAdapter.
 * Wraps child_process.exec (shell command string) and returns stdout.
 */
export const execCommand = async (cmd) => {
    try {
        const { stdout } = await execAsync(cmd);
        return stdout;
    }
    catch (err) {
        throw withExecOutput(err);
    }
};
/**
 * Production ArgvExecFn for TmuxAdapter.
 * Runs argv[0] directly via execFile: no shell, no quoting layer. On POSIX
 * argv[0] is started by its resolved path: with a bare name, libuv tries each
 * PATH entry with a spawn on the event loop. psmux ships a `tmux` alias on
 * PATH, so Windows passes the bare name to the spawn.
 */
export const execArgvCommand = async (argv) => {
    const [bin, ...args] = argv;
    if (!bin)
        throw new Error("execArgvCommand: empty argv");
    // Nothing ran when no file was found: a shell also finds tmux through an entry the lookup skips, such as a literal
    // `~/bin`, and reports a missing one as the shell transport does.
    const opts = { windowsHide: true, maxBuffer: TMUX_MAX_BUFFER };
    const run = (file) => file ? execFileAsync(file, args, opts) : execFileAsync("/bin/sh", ["-c", 'exec "$0" "$@"', bin, ...args], opts);
    try {
        if (process.platform === "win32")
            return (await execFileAsync(bin, args, opts)).stdout;
        const file = resolvedOnPath(bin);
        try {
            return (await run(file)).stdout;
        }
        catch (err) {
            if (!file || !isSpawnError(err))
                throw err;
            // Nothing ran, so the shell runs it once and reaches tmux as the shell transport does. The next call looks up again,
            // so a reinstalled tmux is started directly once it is back.
            resolved = undefined;
            return (await run(null)).stdout;
        }
    }
    catch (err) {
        throw withExecOutput(err);
    }
};
/**
 * Starts a long-lived tmux client (the daemon's control client, tmux-control.ts) as execArgvCommand starts tmux: the
 * file resolved on PATH, else, or when that file could not be started, `/bin/sh` once. Resolves once the process runs,
 * and rejects with the spawn error when even the shell could not start. POSIX only, as control mode is.
 */
export async function spawnTmuxClient(args) {
    const opts = { stdio: "pipe", windowsHide: true };
    const started = (file) => new Promise((resolve, reject) => {
        const child = file ? spawn(file, args, opts) : spawn("/bin/sh", ["-c", 'exec "$0" "$@"', "tmux", ...args], opts);
        child.once("error", reject);
        child.once("spawn", () => {
            child.off("error", reject);
            resolve(child);
        });
    });
    const file = resolvedOnPath("tmux");
    try {
        return await started(file);
    }
    catch (err) {
        if (!file || !isSpawnError(err))
            throw err;
        // Nothing ran: the next start looks tmux up again.
        resolved = undefined;
        return started(null);
    }
}
//# sourceMappingURL=tmux-exec.js.map