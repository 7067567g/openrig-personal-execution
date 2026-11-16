export interface LocalRequest {
    op: "roots" | "list" | "read";
    root?: string;
    path?: string;
}
export declare function localRead(request: LocalRequest): {
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
} | {
    source: string;
    readAt: string;
    entries: {
        error?: string | undefined;
        label: string | undefined;
        kind: string | undefined;
        source: string | undefined;
        root: string;
        path: string;
    }[];
};
//# sourceMappingURL=local-reading.d.ts.map