/**
 * Shared CLI-side helpers for commands that gate on `--host`. Centralizes
 * the structured failure formatting + JSON envelope so `send.ts` and
 * `capture.ts` (and any future v1 cross-host command) format identically.
 */
/**
 * OPR.0.4.6.MH4 — structured failure surface for the http transport branch.
 * Each branch names its OWN step taxonomy: the http branch surfaces
 * `runRemoteHttpOp`'s steps (registry/unknown-host/permission-gate/
 * remote-daemon-unreachable/remote-command-failed) with the host named and
 * the remote route's own error text as the detail — never a generic
 * "failed", never a locally-invented message.
 */
export function emitRemoteHttpFailure(hostId, target, result, json, hint) {
    const remoteError = result.data?.error;
    const detail = [result.error, remoteError].filter(Boolean).join(" — ");
    if (json) {
        console.log(JSON.stringify({
            ok: false,
            cross_host: { host: hostId, target, transport: "http" },
            failedStep: result.failedStep,
            error: detail,
            ...(hint ? { hint } : {}),
        }));
    }
    else {
        console.error(`cross-host (host=${hostId}, ${target}): http ${result.failedStep}: ${detail}`);
        if (hint)
            console.error(`hint: ${hint}`);
    }
    process.exitCode = 1;
}
export function emitCrossHostError(hostId, code, message, json) {
    if (json) {
        console.log(JSON.stringify({ ok: false, cross_host: { host: hostId }, failedStep: code, error: message }));
    }
    else {
        console.error(`cross-host (host=${hostId}): ${message}`);
    }
    process.exitCode = 1;
}
export function emitCrossHostFailure(hostId, target, result, json) {
    if (result.ok)
        return;
    const message = formatCrossHostFailure(hostId, target, result);
    if (json) {
        console.log(JSON.stringify({
            ok: false,
            cross_host: { host: hostId, target },
            failedStep: result.failedStep,
            error: message,
            ...(result.failedStep === "permission-gate" && result.hint ? { hint: result.hint } : {}),
        }));
    }
    else {
        console.error(message);
    }
    process.exitCode = 1;
}
export function formatCrossHostFailure(hostId, target, result) {
    switch (result.failedStep) {
        case "ssh-unreachable":
            return `ssh to host=${hostId} (target=${target}) failed: ${oneLine(result.sshStderr)}. Verify SSH access and host registry config.`;
        case "permission-gate":
            return `ssh to host=${hostId} (target=${target}) hit a permission/auth gate: ${oneLine(result.sshStderr)}. ${result.hint ?? ""}`.trim();
        case "remote-daemon-unreachable":
            return `remote rig command on host=${hostId} could not reach the remote daemon (exit=${result.remoteExitCode}): ${oneLine(result.stderr || result.stdout)}. Start the daemon on the remote with 'ssh ${target} rig daemon start'.`;
        case "remote-command-not-found":
        case "remote-command-failed":
            return `remote rig command on host=${hostId} failed (exit=${result.remoteExitCode}): ${oneLine(result.stderr || result.stdout)}`;
    }
}
function oneLine(s) {
    return s.split("\n").map((l) => l.trim()).filter(Boolean).join(" | ").slice(0, 400);
}
//# sourceMappingURL=cross-host-cli-helpers.js.map