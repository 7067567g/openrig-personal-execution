import { spawn as nodeSpawn } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
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
export async function runCrossHostCommand(host, argv, opts = {}) {
    if (host.transport !== "ssh") {
        return {
            ok: false,
            failedStep: "ssh-unreachable",
            sshStderr: `host '${host.id}': transport '${host.transport}' is not ssh; use HTTP transport for this host`,
        };
    }
    const sshHost = host;
    if (argv.length === 0) {
        return {
            ok: false,
            failedStep: "ssh-unreachable",
            sshStderr: "internal: empty argv passed to runCrossHostCommand",
        };
    }
    const sshOpts = [];
    if (host.user) {
        sshOpts.push("-l", host.user);
    }
    const connectTimeout = opts.connectTimeoutSeconds ?? 10;
    sshOpts.push("-o", `ConnectTimeout=${connectTimeout}`);
    // No BatchMode — operators may legitimately use password / interactive auth.
    // Stay deferential to ~/.ssh/config defaults.
    // D13 — ssh runs the remote command in a NON-login shell (no operator PATH → `rig`
    // exits 127 on nvm/npm-global installs). Run it under `sh -lc` so the operator's own
    // login PATH resolves it — one exec, zero config; `sh` exists everywhere POSIX.
    // A2 (P23): when the caller supplies the ORIGIN triple, prefix `OPENRIG_SESSION_NAME=<triple>`
    // INSIDE the sh -lc line so the remote's rig derives the ORIGIN identity, not its own seat. The
    // prefix rides the SAME shellQuote layer as the argv; absent ⇒ byte-unchanged from D13.
    const quotedArgv = argv.map(shellQuote).join(" ");
    const innerCommand = opts.originTriple
        ? `OPENRIG_SESSION_NAME=${shellQuote(opts.originTriple)} ${quotedArgv}`
        : quotedArgv;
    const remoteCommandLine = `sh -lc ${shellQuote(innerCommand)}`;
    const fullArgs = [...sshOpts, sshHost.target, remoteCommandLine];
    const spawn = opts.spawn ?? nodeSpawn;
    const child = spawn("ssh", fullArgs);
    if (opts.stdin !== undefined && child.stdin) {
        child.stdin.write(opts.stdin);
        child.stdin.end();
    }
    else if (child.stdin) {
        child.stdin.end();
    }
    let stdout = "";
    let stderr = "";
    const stdoutDecoder = new StringDecoder("utf8");
    const stderrDecoder = new StringDecoder("utf8");
    if (child.stdout) {
        child.stdout.on("data", (chunk) => {
            stdout += typeof chunk === "string" ? chunk : stdoutDecoder.write(chunk);
        });
    }
    if (child.stderr) {
        child.stderr.on("data", (chunk) => {
            stderr += typeof chunk === "string" ? chunk : stderrDecoder.write(chunk);
        });
    }
    const exitCode = await new Promise((resolve) => {
        child.on("close", (code) => resolve(code ?? -1));
        child.on("error", (err) => {
            stderr += `\n[spawn error] ${err.message}`;
            resolve(-1);
        });
    });
    stdout += stdoutDecoder.end();
    stderr += stderrDecoder.end();
    return classifyResult(exitCode, stdout, stderr);
}
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
export function classifyResult(exitCode, stdout, stderr) {
    if (exitCode === 0) {
        return { ok: true, failedStep: "none", stdout, stderr, remoteExitCode: 0 };
    }
    if (exitCode === 255 || exitCode === -1) {
        if (looksLikePermissionGate(stderr)) {
            return {
                ok: false,
                failedStep: "permission-gate",
                sshStderr: stderr,
                hint: "Check the registered host/user and the SSH error. For authentication errors, inspect availability of the intended key, agent or Keychain in this process. For host-key or signature-algorithm errors, confirm the expected fingerprint or supported key type with the host owner; keep host verification enabled.",
            };
        }
        return { ok: false, failedStep: "ssh-unreachable", sshStderr: stderr };
    }
    // D13 — resolution failure is its own loud class (127 or the not-found signature).
    if (exitCode === 127 || /command not found/i.test(stderr)) {
        return {
            ok: false,
            failedStep: "remote-command-not-found",
            stdout,
            stderr,
            remoteExitCode: exitCode,
            hint: "The remote login PATH does not resolve `rig`. Check the remote install (nvm/npm-global in the login profile); a hosts.yaml rigPath override is the escape hatch if the profile cannot carry it.",
        };
    }
    if (looksLikeDaemonUnreachable(stderr) || looksLikeDaemonUnreachable(stdout)) {
        return {
            ok: false,
            failedStep: "remote-daemon-unreachable",
            stdout,
            stderr,
            remoteExitCode: exitCode,
        };
    }
    return {
        ok: false,
        failedStep: "remote-command-failed",
        stdout,
        stderr,
        remoteExitCode: exitCode,
    };
}
const PERMISSION_GATE_PATTERNS = [
    /Permission denied/i,
    /Host key verification failed/i,
    /Keychain/i,
    /Could not request authentication agent/i,
    /no mutual signature algorithm/i,
];
// OPR.0.4.4.18: exported so `rig file` classifies rsync stderr with the SAME
// signature (single-source classification per arch ruling — never a second
// pattern copy). Behavior unchanged.
export function looksLikePermissionGate(stderr) {
    return PERMISSION_GATE_PATTERNS.some((re) => re.test(stderr));
}
const DAEMON_UNREACHABLE_PATTERNS = [
    /Daemon not running/i,
    /Failed to fetch .* from daemon/i,
    /ECONNREFUSED.*localhost/i,
];
function looksLikeDaemonUnreachable(text) {
    return DAEMON_UNREACHABLE_PATTERNS.some((re) => re.test(text));
}
/**
 * Single-quote shell escaping. Wraps the input in single quotes, escaping
 * any embedded single quotes via `'\''`. Safe for passing as a single arg
 * to a remote POSIX shell.
 */
export function shellQuote(s) {
    return `'${s.replace(/'/g, `'\\''`)}'`;
}
//# sourceMappingURL=cross-host-executor.js.map