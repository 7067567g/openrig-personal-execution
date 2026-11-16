#!/usr/bin/env node
import type { RunProgramIo } from "./cli-error.js";
export declare function resolveBinEntry(invokedPath?: string | undefined, moduleUrl?: string): string;
export declare function isDirectRun(argv1?: string | undefined, moduleUrl?: string): boolean;
export declare function resolveNodeReexecBinary(currentExecPath?: string, invokedPath?: string | undefined, env?: NodeJS.ProcessEnv, exists?: (candidate: string) => boolean, realpath?: (candidate: string) => string): string | null;
export declare function canLoadInstalledNative(node: string, wrapper: string): boolean;
export declare function run(argv?: string[], io?: RunProgramIo): Promise<void>;
//# sourceMappingURL=bin-wrapper.d.ts.map