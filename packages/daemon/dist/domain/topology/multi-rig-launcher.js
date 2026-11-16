// OPR.0.4.4.11 — MultiRigLauncher: the THIN walker (FR-3/FR-4/FR-5).
//
// It INVOKES the existing single-rig leaves — it never re-implements stages,
// locks, provenance, or result shapes. A local entry runs through the SAME
// public bootstrap() entry + tryAcquire/release lock pair routes/up.ts uses
// (guard G-2: the per-sourceRef lock is ROUTE-side today — bootstrap() never
// acquires; the launcher explicitly participates in that same lock set,
// acquire before the leaf, release in finally on success AND failure). A
// host-placed entry runs through the shipped remote POST /api/up leaf. Both
// leaves are injected so this module stays testable and the wiring in
// routes/up.ts (the ONLY production caller) binds the real seams.
//
// Aggregate contract (arch ruling 5, verbatim): status is the CLOSED enum
// {ok | failed | skipped}; entries after the failed one report `skipped`
// EXPLICITLY (never absent — omission-proof); `host` is present uniformly on
// every entry (the literal "local" for local entries); overall success =
// every entry ok. Stop-on-failure is the ONLY v0 behavior (FR-5): no new
// entry starts after a failure; already-started rigs are reported honestly
// (mixed state, no rollback ceremony).
import { resolvePlacementHost } from "../hosts/hosts-registry-reader.js";
/** Mirrors the route's 409 lock-conflict semantics for a topology entry. */
const LOCK_CONFLICT_ERROR = "Already in progress for this source (conflict): a concurrent up holds this rig's launch lock";
export class MultiRigLauncher {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async launch(manifest) {
        const entries = manifest.rigs;
        // Every entry starts explicitly skipped — an entry the walk never
        // reaches is REPORTED, not absent (omission-proof aggregate).
        const results = entries.map((e) => ({
            rigRef: e.source,
            host: e.host ?? "local",
            status: "skipped",
        }));
        // ── Pre-launch placement validation (FR-1/FR-4: per-entry structured
        // errors BEFORE any launch attempt). Registry is read once, only if a
        // host-placed entry exists. Any placement failure aborts the whole run
        // before the first leaf call: bad entries report failed, the rest stay
        // skipped.
        const placed = new Map();
        if (entries.some((e) => e.host !== undefined)) {
            const reg = this.deps.loadRegistry();
            let placementFailed = false;
            for (let i = 0; i < entries.length; i++) {
                const hostId = entries[i].host;
                if (hostId === undefined)
                    continue;
                if (!reg.ok) {
                    results[i] = { ...results[i], status: "failed", error: reg.error };
                    placementFailed = true;
                    continue;
                }
                const res = resolvePlacementHost(reg.registry, hostId);
                if (!res.ok) {
                    results[i] = { ...results[i], status: "failed", error: res.error };
                    placementFailed = true;
                }
                else {
                    placed.set(i, res.host);
                }
            }
            if (placementFailed)
                return { ok: false, entries: results };
        }
        // ── Staged walk: entries START in manifest order under the fixed cap
        // (default 1 = strictly sequential); a failure stops all further starts
        // while in-flight entries complete and report honestly.
        let nextIndex = 0;
        let stopped = false;
        const runEntry = async (i) => {
            const entry = entries[i];
            const hostEntry = placed.get(i);
            try {
                if (hostEntry) {
                    const res = await this.deps.launchRemote(entry.source, hostEntry);
                    results[i] = {
                        rigRef: entry.source,
                        host: hostEntry.id,
                        status: res.ok ? "ok" : "failed",
                        ...(res.ok ? {} : { error: res.error ?? "remote up failed" }),
                    };
                    return;
                }
                // Local: the route-side lock discipline, explicitly (guard G-2).
                // Lock key and launch ref are the SAME resolved string (guard F1) —
                // the aggregate's rigRef stays the raw manifest string for display.
                const launchRef = this.deps.resolveLocalRef ? this.deps.resolveLocalRef(entry.source) : entry.source;
                if (!this.deps.tryAcquire(launchRef)) {
                    results[i] = { rigRef: entry.source, host: "local", status: "failed", error: LOCK_CONFLICT_ERROR };
                    return;
                }
                try {
                    const res = await this.deps.launchLocal(launchRef);
                    results[i] = {
                        rigRef: entry.source,
                        host: "local",
                        status: res.ok ? "ok" : "failed",
                        ...(res.ok ? {} : { error: res.error ?? "bootstrap failed" }),
                    };
                }
                finally {
                    this.deps.release(launchRef);
                }
            }
            catch (err) {
                results[i] = {
                    rigRef: entry.source,
                    host: hostEntry ? hostEntry.id : "local",
                    status: "failed",
                    error: err.message,
                };
            }
        };
        const cap = Math.max(1, manifest.concurrency);
        const workers = Array.from({ length: Math.min(cap, entries.length) }, async () => {
            while (!stopped) {
                const i = nextIndex;
                if (i >= entries.length)
                    return;
                nextIndex += 1;
                await runEntry(i);
                if (results[i].status === "failed")
                    stopped = true; // FR-5: stop at the failed entry
            }
        });
        await Promise.all(workers);
        return { ok: results.every((r) => r.status === "ok"), entries: results };
    }
}
//# sourceMappingURL=multi-rig-launcher.js.map