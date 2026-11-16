import type { TopologyManifest } from "./topology-manifest.js";
import type { HostEntry, HostRegistryLoadResult } from "../hosts/hosts-registry-reader.js";
export type TopologyEntryStatus = "ok" | "failed" | "skipped";
export interface TopologyEntryResult {
    rigRef: string;
    /** Uniform on every entry: the placed host id, or the literal "local". */
    host: string;
    status: TopologyEntryStatus;
    error?: string;
}
export interface TopologyLaunchResult {
    /** True ONLY when every entry is ok (FR-5 — no false green). */
    ok: boolean;
    entries: TopologyEntryResult[];
}
export interface MultiRigLauncherDeps {
    /** The SAME public lock pair the up route uses (bootstrap-orchestrator). */
    tryAcquire: (sourceRef: string) => boolean;
    release: (sourceRef: string) => void;
    /** The existing local single-rig leaf (public bootstrap() via routes/up.ts
     *  wiring). Resolves ok:false with the leaf's own error on failure — the
     *  launcher invents no failure taxonomy. */
    launchLocal: (source: string) => Promise<{
        ok: boolean;
        error?: string;
    }>;
    /** The shipped remote POST /api/up leaf for a placed entry. */
    launchRemote: (source: string, host: HostEntry) => Promise<{
        ok: boolean;
        error?: string;
    }>;
    /** Lazy hosts-registry read (shared reader) — consulted only when the
     *  manifest actually places entries on hosts. */
    loadRegistry: () => HostRegistryLoadResult;
    /** Resolve a local entry's manifest source string to the EXACT ref used
     *  for BOTH the lock and the leaf (guard fixback F1): the orchestrator
     *  normalizes lock keys with path.resolve, so locking the raw relative
     *  string would key against the daemon cwd while the leaf launches the
     *  manifest-dir-resolved file — false lock negatives (standalone up of
     *  the real path doesn't conflict) AND false positives (two manifests'
     *  './a.yaml' collide across different files). Identity when omitted. */
    resolveLocalRef?: (source: string) => string;
}
export declare class MultiRigLauncher {
    private deps;
    constructor(deps: MultiRigLauncherDeps);
    launch(manifest: TopologyManifest): Promise<TopologyLaunchResult>;
}
//# sourceMappingURL=multi-rig-launcher.d.ts.map