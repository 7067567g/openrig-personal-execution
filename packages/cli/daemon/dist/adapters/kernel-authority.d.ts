import type { NodeBinding } from "../domain/runtime-adapter.js";
import { SettingsStore } from "../domain/user-settings/settings-store.js";
export declare const KERNEL_CLAUDE_ALLOW: string[];
export declare const TEAM_CLAUDE_ALLOW: string[];
export declare const TEAM_CLAUDE_ASK: string[];
type LaunchChoice = Pick<NodeBinding, "kernelAuthority" | "teamPermissionDefault" | "nonInterruptive" | "launchPosture" | "permissionMode"> & {
    /** Whether OpenRig's managed compaction acts on this Claude launch; read from the policy when absent. */
    managedCompaction?: boolean;
};
/** OpenRig's managed compaction acts on Claude seats while its policy is on with a threshold the enforcer accepts (it
 *  treats any other threshold as off). Read fresh at each launch; an unreadable policy reads as off. */
export declare function managedCompactionActive(store?: Pick<SettingsStore, "resolveClaudeCompactionPolicy">): boolean;
/** Session flags only; never writes a personal/project permission file. */
export declare function operationalLaunchArgs(runtime: string, choice: LaunchChoice): string[];
export declare function operationalLaunchArg(runtime: string, choice: LaunchChoice): string;
export {};
//# sourceMappingURL=kernel-authority.d.ts.map