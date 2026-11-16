import { type ManagedBlockMergeFsOps } from "./managed-blocks.js";
import type { NodeStartupSnapshot } from "./types.js";
export interface GuidanceItem {
    blockId: string;
    sourcePath: string;
    /** An older "auto" startup file whose source can't be read, so it can't be classified. If its
     *  block isn't in the file, that's reported as a gap; nothing is written for it. */
    unresolved?: boolean;
}
export interface SeatGuidance {
    targetPath: string;
    items: GuidanceItem[];
}
/** The guidance file a seat's managed blocks live in, and the blocks it should hold on restore. */
export declare function seatGuidance(startupCtx: NodeStartupSnapshot | null, cwd: string | null | undefined, claudeManagedBlockFile: string | null | undefined, exists: (path: string) => boolean, readFile: (path: string) => string): SeatGuidance | null;
/** The block ids the seat's guidance file lacks right now (absent, or only partly there). */
export declare function missingGuidanceBlocks(guidance: SeatGuidance, fs: Pick<ManagedBlockMergeFsOps, "exists" | "readFile">): string[];
export interface GuidanceRepair {
    /** Blocks put back from their saved source. */
    restored: string[];
    /** Blocks still missing, each with the reason. */
    gaps: string[];
}
/** Put back only the missing managed guidance blocks. Existing blocks and any other text in the
 *  file are left exactly as they are. Never throws: a failure becomes a reported gap. */
/** Would appending these blocks to `content` be safe for the next `rig down`? Decided by effect,
 *  with cleanup itself: safe only when stripping the new file gives exactly what stripping the
 *  current one gives, so the added blocks strip away cleanly and take nothing else with them. A
 *  stray, truncated or misplaced marker (cleanup strips from any BEGIN to the next END that ends a
 *  line) makes the two differ. No second marker grammar to keep in step with cleanup. */
export declare function appendIsCleanupSafe(content: string, blocks: Array<{
    blockId: string;
    content: string;
}>): boolean;
/** Put back only the missing managed guidance blocks. Existing blocks and any other text in the
 *  file are left exactly as they are, and nothing is written unless cleanup would later remove
 *  exactly what was added. Never throws: a failure becomes a reported gap. */
export declare function restoreMissingGuidance(guidance: SeatGuidance, fs: ManagedBlockMergeFsOps): GuidanceRepair;
//# sourceMappingURL=restore-guidance.d.ts.map