import type { CrashCartRenderOpts } from "./from-emit.js";
export type CrashCartKeyAction = "start-daemon" | "retry" | "details" | "inspect" | "onboarding" | "restore" | "restore-confirm";
/** Map a key ("s"/"i"/"n"/"r"/"enter") to a crash-cart action for the active daemon-down screen, or
 *  null (not a crash-cart key here → falls through to normal TUI handling). */
export declare function resolveCrashCartKey(key: string, opts: CrashCartRenderOpts): CrashCartKeyAction | null;
//# sourceMappingURL=keys.d.ts.map