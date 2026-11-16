// Slice 01 (OPR.0.7.0.1) — one bounded read of the Codex login's native usage windows. A one-shot
// `codex app-server` started with the PATH, HOME and CODEX_HOME a seat session gets answers
// `account/read` (refreshToken:false) and `account/rateLimits/read`, then exits on stdin EOF; the
// reader's process group is stopped the same way as the #275 network reader. It runs only on an
// explicit refresh: ordinary provider reads never call it.
//
// Identity comes only from the two RPC answers. The reader never opens auth.json or any token.
// Side effects: Codex startup may write its own state files in the shared CODEX_HOME (its databases,
// installation id, bundled skills), and a backend read may refresh the login's token in auth.json, as
// any Codex start can. Plugins and apps are off for this read, so no plugin sync runs.
import { spawn } from "node:child_process";
import { stopGroup } from "../codex-network-default.js";
/** The app-server, with plugins and apps switched off for this read only (as `codex-network-default.ts`). */
export const CODEX_USAGE_READER_ARGS = ["-c", "features.plugins=false", "-c", "features.apps=false", "app-server"];
/** Native reads take 25–35 s (Ops' readers); the refresh is bounded by the upper end. */
export const CODEX_USAGE_READ_DEADLINE_MS = 35_000;
/** How long the reader's process group gets at each stop step (and for the reap) once the read ends. */
export const CODEX_USAGE_READ_GRACE_MS = 2_000;
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const firstLine = (error) => String(error instanceof Error ? error.message : error).split("\n")[0];
export function codexUsageReader(options = {}) {
    const deadlineMs = options.deadlineMs ?? CODEX_USAGE_READ_DEADLINE_MS;
    const graceMs = options.graceMs ?? CODEX_USAGE_READ_GRACE_MS;
    const maxOutputBytes = options.maxOutputBytes ?? 1024 * 1024;
    const now = options.now ?? (() => new Date().toISOString());
    return async () => {
        const env = {
            ...process.env,
            ...(options.launchPath ? { PATH: options.launchPath } : {}),
            ...(options.home ? { HOME: options.home } : {}),
            ...(options.codexHome ? { CODEX_HOME: options.codexHome } : {}),
        };
        let child;
        try {
            // Its own process group, so cleanup reaches the reader's descendants and nothing else.
            // Plugins and apps off, as the #275 network reader starts it: no plugin sync during a usage read.
            child = spawn("codex", CODEX_USAGE_READER_ARGS, { cwd: options.home, env, stdio: ["pipe", "pipe", "ignore"], detached: true });
        }
        catch (error) {
            return { ok: false, at: now(), reason: "spawn_failed", detail: `codex app-server could not start: ${firstLine(error)}` };
        }
        const outcome = await converse(child, deadlineMs, maxOutputBytes, now);
        await stopGroup(child, graceMs);
        return outcome;
    };
}
function converse(child, deadlineMs, maxOutputBytes, now) {
    return new Promise((resolve) => {
        let account;
        let buffered = "";
        let received = 0;
        let settled = false;
        const finish = (outcome) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(deadline);
            resolve(outcome);
        };
        const fail = (reason, detail) => finish({ ok: false, at: now(), reason, detail });
        const deadline = setTimeout(() => fail("timeout", `codex app-server did not answer within ${deadlineMs} ms`), deadlineMs);
        const send = (message) => {
            if (child.stdin?.writable)
                child.stdin.write(`${JSON.stringify(message)}\n`);
        };
        child.on("error", (error) => {
            if (error.code === "ENOENT")
                fail("binary_not_found", "no codex executable on the daemon's PATH");
            else
                fail("spawn_failed", `codex app-server could not start: ${firstLine(error)}`);
        });
        child.on("exit", (code, signal) => fail("child_exited", `codex app-server exited before answering (${signal ?? `code ${code}`})`));
        child.stdin?.on("error", () => fail("child_exited", "codex app-server closed its input before answering"));
        child.stdout?.setEncoding("utf8");
        child.stdout?.on("data", (chunk) => {
            received += Buffer.byteLength(chunk);
            if (received > maxOutputBytes)
                return fail("output_too_large", `codex app-server answered with more than ${maxOutputBytes} bytes`);
            buffered += chunk;
            let newline;
            while ((newline = buffered.indexOf("\n")) >= 0) {
                const line = buffered.slice(0, newline).trim();
                buffered = buffered.slice(newline + 1);
                if (!line)
                    continue;
                let message;
                try {
                    message = JSON.parse(line);
                }
                catch {
                    continue;
                }
                // Only responses to our own requests: notifications and server requests carry a method.
                if (!isRecord(message) || typeof message.id !== "number" || "method" in message)
                    continue;
                if (message.error !== undefined) {
                    const method = message.id === 1 ? "initialize" : message.id === 2 ? "account/read" : "account/rateLimits/read";
                    const text = isRecord(message.error) && typeof message.error.message === "string" ? `: ${message.error.message.split("\n")[0]}` : "";
                    return fail("rpc_error", `codex app-server returned an error for ${method}${text}`);
                }
                if (message.id === 1) {
                    send({ method: "initialized", params: {} });
                    send({ id: 2, method: "account/read", params: { refreshToken: false } });
                }
                else if (message.id === 2) {
                    account = message.result;
                    send({ id: 3, method: "account/rateLimits/read" });
                }
                else if (message.id === 3) {
                    return finish({ ok: true, observedAt: now(), account, rateLimits: message.result });
                }
            }
        });
        send({ id: 1, method: "initialize", params: { clientInfo: { name: "openrig_usage_windows", version: "1.0.0" }, capabilities: null } });
    });
}
//# sourceMappingURL=codex-usage-reader.js.map