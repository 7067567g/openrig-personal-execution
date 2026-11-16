import { Command } from "commander";
export { runProgram } from "./cli-error.js";
type Load = () => Promise<Command>;
/** Each top-level command by its name, in createProgram()'s order (a test keeps them equal). */
export declare const COMMAND_LOADERS: ReadonlyMap<string, Load>;
/** The program for `rig <first> …` with only what that call needs: the bare root for
 *  `--version`, the root and that one command for a known name; null for everything else. */
export declare function createLazyProgram(first: string | undefined): Promise<Command | null>;
//# sourceMappingURL=lazy-program.d.ts.map