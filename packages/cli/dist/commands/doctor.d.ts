import { Command } from "commander";
import { ConfigStore } from "../config-store.js";
interface DoctorCheck {
    name: string;
    status: "pass" | "warn" | "fail" | "skipped";
    message: string;
    reason?: string;
    fix?: string;
}
export interface DoctorDeps {
    exists: (p: string) => boolean;
    baseDir: string;
    readFile: (path: string) => string | null;
    exec: (cmd: string) => string;
    checkPort: (port: number, host: string) => Promise<boolean>;
    configStore: Pick<ConfigStore, "resolve">;
    platform?: NodeJS.Platform;
    /** Same CODEX_HOME and credential environment used by setup. */
    env?: NodeJS.ProcessEnv;
    mkdirp?: (path: string) => void;
    checkWritable?: (path: string) => void;
    fetch?: (url: string) => Promise<{
        ok: boolean;
        json?: () => Promise<unknown>;
    }>;
    /**
     * Build B — path to a rig spec to check against the RUNNING rig of the same name (`--spec`).
     *
     * Supplied explicitly because it cannot be discovered. Nothing persists a running rig's spec
     * path: the `rigs` table has no spec/rigRoot column, `rig_services.rig_root` is empty, and
     * `projection_manifest.source_spec` is empty. The daemon does not remember which file described
     * the rig it is running. Absent, the check SKIPS with that reason rather than passing.
     */
    specPath?: string;
    /** Live seat ids (`<pod>.<member>`) for the spec's rig; null when the topology cannot be read. */
    fetchLiveLogicalIds?: (rigName: string) => Promise<string[] | null>;
}
export declare function runDoctorChecks(deps: DoctorDeps, providerChecks?: DoctorCheck[]): {
    checks: DoctorCheck[];
    portCheck: Promise<DoctorCheck>;
    asyncChecks: Promise<DoctorCheck>[];
};
export declare function doctorCommand(depsOverride?: DoctorDeps): Command;
export {};
//# sourceMappingURL=doctor.d.ts.map