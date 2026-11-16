import fs from "node:fs";
import nodePath from "node:path";
import { execFile } from "node:child_process";
import { AppliedLaunchObservationStore } from "./applied-launch-observation-store.js";
import { diagnoseRuntimePosture, parseClaudePermissionModes, } from "./permission-drift.js";
function commandAvailable(command) {
    const pathValue = process.env.PATH;
    if (!pathValue)
        return false;
    for (const entry of pathValue.split(nodePath.delimiter)) {
        if (!entry)
            continue;
        try {
            fs.accessSync(nodePath.join(entry, command), fs.constants.X_OK);
            return true;
        }
        catch {
            // Try the next PATH entry.
        }
    }
    return false;
}
export async function loadClaudePermissionModes() {
    return await new Promise((resolve) => {
        execFile("claude", ["--help"], {
            encoding: "utf8",
            timeout: 1_000,
            maxBuffer: 1024 * 1024,
        }, (error, stdout) => resolve(error ? null : parseClaudePermissionModes(stdout)));
    });
}
/** Warmed outside request handling; cold reads are immediate UNKNOWN. */
export class ClaudePermissionModeCache {
    load;
    ttlMs;
    now;
    value = null;
    loading = false;
    loadedAt = 0;
    constructor(load = loadClaudePermissionModes, ttlMs = 60_000, now = Date.now) {
        this.load = load;
        this.ttlMs = ttlMs;
        this.now = now;
    }
    warm() {
        if (this.loading || (this.loadedAt > 0 && this.now() - this.loadedAt < this.ttlMs))
            return;
        this.loading = true;
        void this.load()
            .then((value) => { this.value = value; })
            .catch(() => { this.value = null; })
            .finally(() => {
            this.loadedAt = this.now();
            this.loading = false;
        });
    }
    read() {
        this.warm();
        return this.value;
    }
}
function productionFs(permissionModes, accessSync) {
    return {
        readFile: (path) => fs.readFileSync(path, "utf8"),
        cwdReadable: (path) => {
            try {
                accessSync(path, fs.constants.R_OK);
                return true;
            }
            catch (error) {
                const code = error.code;
                if (code === "EACCES" || code === "EPERM")
                    return false;
                throw error;
            }
        },
        commandAvailable,
        claudePermissionModes: () => permissionModes.read(),
    };
}
/** Strict, read-only, generation-aware observer for an explicitly requested seat. */
export class PermissionDriftObserver {
    input;
    observations;
    fs;
    now;
    constructor(input) {
        this.input = input;
        this.observations = new AppliedLaunchObservationStore(input.db);
        // Hermeticity (hotfix qitem-20260822230440-da0d2ad6 FIX 2): construction no
        // longer eagerly warms the mode cache — `read()` self-warms (see the cache),
        // so the eager call added nothing but an execFile("claude","--help") from
        // every constructed-but-unconsulted observer (the daemon test suite built
        // ~72 such apps per run). The production daemon keeps its boot-time warm:
        // startup.ts constructs the observer with an explicitly warmed cache.
        const permissionModes = input.permissionModes ?? new ClaudePermissionModeCache();
        this.fs = input.fs ?? productionFs(permissionModes, input.accessSync ?? ((path, mode) => fs.accessSync(path, mode)));
        this.now = input.now;
    }
    diagnose(nodeId) {
        const node = this.input.db.prepare("SELECT runtime, cwd FROM nodes WHERE id = ?").get(nodeId);
        if (!node)
            return null;
        return diagnoseRuntimePosture({
            runtime: node.runtime ?? "unknown",
            cwd: node.cwd,
            applied: this.observations.readCurrent(nodeId),
            fs: this.fs,
            now: this.now,
        });
    }
}
//# sourceMappingURL=permission-drift-observer.js.map