export interface Surface {
    /** Full command paths, space-joined (e.g. "queue create", "scope slice create"). */
    commands: Set<string>;
    /** "<command-path> <--flag>" entries, split on FLAG_SEP. */
    flags: Set<string>;
}
export declare const FLAG_SEP = "\0";
/**
 * Reduce an option's first argument (the flags string) to its canonical long
 * flag, ignoring the value placeholder. Examples:
 *   "--body-file <path>"  -> "--body-file"
 *   "-l, --literal"       -> "--literal"
 *   "--no-mission-notes"  -> "--no-mission-notes"
 *   "-y"                  -> "-y"
 * Returns null when no flag token is present.
 */
export declare function normalizeFlag(flagsArg: string): string | null;
/** Build the combined command surface from a set of `{name, text}` sources. */
export declare function extractSurfaceFromSources(files: {
    name: string;
    text: string;
}[]): Surface;
//# sourceMappingURL=extract-surface.d.ts.map