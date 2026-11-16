// Crash-cart C3 — daemon-state detection (planner+PM ruling; the honest-degraded false-negative rail).
//
// THREE states — the cockpit + the C2 direct read fire ONLY on DOWN, and DOWN requires POSITIVE
// evidence. A probe blip must NEVER fabricate a crash narrative or offer RESTORE EVERYTHING:
//   UP         — /healthz answered (openrig is serving).
//   DOWN       — (no daemon.json OR pid dead) AND /healthz connection-REFUSED. REFUSED is the ONLY
//                strong down signal; a timeout NEVER promotes to DOWN (at any retry count).
//   UNVERIFIED — everything else: timeout, a wedged daemon (pid alive but refused/unresponsive), or a
//                non-openrig process on the port. Renders its own minimal screen, never the cockpit.
//
// All probes + the clock are injected so the verdict is deterministically testable.
import { formatDaemonHostForUrl } from "./daemon-url.js";
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 7433;
function healthzUrl(deps, state) {
    if (deps.openrigUrl && deps.openrigUrl.trim().length > 0) {
        const base = deps.openrigUrl.trim();
        return `${base.endsWith("/") ? base.slice(0, -1) : base}/healthz`;
    }
    const host = state?.host ?? DEFAULT_HOST;
    const port = state?.port ?? DEFAULT_PORT;
    return `http://${formatDaemonHostForUrl(host)}:${port}/healthz`;
}
/**
 * SINGLE-SHOT classification (the per-probe primitive; the bounded retry is resolveDaemonState).
 * DOWN only on positive evidence (pid dead/absent AND refused); UP on answered; else UNVERIFIED.
 */
export async function classifyDaemonState(deps) {
    const state = deps.readDaemonJson(deps.openrigHome);
    const pidDeadOrAbsent = !state || !deps.isProcessAlive(state.pid);
    const probe = await deps.probeHealthz(healthzUrl(deps, state));
    if (probe === "answered")
        return "up";
    if (probe === "refused" && pidDeadOrAbsent)
        return "down";
    // timeout · wedged (pid alive but refused/unresponsive) · foreign occupant → never a crash verdict.
    return "unverified";
}
/**
 * Bounded-retry resolution. UP (answered) and DOWN (refused + pid-dead) are DECISIVE — returned on the
 * first probe that yields them, no retry. UNVERIFIED (timeout/wedged/foreign) triggers a bounded retry;
 * if it never resolves to UP or DOWN within maxProbes, the verdict is UNVERIFIED. A timeout NEVER
 * promotes to DOWN at any retry count (the false-negative rail).
 */
export async function resolveDaemonState(deps) {
    const max = Math.max(1, deps.maxProbes ?? 3);
    const delay = deps.retryDelayMs ?? 400;
    for (let i = 0; i < max; i += 1) {
        const s = await classifyDaemonState(deps);
        if (s === "up" || s === "down")
            return s; // decisive
        if (i < max - 1)
            await deps.sleep(delay); // unverified → retry
    }
    return "unverified";
}
//# sourceMappingURL=crash-cart-detect.js.map