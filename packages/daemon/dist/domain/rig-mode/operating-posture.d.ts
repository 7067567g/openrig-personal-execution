import type Database from "better-sqlite3";
import type { HealthRecord } from "../health-projection.js";
import type { RigModeStore } from "./rig-mode-store.js";
import { type OperatorContextReadContext, type OperatorContextScope } from "./rig-mode-types.js";
import type { SettingsStore } from "../user-settings/settings-store.js";
/** Production wiring for the catalogPath callback: an explicitly configured
 *  workspace.catalog_path (env or config file). When it's only the derived
 *  default, return undefined so the service keeps its own default,
 *  <real workspace>/workspace.yaml: a relative project root such as ../gamma then
 *  resolves beside the real workspace folder even when workspace.root is a symlink. */
export declare function configuredCatalogPath(settings: Pick<SettingsStore, "resolveOne">): () => string | undefined;
export interface OperatingContext extends OperatorContextReadContext {
    phase: {
        value: string | null;
        source: string | null;
    };
    sources: string[];
    paths?: {
        project: string;
        mission?: string;
        workstream?: string;
    };
    /** Signals the shared project inference skipped (for example a malformed rigs list). */
    warnings?: string[];
}
export interface OperatingPosture {
    posture: "human-led" | "delegated" | "unknown";
    source: "product-default" | "binding" | "unknown";
    context: OperatingContext | null;
    binding: {
        id: string;
        scope: OperatorContextScope;
        setAt: string;
        evidence: string;
    } | null;
    reason: string;
    grantsAuthority: false;
    members?: Array<{
        qitemId: string;
        posture: string;
        source: string;
        bindingId: string | null;
    }>;
}
/** One reader over existing mode bindings, queue/workflow identities, and authored work nodes.
 * Preferences never create authorization, rewrite phase, or modify health policy. */
export declare class OperatingPostureService {
    private readonly db;
    private readonly modes;
    private readonly workspaceRoot;
    /** Configured workspace.catalog_path; <workspace>/workspace.yaml when unset. */
    private readonly catalogPath?;
    constructor(db: Database.Database, modes: RigModeStore, workspaceRoot: () => string, 
    /** Configured workspace.catalog_path; <workspace>/workspace.yaml when unset. */
    catalogPath?: (() => string | undefined) | undefined);
    context(input: OperatorContextReadContext): OperatingContext;
    /** What the shared inference reads: a qitem's destination rig and that seat's working folder, or for a
     *  rig-scoped read the rig's name alone. */
    private inferenceSignals;
    resolve(input: OperatorContextReadContext): OperatingPosture;
    /** Canonicalize only deliberate operating-posture writes; legacy ergonomic modes keep their contract. */
    target(scope: OperatorContextScope, qualifier: string | null): string | null;
    forHealth(record: HealthRecord): OperatingPosture;
}
//# sourceMappingURL=operating-posture.d.ts.map