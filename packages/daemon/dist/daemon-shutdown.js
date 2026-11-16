import { writeFileSync, renameSync } from "node:fs";
export const DAEMON_SHUTDOWN_TIMEOUT_MS = 10_000;
export const DAEMON_STOP_WAIT_MS = DAEMON_SHUTDOWN_TIMEOUT_MS + 2_000;
export const DAEMON_HTTP_CONNECTION_GRACE_MS = 250;
export const DAEMON_SHUTDOWN_RECEIPT = "daemon-shutdown.json";
const activeResponses = new WeakMap();
/** Register before requests arrive so shutdown can end SSE without cutting ordinary requests. */
export function trackHttpServerResponses(server, observeRequest) {
    if (activeResponses.has(server))
        return;
    const responses = new Set();
    const state = { responses };
    activeResponses.set(server, state);
    server.prependListener("request", (_request, response) => {
        try {
            observeRequest?.(_request, response);
        }
        catch { /* Observation cannot change HTTP/shutdown. */ }
        const tracked = { response };
        responses.add(tracked);
        const writeHead = response.writeHead;
        response.writeHead = function (statusCode, ...args) {
            // writeHead's direct headers are not cached by getHeader (including Hono's adapter).
            const headers = typeof args[0] === "string" ? args[1] : args[0];
            const entries = Array.isArray(headers)
                ? headers.flatMap((name, index) => index % 2 === 0 ? [[String(name), headers[index + 1]]] : [])
                : headers && typeof headers === "object" ? Object.entries(headers) : [];
            const directType = entries.find(([name]) => name.toLowerCase() === "content-type")?.[1];
            tracked.contentType = String(directType ?? response.getHeader("content-type") ?? "");
            const result = Reflect.apply(writeHead, this, [statusCode, ...args]);
            if (state.endLateStream && tracked.contentType.split(";")[0].trim().toLowerCase() === "text/event-stream") {
                // Let the handler finish its current synchronous writes before ending it.
                setImmediate(() => state.endLateStream?.(response));
            }
            return result;
        };
        response.once("close", () => responses.delete(tracked));
    });
}
/** Stop accepting requests and end SSE after the grace period. Ordinary requests
 * keep the existing whole-shutdown budget and cannot produce a premature clean stop. */
export function closeHttpServer(server, graceMs = DAEMON_HTTP_CONNECTION_GRACE_MS) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const forceCloseTimer = setTimeout(() => {
            try {
                const state = activeResponses.get(server);
                if (state)
                    state.endLateStream = (response) => {
                        try {
                            response.end();
                        }
                        catch (error) {
                            finish(error);
                        }
                    };
                for (const { response, contentType: observedType } of state?.responses ?? []) {
                    const contentType = String(observedType ?? response.getHeader("content-type") ?? "").split(";")[0].trim().toLowerCase();
                    if (contentType === "text/event-stream")
                        response.end();
                }
                server.closeIdleConnections?.();
            }
            catch (error) {
                finish(error);
            }
        }, graceMs);
        const finish = (error) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(forceCloseTimer);
            if (error)
                reject(error);
            else
                resolve();
        };
        try {
            for (const { response } of activeResponses.get(server)?.responses ?? []) {
                response.once("finish", () => setImmediate(() => server.closeIdleConnections?.()));
            }
            server.close(finish);
            server.closeIdleConnections?.();
        }
        catch (error) {
            finish(error);
        }
    });
}
/** One budget for the existing sequential cleanup, including its first await.
 * ponytail: this bounds asynchronous shutdown only; a synchronous event-loop
 * wedge still needs identity-checked operator recovery, not another supervisor. */
export function createDaemonShutdown(options) {
    let started = false;
    return (signal) => {
        if (started)
            return;
        started = true;
        let finished = false;
        let phase = "starting";
        const startedAt = new Date().toISOString();
        const failures = [];
        const timeoutMs = options.timeoutMs ?? DAEMON_SHUTDOWN_TIMEOUT_MS;
        const log = options.log ?? console.error;
        const exit = options.exit ?? ((code) => process.exit(code));
        const fail = (error) => {
            failures.push({ phase, error: String(error) });
            log(`[shutdown] ${phase} failed: ${String(error)}`);
        };
        const finish = (outcome) => {
            if (finished)
                return;
            finished = true;
            clearTimeout(timer);
            let code = outcome === "clean" ? 0 : 1;
            const receipt = {
                schema: "openrig.daemon-shutdown/v1", pid: process.pid, startedAt,
                completedAt: new Date().toISOString(), outcome,
                phase: outcome === "clean" ? "complete" : phase, failures,
            };
            try {
                const temp = `${options.receiptPath}.${process.pid}.tmp`;
                writeFileSync(temp, JSON.stringify(receipt) + "\n");
                renameSync(temp, options.receiptPath);
            }
            catch (error) {
                log(`[shutdown] outcome receipt unavailable: ${String(error)}`);
                code = 1;
            }
            log(`[shutdown] ${outcome}; phase=${receipt.phase}; budget=${timeoutMs}ms; exit=${code}`);
            exit(code);
        };
        // Referenced deliberately: this must also enforce the bound with no servers.
        const timer = setTimeout(() => {
            fail(`whole-shutdown budget exhausted (${timeoutMs}ms); pending effects are unverified`);
            finish("timed-out");
        }, timeoutMs);
        log(`OpenRig daemon received ${signal}; shutting down (budget ${timeoutMs}ms)`);
        void (async () => {
            for (const [name, run] of options.phases) {
                if (finished)
                    return;
                phase = name;
                try {
                    await run();
                }
                catch (error) {
                    if (!finished)
                        fail(error);
                }
            }
            if (finished)
                return;
            if (failures.length === 0) {
                phase = "lifecycle-stop";
                try {
                    options.markClean();
                }
                catch (error) {
                    fail(error);
                }
            }
            if (failures.length)
                phase = failures[0].phase;
            finish(failures.length ? "failed" : "clean");
        })();
    };
}
//# sourceMappingURL=daemon-shutdown.js.map