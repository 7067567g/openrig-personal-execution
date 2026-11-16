// OPR.0.5.3.5 Atom 4a — the two pre-`#` resolvers behind ONE grammar.
//
// Q2-Amendment 1 (locked), the desk's grammar ruling verbatim: non-library sources
// are addressable with the SAME `#H2-slug/H3-slug` grammar; only the pre-`#`
// resolver differs — a library ref resolves through the library (here: the pack's
// own directory), a tree path resolves from CONFIGURED roots — and both resolve
// FAIL-LOUD. One grammar held in memory, two resolvers behind it, no second
// addressing convention. The kind prefix is the entire pre-`#` dialect:
//
//   walk.md#welcome              -> library (the pack's declared files)
//   project:SPEC.md              -> the configured project tree
//   seat:RECAP.md#decisions      -> the seat tree (recap + lore live beside LEARNED)
//   mission:NOTES.md#watch-items -> the mission tree
//
// Roots arrive from CONFIG through the caller (CE-v2 03-tree-addressability: an
// addressing verb resolves tree paths from config, never literals — this module
// holds no path literal and refuses to guess a missing root). Composability comes
// from ADDRESSING, not homing: nothing must be copied into the library to compose
// (a profile that copies project, seat or mission content into the library is a defect —
// Q2-Amendment 1(c)).
import { lstatSync, readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, normalize, relative, sep } from "node:path";
import { parseAddress } from "../markdown-address.js";
import { RECAP_FILENAME } from "./seat-recap-store.js";
export class SourceResolutionError extends Error {
    constructor(message) {
        super(message);
        this.name = "SourceResolutionError";
    }
}
/** The file is genuinely absent under a root that exists: not a dangling link,
 *  not a missing or unconfigured root. Still a resolution failure; only the
 *  composer's post-compaction recap rule treats it differently. */
export class SourceAbsentError extends SourceResolutionError {
    constructor(message) {
        super(message);
        this.name = "SourceAbsentError";
    }
}
/** True for the seat tree's authored recap (`seat:RECAP.md`, any section). */
export function isSeatRecapAddress(address) {
    const { kind, rel } = parseSourceRef(parseAddress(address).ref);
    return kind === "seat" && rel === RECAP_FILENAME;
}
const TREE_KINDS = ["project", "seat", "mission"];
/** Split a pre-`#` ref into its resolver kind + relative path. Fail-loud on an
 *  unknown prefix or a traversal-shaped path — a clean refusal, never an escape
 *  (the r2-B3 precedent from the trace verb). */
export function parseSourceRef(ref) {
    const colon = ref.indexOf(":");
    let kind = "library";
    let rel = ref;
    if (colon >= 0) {
        const prefix = ref.slice(0, colon);
        if (!TREE_KINDS.includes(prefix)) {
            throw new SourceResolutionError(`source ref '${ref}' has unknown kind prefix '${prefix}' — the pre-'#' dialect is bare (library), ${TREE_KINDS.map((k) => `'${k}:'`).join(" or ")}.`);
        }
        kind = prefix;
        rel = ref.slice(colon + 1);
    }
    if (rel.length === 0) {
        throw new SourceResolutionError(`source ref '${ref}' has an empty path after its kind prefix.`);
    }
    const unsafe = isAbsolute(rel) ||
        rel.split(/[\\/]/).some((segment) => segment === ".." || segment === "");
    if (unsafe) {
        throw new SourceResolutionError(`source ref '${ref}' is traversal-shaped (absolute path, '..' or empty segment) — refs stay inside their source root.`);
    }
    return { kind, rel };
}
/** Build the composer's fail-loud readFile over the pack dir + configured tree
 *  roots. Every failure names the source kind and what was being resolved —
 *  a missing root is a MISSING CONFIG error, never a silent empty; a DANGLING
 *  symlink is its own named failure (a realistic corpus state, not a generic
 *  unreadable). Each successful read reports byte provenance via onRead. */
export function makeProfileReadFile(opts) {
    return (ref) => {
        const { kind, rel } = parseSourceRef(ref);
        let base;
        if (kind === "library") {
            base = opts.packDir;
        }
        else {
            const configured = opts.roots[kind];
            if (!configured) {
                throw new SourceResolutionError(`source ref '${ref}' needs the ${kind} tree root, which is not configured for this compose — ` +
                    `tree paths resolve from config, never literals; supply the ${kind} root or drop the ${kind}-homed atom.`);
            }
            base = configured;
        }
        const abs = normalize(join(base, rel));
        let text;
        try {
            text = readFileSync(abs, "utf-8");
        }
        catch (err) {
            // Name the dangling-symlink state precisely: the path EXISTS as a link
            // but its target does not — a generic "unreadable" would send an author
            // hunting for a file that is right there in their listing.
            let dangling = false;
            let absent = false;
            try {
                const stat = lstatSync(abs);
                const code = err.code;
                dangling = stat.isSymbolicLink() && (code === "ENOENT" || code === "ENOTDIR");
            }
            catch (lstatErr) {
                // Genuinely absent only under a root that exists: a missing seat
                // directory is a wrong or unprovisioned root, never an absent file.
                absent = lstatErr.code === "ENOENT" && isDirectory(base);
            }
            const message = dangling
                ? `source ref '${ref}' (${kind}) is a DANGLING symlink: ${abs} exists but its target does not — ${err.message}`
                : `source ref '${ref}' (${kind}) did not resolve: ${abs} is unreadable — ${err.message}`;
            throw absent ? new SourceAbsentError(message) : new SourceResolutionError(message);
        }
        // Provenance AFTER the successful read (r1: realpath on a missing file
        // throws, and that throw must never garble the honest read error above).
        if (opts.onRead) {
            let realPath = abs;
            try {
                realPath = realpathSync(abs);
            }
            catch {
                /* raced away post-read; nominal stands as the best truth available */
            }
            let realBase = base;
            try {
                realBase = realpathSync(base);
            }
            catch {
                /* root itself unresolvable; compare against the nominal base */
            }
            const relFromBase = relative(realBase, realPath);
            // SEGMENT comparison, never a prefix test on a path-shaped string (r1
            // round-3 F1: a file legitimately NAMED '..hidden-notes.md' inside the
            // root satisfied startsWith('..') — the identical class as
            // startsWith(base) saying /seat-evil is inside /seat, one level in).
            const escapesRoot = relFromBase === ".." || relFromBase.startsWith(`..${sep}`) || isAbsolute(relFromBase);
            let writtenAt;
            try {
                writtenAt = statSync(realPath).mtime.toISOString();
            }
            catch {
                /* raced away post-read; the read itself stands */
            }
            opts.onRead({ ref, kind, base, nominalPath: abs, realPath, escapesRoot, ...(writtenAt !== undefined ? { writtenAt } : {}) });
        }
        return text;
    };
}
function isDirectory(path) {
    try {
        return statSync(path).isDirectory();
    }
    catch {
        return false;
    }
}
/** The composer's per-piece source label (Q2-Amendment 1: every assembled piece
 *  is labeled with its source), derived from the atom's full address. */
export function sourceKindForAddress(address) {
    return parseSourceRef(parseAddress(address).ref).kind;
}
//# sourceMappingURL=profile-source-resolver.js.map