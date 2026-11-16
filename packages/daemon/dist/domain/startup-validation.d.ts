import type { StartupBlock } from "./types.js";
/**
 * Validate a startup file entry.
 * @param raw - parsed file object
 * @param index - position in files array
 * @param prefix - error message prefix
 * @returns array of error strings
 */
export declare function validateStartupFile(raw: Record<string, unknown>, index: number, prefix: string): string[];
/**
 * Validate a startup action entry.
 * @param raw - parsed action object
 * @param index - position in actions array
 * @param prefix - error message prefix
 * @returns array of error strings
 */
export declare function validateStartupAction(raw: Record<string, unknown>, index: number, prefix: string): string[];
/**
 * Validate a startup block (files + actions).
 * @param raw - parsed startup object
 * @param prefix - error message prefix
 * @returns array of error strings
 */
export declare function validateStartupBlock(raw: unknown, prefix: string): string[];
/**
 * Normalize a startup block into the canonical typed shape with defaults.
 * @param raw - parsed startup object
 * @returns normalized StartupBlock
 */
export declare function normalizeStartupBlock(raw: unknown): StartupBlock;
//# sourceMappingURL=startup-validation.d.ts.map