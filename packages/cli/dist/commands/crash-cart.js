import { Command } from "commander";
import { copyFileSync, lstatSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { getOpenRigHome } from "../openrig-compat.js";
import { join } from "node:path";
import { ConfigStore } from "../config-store.js";
import { formatDaemonHostForUrl } from "../client.js";
/** Read daemon.json returning the FULL record incl. `db` (loadCrashCartDiscovery needs the db path;
 *  the detector's readDaemonJson omits it). */
function readDaemonJsonWithDb(home) {
    const p = join(home, "daemon.json");
    if (!existsOrThrow(p))
        return undefined;
    try {
        const j = JSON.parse(readFileSync(p, "utf8"));
        if (typeof j.pid === "number" && typeof j.port === "number" && typeof j.db === "string") {
            return { pid: j.pid, port: j.port, host: typeof j.host === "string" ? j.host : undefined, db: j.db };
        }
        throw new Error("daemon.json has no usable PID, port and database path");
    }
    catch (error) {
        throw new Error(`Cannot read recorded daemon state at ${p}: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/** Only ENOENT means absent; permissions and dangling links must fail visibly. */
function existsOrThrow(path) {
    try {
        lstatSync(path);
        return true;
    }
    catch (error) {
        if (error.code === "ENOENT")
            return false;
        throw error;
    }
}
/**
 * The real verdict: LAZY-imports the narrow @openrig-local/daemon/crash-cart subpath at invocation (dep
 * rail 2 — rig startup + other verbs never load the daemon module) and composes the shipped detector
 * + C2 read VERBATIM (rail 2) with live probes + read-only IO. This is real-run glue over the tested
 * emit/detector/read cores.
 */
async function realEmit() {
    const cc = await import("../../daemon/dist/crash-cart-surface.js");
    const home = getOpenRigHome();
    const openrigUrl = process.env.OPENRIG_URL;
    const probeClassified = (url) => cc.probeHealthz(url, { fetch: (u, init) => fetch(u, init), timeoutMs: 700 });
    const detectDeps = {
        openrigHome: home,
        readDaemonJson: cc.readDaemonJson,
        isProcessAlive: cc.isProcessAlive,
        probeHealthz: probeClassified,
        openrigUrl,
    };
    return cc.emitCrashCartState({
        resolveState: () => cc.resolveDaemonState({ ...detectDeps, sleep: (ms) => new Promise((r) => setTimeout(r, ms)), maxProbes: 3, retryDelayMs: 400 }),
        assembleEvidence: async () => {
            const state = cc.readDaemonJson(home);
            const pidState = state
                ? cc.isProcessAlive(state.pid)
                    ? `alive (pid ${state.pid})`
                    : `dead (pid ${state.pid})`
                : "no daemon.json";
            const url = openrigUrl
                ? `${openrigUrl.replace(/\/$/, "")}/healthz`
                : `http://${formatDaemonHostForUrl(state?.host ?? "127.0.0.1")}:${state?.port ?? 7433}/healthz`;
            const probeResult = await probeClassified(url);
            return { pidState, probeResult, failedSignal: `healthz ${probeResult} at ${url}` };
        },
        loadDiscovery: async () => {
            const { discovery } = await cc.loadCrashCartDiscovery({
                openrigHome: home,
                readDaemonJson: readDaemonJsonWithDb,
                isProcessAlive: cc.isProcessAlive,
                probeHealthz: (url) => probeClassified(url).then((r) => r === "answered"),
                copyFile: copyFileSync,
                exists: existsOrThrow,
                configuredDbPath: new ConfigStore().resolve().db.path,
                makeScratchDir: () => mkdtempSync(join(tmpdir(), "crash-cart-")),
                removeScratchDir: (d) => rmSync(d, { recursive: true, force: true }),
                openDb: cc.openDaemonDbReadonly,
                openrigUrl,
            });
            return discovery;
        },
    });
}
export function crashCartCommand(deps) {
    const cmd = new Command("crash-cart").description("Emit the daemon-down recovery verdict + discovery as JSON (read-only).");
    cmd.option("--json", "emit JSON (the default machine-readable form)");
    cmd.action(async () => {
        const emit = deps?.emit ?? realEmit;
        const write = deps?.write ?? ((line) => process.stdout.write(line + "\n"));
        const result = await emit();
        // Rail 3: the JSON is the truth (verdict + discovery, or a structured refusal). Always printed.
        write(JSON.stringify(result));
        // A non-zero exit is a HINT only (not-cleanly-up); the JSON remains the contract.
        process.exitCode = result.state === "up" ? 0 : 1;
    });
    return cmd;
}
//# sourceMappingURL=crash-cart.js.map