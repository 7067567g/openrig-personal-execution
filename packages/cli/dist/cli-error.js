import { InvalidArgumentError } from "commander";
import { DaemonConnectionError, DaemonResponseError, DaemonTimeoutError } from "./client.js";
import { blockedConnectionGuidance, isBlockedConnectionCode } from "./daemon-reachability.js";
/**
 * Commander option parser — a positive integer (>= 1). Rejects negative, zero,
 * and non-numeric values (finding 4). Throws InvalidArgumentError, which the
 * shared error path (below) renders as a JSON error under `--json`.
 */
export function positiveIntArg(value) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1) {
        throw new InvalidArgumentError(`must be a positive integer (>= 1); got '${value}'`);
    }
    return n;
}
/** Commander option parser factory — the value must be one of `allowed` (finding 3). */
export function enumArg(allowed) {
    return (value) => {
        if (!allowed.includes(value)) {
            throw new InvalidArgumentError(`must be one of: ${allowed.join(", ")}; got '${value}'`);
        }
        return value;
    };
}
/** True when the invocation requested machine output (`--json` or `-o/--output/--format json`). */
export function wantsJsonOutput(argv) {
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--")
            break;
        if (a === "--json")
            return true;
        if ((a === "-o" || a === "--output" || a === "--format") && argv[i + 1] === "json")
            return true;
        if (/^(?:-o|--output|--format)=json$/.test(a))
            return true;
    }
    return false;
}
/** Commander's non-error terminations (help/version) — exit cleanly, no error object. */
export function isCleanCommanderExit(err) {
    const e = err;
    return (e?.code === "commander.helpDisplayed" ||
        e?.code === "commander.version" ||
        e?.code === "commander.help" ||
        (typeof e?.exitCode === "number" && e.exitCode === 0));
}
export function formatCliError(err) {
    const e = err;
    const message = (e?.message ?? String(err)).replace(/^error:\s*/i, "").trim();
    return { ok: false, error: { code: e?.code ?? "cli_error", message } };
}
/** Recursively give every command exitOverride so parse errors throw instead of exiting. */
export function applyExitOverride(program) {
    const walk = (cmd) => {
        cmd.exitOverride();
        for (const sub of cmd.commands)
            walk(sub);
    };
    walk(program);
}
/**
 * Response-integrity render: a daemon transport failure (bad-response /
 * slow-response / no-connect) becomes the repo's 3-part fact/consequence/action
 * error in BOTH json and human modes (Commander's writeErr does NOT fire for an
 * error thrown inside an action, so a human run would otherwise be SILENT).
 * Returns true when it handled `e`. A bad/slow response is NEVER rendered with
 * daemon-not-running language — the request was delivered; the outcome is unknown.
 */
export function renderDaemonTransportError(e, io) {
    let parts;
    // DaemonTimeoutError is a subclass of DaemonConnectionError — check it FIRST.
    if (e instanceof DaemonResponseError) {
        parts = {
            fact: e.message,
            consequence: "The command's outcome is UNKNOWN — it may or may not have been applied.",
            action: "Re-check current state (e.g. 'rig queue show <id>'); if it repeats, inspect daemon health with 'rig daemon status' and the daemon logs. This is a bad response, not a stopped daemon.",
        };
    }
    else if (e instanceof DaemonTimeoutError) {
        parts = {
            fact: e.message,
            consequence: "The command's outcome is UNKNOWN — the daemon did not answer in time.",
            action: "Check the command's effect before any retry, then inspect daemon load with 'rig status' and the daemon logs if it remains slow. This is a slow response, not a stopped daemon.",
        };
    }
    else if (e instanceof DaemonConnectionError) {
        const unknownWrite = e.writeOutcome === "unknown";
        const reconcile = "Reconcile using the recovery ID before any retry. A lost connection does not prove the write failed.";
        const delivery = unknownWrite
            ? "The command's outcome is UNKNOWN — no usable response confirmed whether the write was applied."
            : "The command was not delivered.";
        // #275: a connection this machine blocked (EPERM/EACCES) is not a stopped daemon.
        const blocked = isBlockedConnectionCode(e.causeCode) ? blockedConnectionGuidance(e.causeCode) : undefined;
        parts = {
            fact: e.message,
            consequence: blocked ? `${delivery} ${blocked.consequence}` : delivery,
            action: blocked
                ? (unknownWrite ? `${blocked.action} ${reconcile}` : blocked.action)
                : unknownWrite
                    ? `Check 'rig daemon status' on the affected host; if it is down, start it with 'rig daemon start'. ${reconcile}`
                    : "Confirm the daemon is reachable with 'rig daemon status'; if it is down, start it with 'rig up' or 'rig daemon start'.",
            ...(e.causeCode ? { causeCode: e.causeCode } : {}),
        };
    }
    if (!parts)
        return false;
    if (io.json) {
        io.out(JSON.stringify({ error: parts }));
    }
    else {
        io.err(parts.fact);
        io.err(`  ${parts.consequence}`);
        io.err(`  ${parts.action}`);
    }
    return true;
}
/**
 * Parse+run the program through the shared error path. Injectable IO for tests.
 * Returns the process exit code (0 on success / clean help/version).
 */
export async function runProgram(program, argv, io = {}) {
    const out = io.out ?? ((l) => process.stdout.write(l + "\n"));
    const err = io.err ?? ((l) => process.stderr.write(l + "\n"));
    const exit = io.exit ?? ((c) => process.exit(c));
    const json = wantsJsonOutput(argv.slice(2));
    applyExitOverride(program);
    // Suppress Commander's own plain-text stderr write when JSON was requested, so a
    // `--json` failure emits ONLY the JSON error object (below). Non-JSON keeps the
    // familiar stderr text. Applied to the whole command tree. `commanderWrote` records whether
    // Commander itself wrote an error, so the catch below can tell what is still unprinted.
    let commanderWrote = false;
    const suppressErr = (cmd) => {
        cmd.configureOutput({ writeErr: (str) => { commanderWrote = true; if (!json)
                err(str.replace(/\n$/, "")); } });
        for (const sub of cmd.commands)
            suppressErr(sub);
    };
    suppressErr(program);
    try {
        await program.parseAsync(argv);
        return 0;
    }
    catch (e) {
        if (isCleanCommanderExit(e))
            return 0;
        // Response-integrity: render daemon transport failures honestly (3-part, both
        // modes, honest nonzero exit) before the generic path — otherwise a thrown
        // bad-response/timeout is cryptic under --json and SILENT for a human run.
        if (renderDaemonTransportError(e, { out, err, json })) {
            exit(1);
            return 1;
        }
        const code = e?.exitCode ?? 1;
        if (json) {
            out(JSON.stringify(formatCliError(e)));
        }
        else if (!commanderWrote) {
            // Commander writes the errors it raises through configureOutput.writeErr above. Anything it
            // did not write (a plain Error from an option parser, or any error an action throws, even a
            // CommanderError such as InvalidArgumentError) reaches here unprinted; say it, so a human run
            // never fails silently.
            err(`error: ${formatCliError(e).error.message}`);
        }
        exit(code || 1);
        return code || 1;
    }
}
//# sourceMappingURL=cli-error.js.map