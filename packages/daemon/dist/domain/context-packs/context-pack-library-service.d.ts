import { type PlainFileAssembly } from "./bundle-assembler.js";
import { type ContextPackEntry, type ContextPackSourceType } from "./context-pack-types.js";
export interface ContextPackLibraryRoot {
    /** Absolute path to a discovery root. Slice-03 Atom 2: a pack is any
     *  NESTED directory containing manifest.yaml; its ref is the relative
     *  path from this root (spec §2 path-like refs, e.g.
     *  `packs/compaction-restore`). */
    path: string;
    sourceType: ContextPackSourceType;
}
export interface ContextPackLibraryOpts {
    roots: ContextPackLibraryRoot[];
    /** Narrow test seam for Atom 3's cleanup-on-write-failure contract. */
    writeFile?: (path: string, data: string | Buffer) => void;
}
export interface ComposeContextPackSource {
    /** Absolute source path, resolved by the local CLI caller. */
    path: string;
    /** Original caller spelling retained as YAML-serialized provenance. */
    label: string;
}
export interface ComposeContextPackResult extends PlainFileAssembly {
    ref: string;
    entry: ContextPackEntry;
}
/** Stable opaque id = `context-pack:<ref>` (Slice-03 Atom 5). The path-like ref
 *  IS the identity, so the id is unique per pack — two refs that share a manifest
 *  name+version no longer collide — and it keeps the `context-pack:` prefix the
 *  UI's library-review dispatch keys on. Colon-id name:version addressing/parsing
 *  was removed with the legacy index; resolution is by-ref only. */
export declare function contextPackId(ref: string): string;
export { estimateTokensFromBytes } from "./token-estimate.js";
export declare class ContextPackLibraryService {
    /** Slice-03 Atom 2 (guard correction b74e4576): the PRIMARY index — the
     *  normalized safe path-like ref IS the pack identity (spec §2 "refs are
     *  the contract"). getByRef/list/scan().count all observe THIS map; same
     *  ref across roots is last-root-wins here, so precedence holds everywhere
     *  (one row, one count, one resolution). Distinct refs with identical
     *  manifest name/version are independent entries by construction. */
    private entriesByRef;
    private readonly roots;
    private readonly writeFile;
    constructor(opts: ContextPackLibraryOpts);
    /** Slice-03 Atom 2 — recursive path-addressed discovery: walk a root and
     *  return every NESTED dir containing manifest.yaml, with its path-like
     *  ref. Packs are LEAVES: a manifest-bearing dir's subtree belongs to that
     *  pack, so discovery does not descend below it (a nested manifest would
     *  make the outer pack's files ambiguous). Symlinked dirs are never
     *  traversed (dirent.isDirectory() is lstat-shaped — the pre-Atom-2
     *  semantics, carried into the recursion). */
    private discoverPackDirs;
    /** Re-walk all roots, replace the in-memory index, return a count. */
    scan(): {
        count: number;
        errors: Array<{
            source: string;
            error: string;
        }>;
    };
    /** Slice-03 Atom 2 — RESOLVE trust boundary: get a pack by its path-like
     *  ref. An unsafe ref is a structured, fail-visible error BEFORE any
     *  lookup; a safe-but-absent ref is an honest null. */
    getByRef(ref: string): ContextPackEntry | null;
    /** Slice-03 Atom 4 — DELETE trust boundary: remove a pack by its path-like
     *  ref. Safety ordering mirrors getByRef/compose: an unsafe ref is a
     *  structured, fail-visible error BEFORE any filesystem op; a safe-but-absent
     *  ref is an honest pack_not_found; a shipped `builtin` pack is REFUSED — rm
     *  mirrors add's operator-writable contract (add only ever writes into the
     *  user_file root, and rm never rmSyncs shipped assets under the package
     *  directory). On success the pack directory is deleted and a re-scan makes
     *  the ref stop resolving (durable removal). */
    removeByRef(ref: string): {
        removed: boolean;
        ref: string;
        removedPath: string;
    };
    list(): ContextPackEntry[];
    /**
     * Atom 3: compose named files into one durable path-ref pack.
     *
     * Safety ordering is load-bearing: validate the ref first; reject every
     * existing/hidden/unsafe namespace and preflight every source before the
     * first mutation. Members are written before manifest.yaml, so discovery
     * can never observe a partial pack. A failed write removes the new target.
     */
    composeFromFiles(opts: {
        outRef: string;
        sources: ComposeContextPackSource[];
    }): ComposeContextPackResult;
    /** Resolve the absolute file path for a pack entry's file, with a
     *  containment check that prevents path-traversal escaping the pack
     *  directory. */
    resolveFileWithinPack(packEntry: ContextPackEntry, relPath: string): string;
    private readPackEntry;
}
//# sourceMappingURL=context-pack-library-service.d.ts.map