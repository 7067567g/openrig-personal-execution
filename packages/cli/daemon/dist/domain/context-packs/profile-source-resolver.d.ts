import type { SourceKind } from "./profile-composer.js";
export declare class SourceResolutionError extends Error {
    constructor(message: string);
}
/** The file is genuinely absent under a root that exists: not a dangling link,
 *  not a missing or unconfigured root. Still a resolution failure; only the
 *  composer's post-compaction recap rule treats it differently. */
export declare class SourceAbsentError extends SourceResolutionError {
    constructor(message: string);
}
/** True for the seat tree's authored recap (`seat:RECAP.md`, any section). */
export declare function isSeatRecapAddress(address: string): boolean;
declare const TREE_KINDS: readonly ["project", "seat", "mission"];
export type TreeKind = (typeof TREE_KINDS)[number];
export interface ParsedSourceRef {
    kind: SourceKind;
    /** Relative path under the pack dir (library) or the kind's configured root. */
    rel: string;
}
/** Split a pre-`#` ref into its resolver kind + relative path. Fail-loud on an
 *  unknown prefix or a traversal-shaped path — a clean refusal, never an escape
 *  (the r2-B3 precedent from the trace verb). */
export declare function parseSourceRef(ref: string): ParsedSourceRef;
export interface ProfileSourceRoots {
    /** The selected project's tree directory — from config. */
    project?: string;
    /** The seat's tree directory (recap + lore beside LEARNED) — from config. */
    seat?: string;
    /** The mission's tree directory — from config. */
    mission?: string;
}
/** Byte-provenance record for one successful read (r1 rider 1 via 4a's review):
 *  the label must be CHECKABLE, not merely asserted — with a symlink in play a
 *  source label is accurate about the REF and wrong about the BYTES, and that
 *  bites on benign symlinks, not just hostile ones. */
export interface SourceReadRecord {
    ref: string;
    kind: SourceKind;
    /** The root the read was granted against. */
    base: string;
    /** base + rel, before symlink resolution. */
    nominalPath: string;
    /** Where the BYTES actually came from (realpath after the successful read). */
    realPath: string;
    /** True when realPath sits outside base. Computed via path.relative — never a
     *  bare string prefix (r1: `startsWith` says /seat-evil is inside /seat). */
    escapesRoot: boolean;
    /** The read file's mtime (ISO 8601), when it could be stat'ed after the read. */
    writtenAt?: string;
}
/** Build the composer's fail-loud readFile over the pack dir + configured tree
 *  roots. Every failure names the source kind and what was being resolved —
 *  a missing root is a MISSING CONFIG error, never a silent empty; a DANGLING
 *  symlink is its own named failure (a realistic corpus state, not a generic
 *  unreadable). Each successful read reports byte provenance via onRead. */
export declare function makeProfileReadFile(opts: {
    packDir: string;
    roots: ProfileSourceRoots;
    onRead?: (record: SourceReadRecord) => void;
}): (ref: string) => string;
/** The composer's per-piece source label (Q2-Amendment 1: every assembled piece
 *  is labeled with its source), derived from the atom's full address. */
export declare function sourceKindForAddress(address: string): SourceKind;
export {};
//# sourceMappingURL=profile-source-resolver.d.ts.map