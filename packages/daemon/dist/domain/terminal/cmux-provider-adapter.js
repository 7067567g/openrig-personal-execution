// OPR.0.4.6.02 C2 — the cmux TerminalProvider facade.
//
// Renders a composed view the way the rig-scope "Launch in CMUX" endpoint
// always has: ONE gridded cmux workspace per grid page (composer `pages`),
// driven through the shipped `CmuxLayoutService` split/grid machinery — never
// one window per seat. Each pane runs the composer's `paneCommand` verbatim
// (read-only `-r`, ssh-wrap, quoting preserved), honoring the provider
// contract in terminal-provider.ts.
//
// cmux stays best-effort / non-gating on partial renders — a page cmux can't
// tile is degraded honestly (named, never a silent drop). A cmux surface that
// isn't connected at all is an honest refuse (`cmux_unavailable`), mirroring
// the herdr socket gate and the rig-cmux route's 503.
//
// cmux surfaces are always LOCAL (cmux runs on the operator's machine), so a
// cmux-level degrade stamps the `local` host sentinel.
import { autoGridCols } from "../cmux-layout-service.js";
/** Sentinel host for cmux-level degrades (cmux surfaces are always local). */
const CMUX_LOCAL_HOST = "local";
/** cmux workspace titles are free text, but keep them shell/UI-inert. */
function sanitizeWorkspaceName(name) {
    return name.replace(/[^a-zA-Z0-9._:@#/-]+/g, "-");
}
export class CmuxProviderAdapter {
    deps;
    name = "cmux";
    newLaunchToken;
    workspacePrefix;
    launchCounter = 0;
    constructor(deps) {
        this.deps = deps;
        this.workspacePrefix = deps.workspacePrefix ?? "openrig";
        this.newLaunchToken = deps.newLaunchToken ?? (() => `l${(this.launchCounter += 1)}`);
    }
    async status() {
        const s = this.deps.cmuxAdapter.getStatus();
        return { provider: this.name, available: s.available, capabilities: s.capabilities };
    }
    async liveness() {
        const alive = this.deps.cmuxAdapter.isAvailable();
        return alive ? { alive: true } : { alive: false, detail: "cmux is not connected" };
    }
    async openView(view) {
        // Carry forward the composer's honest-partial classification verbatim.
        const absent = [...view.absent];
        const degraded = [...view.degraded];
        const opened = [];
        // Nothing to tile (an all-absent/degraded view) → no workspace side effect.
        if (view.pages.length === 0) {
            return { provider: this.name, ok: view.opened.length === 0, opened, absent, degraded, pages: 0 };
        }
        // Honest refuse when the cmux surface itself is down — nothing is sent.
        if (!this.deps.cmuxAdapter.isAvailable()) {
            return {
                provider: this.name,
                ok: false,
                opened,
                absent,
                degraded,
                pages: 0,
                error: "cmux is not connected — install cmux from https://cmux.io and run: cmux ping",
                code: "cmux_unavailable",
            };
        }
        // One gridded workspace per composed page (fresh names per launch token).
        const base = sanitizeWorkspaceName(`${this.workspacePrefix}:${view.id}#${this.newLaunchToken()}`);
        let pagesPainted = 0;
        for (let pageIndex = 0; pageIndex < view.pages.length; pageIndex++) {
            const page = view.pages[pageIndex];
            const workspaceName = view.pages.length > 1 ? `${base}/${pageIndex + 1}` : base;
            // Use the composed layout's columns, or the same auto-grid as preview.
            const build = await this.deps.layoutService.buildWorkspacePanes(workspaceName, undefined, page.map((pane) => pane.paneCommand), view.columns ?? autoGridCols(page.length));
            if (build.ok) {
                pagesPainted += 1;
                for (const pane of page)
                    opened.push(pane.seat);
            }
            else {
                // The whole page failed to tile — degrade its seats honestly, keep going.
                for (const pane of page) {
                    degraded.push({
                        seat: pane.seat,
                        host: CMUX_LOCAL_HOST,
                        reason: `cmux: ${build.message || build.code}`,
                    });
                }
            }
        }
        return {
            provider: this.name,
            ok: opened.length > 0 || view.opened.length === 0,
            opened,
            absent,
            degraded,
            pages: pagesPainted,
        };
    }
}
//# sourceMappingURL=cmux-provider-adapter.js.map