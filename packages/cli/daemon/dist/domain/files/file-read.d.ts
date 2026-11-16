import { type AllowlistRoot } from "./path-safety.js";
export declare const FILE_READ_TRUNCATION_BYTES = 1048576;
export declare function readAllowedFile(allowlist: AllowlistRoot[], root: string, relativePath: string): {
    root: string;
    path: string;
    absolutePath: string;
    resolvedPath: string;
    content: string;
    binary: boolean;
    mtime: string;
    contentHash: string;
    size: number;
    truncated: boolean;
    truncatedAtBytes: number | null;
    totalBytes: number;
};
//# sourceMappingURL=file-read.d.ts.map