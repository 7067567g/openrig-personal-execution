import type Database from "better-sqlite3";
import type { NodeBinding } from "./runtime-adapter.js";
import { type NativePermissionSelection } from "./native-permission-selection.js";
export interface StoredNativePermissionSelection extends NativePermissionSelection {
    actor: string;
    reason: string;
    updatedAt: string;
}
export type PermissionModeSource = "explicit" | "member_spec" | "rig_spec" | "kernel_default" | "system_default";
export interface ResolvedSeatPermission {
    effectiveMode: string;
    source: PermissionModeSource;
    launchPosture?: "floor" | "full_bypass" | "auto";
    permissionMode?: string;
    fallbackReason?: string;
}
/** The stable node owns the desired setting. Native history and current processes are untouched. */
export declare class NativePermissionStore {
    private readonly db;
    constructor(db: Database.Database);
    /** Kernel is the persisted class-of-one rig, never a pane-name or cwd heuristic.
     * Authored policies and named Codex profiles keep their existing meaning. */
    private launchDefault;
    /** One decision shared by fresh/continue, legacy restore and same-seat handover. */
    launchOverride(nodeId: string, runtime: string): Pick<NodeBinding, "launchPosture" | "permissionMode" | "kernelAuthority" | "teamPermissionDefault">;
    read(nodeId: string): StoredNativePermissionSelection | null;
    write(nodeId: string, selection: NativePermissionSelection | null, actor: string, reason: string): void;
    resolve(nodeId: string, runtime: string): ResolvedSeatPermission;
    apply(binding: NodeBinding, runtime: string): NodeBinding;
}
//# sourceMappingURL=native-permission-store.d.ts.map