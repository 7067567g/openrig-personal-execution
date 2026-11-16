import type Database from "better-sqlite3";
import type { SeatEnv } from "./seat-env.js";
export declare const CLAUDE_PLUGIN_DIRS_ENV = "CLAUDE_CODE_PLUGIN_DIRS";
/** The seat's launch project, set for a seat that loads the plugin, so a Claude started elsewhere inside the seat can be told from the seat. */
export declare const SEAT_PROJECT_DIR_ENV = "OPENRIG_SEAT_PROJECT_DIR";
/** The vendored openrig-core plugin directory under `pluginsDir`, or undefined when it is not vendored. */
export declare function vendoredCorePluginDir(pluginsDir?: string): string | undefined;
/** The resolved plugin locations in a node's persisted startup context (what the profile resolver selected for it). */
export declare function pluginPathsOf(entries: ReadonlyArray<{
    category: string;
    absolutePath: string;
}>): string[];
/** The plugin locations the node's last launch resolved, or undefined when none were saved (or they can't be read). */
export declare function persistedPluginPaths(db: Database.Database, nodeId: string): string[] | undefined;
/**
 * The directory to load into this node's Claude process, or undefined: not a Claude seat, the plugin is not vendored,
 * or the seat's resolved plugin selection doesn't include it. `selectedPaths` is the selection a launch has just
 * resolved or a snapshot saved; without it the node's persisted startup context is read.
 */
export declare function seatCorePluginDir(node: {
    id: string;
    runtime: string | null;
}, db: Database.Database, selectedPaths?: readonly string[], pluginsDir?: string): string | undefined;
/** The seat's declared env with the vendored plugin added after any list the seat declared itself. */
export declare function withCorePlugin(seatEnv: SeatEnv, dir: string | undefined): SeatEnv;
//# sourceMappingURL=claude-core-plugin-env.d.ts.map