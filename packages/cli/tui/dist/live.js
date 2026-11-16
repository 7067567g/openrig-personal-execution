import { PageRead } from "./page-read.js";
// S19 ROUND-5 (guard NOT-CLEAR at b92c2a58): the refresh OWNER — the one
// component that knows when a hydrate is actually IN FLIGHT and which seat
// produced fresh PANE OUTPUT between refreshes. renderScreen stays pure and
// consumes this state via RenderOptions; main.ts wires it to the terminal.
//
// Event identity (finding 2): the served `terminalActive` derives from tmux
// `#{window_activity}` (SeatActivityService), a timestamp tmux advances ONLY
// when the window receives output. A false→true transition is therefore
// impossible without real new pane output — an honest onset-after-silence
// event with zero false positives. Known substrate limit (flagged to guard):
// the projection serves only the derived boolean, not the raw timestamp, so
// output arriving while a seat is ALREADY active cannot re-trigger; onsets
// after the silence window are the observable events.
import { singleFlight } from "./refresh.js";
import { emptySnapshot } from "./state.js";
/** one-shot flash window (ms) — matches renderScreen's flashActive window */
export const FLASH_WINDOW_MS = 600;
/** One passive whole-snapshot read per quiet daemon sample window. */
export const QUIET_REFRESH_MS = 30_000;
/** walk the snapshot topology and key every agent's served pane-activity
 * boolean by the SAME stable key its explorer row carries */
function paneActivity(snap) {
    const map = new Map();
    for (const host of snap.hosts)
        for (const rig of host.rigs)
            for (const pod of rig.pods)
                for (const agent of pod.agents)
                    map.set(`agent:${host.name}/${rig.name}/${pod.name}/${agent.name}`, agent.paneActive);
    return map;
}
export function createLiveRefresh(deps) {
    let invalidation = 0;
    let lastConfirmedAt = null;
    let snapshot = emptySnapshot();
    let load = { inFlight: false, settled: false };
    let flashes = [];
    let scope = deps.scopeKey?.() ?? "";
    let generation = 0;
    let controller = new AbortController();
    let page = new PageRead(deps.now, forgetDenied);
    // Bounded history local to this client. Returning revalidates the page's own reads.
    const pages = new Map();
    function forgetDenied(url) {
        // A denial in one view also invalidates historical views of that same URL.
        // Unrelated pages and successful sibling reads in this page remain intact.
        for (const [key, entry] of pages)
            if (entry.page.has(url))
                pages.delete(key);
    }
    function syncScope() {
        const next = deps.scopeKey?.() ?? "";
        if (next === scope)
            return;
        pages.delete(scope);
        pages.set(scope, { page, snapshot, load: { ...load, inFlight: false }, lastConfirmedAt });
        while (pages.size > 12)
            pages.delete(pages.keys().next().value);
        const prior = pages.get(next);
        const navigator = snapshot;
        scope = next;
        generation += 1;
        controller.abort();
        controller = new AbortController();
        page = prior?.page ?? new PageRead(deps.now, forgetDenied);
        snapshot = prior?.snapshot ?? { ...emptySnapshot(), hosts: navigator.hosts, specs: navigator.specs,
            projects: navigator.projects, projectRead: navigator.projectRead, scopes: navigator.scopes,
            terminals: navigator.terminals && { catalog: navigator.terminals.catalog, catalogLoaded: navigator.terminals.catalogLoaded, preview: null } };
        flashes = [];
        lastConfirmedAt = prior?.lastConfirmedAt ?? null;
        load = prior ? { ...prior.load, stale: true, inFlight: false } : { inFlight: false, settled: false };
        // An old transport may take time to unwind. It cannot delay the new page.
        const expected = generation;
        runRefresh = singleFlight(() => expected === generation ? readPage() : Promise.resolve());
    }
    let quietTimer = null;
    let closed = false;
    let refresh;
    const scheduleTimeout = deps.setTimeout ?? ((callback, delayMs) => setTimeout(callback, delayMs));
    const cancelTimeout = deps.clearTimeout ?? ((handle) => clearTimeout(handle));
    function clearQuietTimer() {
        if (quietTimer === null)
            return;
        cancelTimeout(quietTimer);
        quietTimer = null;
    }
    function armQuietTimer() {
        clearQuietTimer();
        if (closed)
            return;
        quietTimer = scheduleTimeout(() => {
            quietTimer = null;
            void refresh();
        }, QUIET_REFRESH_MS);
        quietTimer.unref?.();
    }
    const readPage = async () => {
        clearQuietTimer();
        syncScope();
        const startedGeneration = generation;
        const activePage = page;
        activePage.begin();
        const startedAtInvalidation = invalidation;
        load.inFlight = true;
        deps.onFrame();
        try {
            const next = await deps.hydrate(activePage, controller.signal);
            syncScope();
            if (startedGeneration !== generation || closed)
                return;
            activePage.end();
            next.readErrors = [...new Set([...next.readErrors, ...activePage.errors])];
            load.retainedAt = activePage.retainedAt;
            if (load.settled) {
                // first hydrate is a LOAD, not fresh output — no flash; null (no
                // signal) never flashes either: only a served false→true transition
                const prev = paneActivity(snapshot);
                const now = deps.now();
                flashes = flashes.filter((f) => now - f.at < FLASH_WINDOW_MS);
                for (const [key, active] of paneActivity(next))
                    if (active === true && prev.get(key) === false)
                        flashes.push({ key, at: now });
            }
            snapshot = next;
            load.stale = startedAtInvalidation !== invalidation || next.readErrors.length > 0;
            if (!load.stale)
                lastConfirmedAt = deps.now();
            load.lastSuccessAt = lastConfirmedAt ?? undefined;
        }
        catch {
            if (startedGeneration !== generation || closed)
                return;
            load.stale = true;
            // rejection-release: the prior snapshot stays (nothing fabricated),
            // in-flight clears below, and the next requested refresh retries
        }
        finally {
            if (startedGeneration !== generation || closed)
                return;
            load.inFlight = false;
            load.settled = true;
            deps.onFrame();
            armQuietTimer();
        }
    };
    let runRefresh = singleFlight(() => generation === 0 ? readPage() : Promise.resolve());
    refresh = () => {
        if (closed)
            return Promise.resolve();
        syncScope();
        clearQuietTimer();
        return runRefresh();
    };
    return {
        refresh,
        invalidate: () => { invalidation += 1; load.stale = true; return refresh(); },
        connectionStatus: (status) => {
            load.connection = status;
            if (status !== "connected")
                load.stale = true;
            else
                void refresh();
            deps.onFrame();
        },
        snapshot: () => { syncScope(); return snapshot; },
        load: () => { syncScope(); return { ...load, ...(lastConfirmedAt !== null && deps.now() - lastConfirmedAt > 60_000 ? { stale: true } : {}) }; },
        flashes: () => [...flashes],
        close: () => {
            closed = true;
            controller.abort();
            clearQuietTimer();
        },
    };
}
//# sourceMappingURL=live.js.map