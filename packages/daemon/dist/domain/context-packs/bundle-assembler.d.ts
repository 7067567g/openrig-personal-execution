import { type ContextPackEntry } from "./context-pack-types.js";
export interface AssembledBundle {
    /** Concatenated bundle string ready for SessionTransport.send. */
    text: string;
    /** Total length in bytes of the assembled string (UTF-8 encoded). */
    bytes: number;
    /** Daemon-derived estimate (chars / 4 rounded). */
    estimatedTokens: number;
    /** Per-file metadata threaded through assembly for the dry-run preview. */
    files: Array<{
        path: string;
        role: string;
        bytes: number;
        estimatedTokens: number;
    }>;
    /** Files that were referenced in the manifest but missing on disk;
     *  surfaced as a warning in the preview rather than a hard fail so
     *  operator can repair. */
    missingFiles: Array<{
        path: string;
        role: string;
    }>;
}
export interface AssembleOpts {
    packEntry: ContextPackEntry;
    /** Defaults to readFileSync; injected for tests. */
    readFile?: (absPath: string) => string;
}
/** Atom 3's deliberately dumb composition separator. Source bytes are
 * otherwise untouched: no trim, framing headers, or forced final newline. */
export declare const PLAIN_COMPOSE_SEPARATOR = "\n\n";
export interface PlainFileInput {
    path: string;
    /** null records an honestly missing member. */
    content: string | null;
}
export interface PlainFileAssembly {
    text: string;
    bytes: number;
    estimatedTokens: number;
    files: Array<{
        path: string;
        bytes: number;
        estimatedTokens: number;
    }>;
    missingFiles: Array<{
        path: string;
    }>;
}
/**
 * Atom 3 compose core: concatenate present file contents in declared order.
 * The durable store retains each source as its own member; this projection is
 * the exact content future delivery verbs can resolve without coupling the
 * context noun to SessionTransport.
 */
export declare function assemblePlainFiles(opts: {
    files: PlainFileInput[];
}): PlainFileAssembly;
/**
 * Assembles a context pack into a single paste-ready string.
 *
 * Frame:
 *   # OpenRig Context Pack: <name> v<version>
 *   <purpose, if any>
 *
 *   ## File: <path> (role: <role>)
 *   <file contents>
 *
 *   ## File: <path> (role: <role>)
 *   <file contents>
 *
 *   ...
 *
 * Each file is separated by a blank line so adjacent contents don't
 * accidentally merge into a contiguous markdown block. Missing files
 * are skipped (operator sees them in `missingFiles` for repair).
 */
export declare function assembleBundle(opts: AssembleOpts): AssembledBundle;
//# sourceMappingURL=bundle-assembler.d.ts.map