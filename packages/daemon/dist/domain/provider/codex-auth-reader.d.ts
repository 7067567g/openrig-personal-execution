export interface CodexSeatRow {
    seat: string;
    rig: string;
    runtime: string;
    cwd: string;
    /** The codex-auth profile name this seat is registered against (opaque, non-secret). */
    authProfile: string;
    updatedTs: string;
}
/** How the seat registry read went: absent (ENOENT), read, or unreadable (the error code only, never contents). */
export interface CodexSeatRegistryRead {
    status: "absent" | "read" | "unreadable";
    code?: string;
    /** Rows skipped because they don't have the six columns. */
    malformedRows: number;
}
export interface CodexAuthMetadata {
    /** Profile NAMES (opaque, non-secret refs) — never file contents. */
    profiles: string[];
    seats: CodexSeatRow[];
    /** Additive: lets a caller tell a supported absence from an unreadable or malformed registry. */
    registry?: CodexSeatRegistryRead;
    /** Additive: how the profile folder read went (absent, read, or unreadable with the error code only). */
    profilesRead?: {
        status: "absent" | "read" | "unreadable";
        code?: string;
    };
}
/** Read the codex-auth on-disk METADATA (profile names + seat registry). Never throws; never
 *  surfaces token-class content. Absent home/files yield empty arrays. */
export declare function readCodexAuthMetadata(env?: NodeJS.ProcessEnv): CodexAuthMetadata;
//# sourceMappingURL=codex-auth-reader.d.ts.map