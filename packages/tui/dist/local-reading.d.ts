import type { Action } from "./types.js";
export interface LocalRequest {
    op: "roots" | "list" | "read";
    root?: string;
    path?: string;
}
interface LocalEntry {
    label: string;
    root: string;
    path: string;
    source: string;
    kind: string;
    error?: string;
}
export interface LocalResult {
    entries?: LocalEntry[];
    source?: string;
    readAt?: string;
    error?: string;
    message?: string;
    absolutePath?: string;
    content?: string;
    mtime?: string;
    contentHash?: string;
    binary?: boolean;
    truncated?: boolean;
    truncatedAtBytes?: number | null;
    totalBytes?: number;
}
export interface LocalReadingState {
    request: LocalRequest;
    busy: boolean;
    selected: number;
    scroll: number;
    result: LocalResult;
}
export declare function readLocal(cliEntry: string | undefined, request: LocalRequest): Promise<LocalResult>;
export declare class LocalReadingController {
    private read;
    private changed;
    readonly state: LocalReadingState;
    private history;
    private generation;
    constructor(read: (request: LocalRequest) => Promise<LocalResult>, changed: () => void);
    load(request?: LocalRequest): Promise<void>;
    close(): void;
    key(key: string): Promise<boolean>;
}
export declare function localLines(s: LocalReadingState): Array<{
    text: string;
    action?: Action;
}>;
export {};
//# sourceMappingURL=local-reading.d.ts.map