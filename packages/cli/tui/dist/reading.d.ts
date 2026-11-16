import { type ContentLine } from "./detail.js";
import type { Action } from "./types.js";
export interface FileTarget {
    root: string;
    path: string;
    anchor?: string;
}
export interface FileRoot {
    name: string;
    path: string;
}
export interface FileRead {
    root: string;
    path: string;
    absolutePath: string;
    resolvedPath?: string;
    content: string;
    mtime: string;
    contentHash: string;
    size: number;
    truncated: boolean;
    truncatedAtBytes: number | null;
    totalBytes: number;
    binary?: boolean;
}
export type FileReadResult = FileRead | {
    error: string;
    message?: string;
};
/** Map only against explicitly served roots, never search another installation. */
export declare function fileTargetForPath(source: string, roots: FileRoot[]): FileTarget | null;
export declare function referenceAction(origin: FileTarget, href: string): Action;
export declare function referenceLines(text: string, origin: FileTarget): ContentLine[];
export declare function fileLines(result: FileReadResult | null | undefined, target: FileTarget, width?: number): ContentLine[];
export declare function externalLines(url: string, width: number): ContentLine[];
//# sourceMappingURL=reading.d.ts.map