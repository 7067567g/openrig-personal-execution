// PL-004 Phase C R1: shared artifact-pool helpers (TypeScript port of
// POC `lib/policies/artifact-pool.js`).
//
// R1 fix (guard blocker 3): full POC parity for the scanner. The
// artifact-pool-ready and edge-artifact-required policies depend on:
//   - Default ignores: README.md and .DS_Store always excluded.
//   - Configured ignore_names: per-pool extra exclusions.
//   - Recursive scan when pool.recursive=true.
//   - Malformed-frontmatter exclusion unless pool.include_malformed_frontmatter.
//   - Raw content preserved on every artifact (used by edge-artifact-required
//     for body-reference target satisfaction).
//   - Missing pool path returns empty (ENOENT-tolerant).
//
// Pure filesystem scanner; no event-bus, no DB, no Hono.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { parse as parseYaml } from "yaml";
const DEFAULT_EXTENSIONS = [".md"];
const DEFAULT_IGNORE_NAMES = ["README.md", ".DS_Store"];
const FRONTMATTER_OPEN = "---\n";
/**
 * Parse top-level YAML frontmatter from a markdown-style document.
 * Returns { raw, frontmatter, parseError } so callers can decide whether
 * to include malformed artifacts.
 *
 * R2 fix (guard blocker 2): use the `yaml` package (already a daemon
 * dep) rather than a local key/value parser. Mirrors POC's
 * `lib/policies/artifact-pool.js:21-30` which delegates to the shared
 * YAML loader. Valid YAML scalars containing colons (ISO timestamps,
 * URLs) parse cleanly. Only true YAML parse failures (e.g.,
 * `broken: value: still broken` which is genuinely invalid YAML) cause
 * exclusion when `include_malformed_frontmatter` is unset.
 */
function readFrontmatter(filePath) {
    const raw = readFileSync(filePath, "utf-8");
    // Accept CRLF files and a closing `---` at end of file, like frontmatter-validator.
    const text = raw.replace(/\r\n/g, "\n");
    if (!text.startsWith(FRONTMATTER_OPEN)) {
        return { raw, frontmatter: {}, frontmatter_parse_error: null };
    }
    const close = /\n---(?:\n|$)/.exec(text.slice(FRONTMATTER_OPEN.length - 1));
    if (!close) {
        return { raw, frontmatter: {}, frontmatter_parse_error: null };
    }
    const block = text.slice(FRONTMATTER_OPEN.length, FRONTMATTER_OPEN.length - 1 + close.index);
    let parsed;
    try {
        parsed = parseYaml(block);
    }
    catch (err) {
        return {
            raw,
            frontmatter: {},
            frontmatter_parse_error: err instanceof Error ? err.message : "frontmatter parse error",
        };
    }
    // YAML parsed but produced a non-object root (string, array, null) —
    // treat as empty frontmatter, NOT a parse error. Matches POC behavior
    // (lib/policies/artifact-pool.js:35-38): non-object root yields {}.
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { raw, frontmatter: {}, frontmatter_parse_error: null };
    }
    return {
        raw,
        frontmatter: parsed,
        frontmatter_parse_error: null,
    };
}
function listFiles(rootDir, recursive) {
    let entries;
    try {
        entries = readdirSync(rootDir, { withFileTypes: true });
    }
    catch (err) {
        if (err.code === "ENOENT")
            return [];
        throw err;
    }
    const out = [];
    for (const entry of entries) {
        const full = join(rootDir, entry.name);
        if (entry.isDirectory()) {
            if (recursive)
                out.push(...listFiles(full, recursive));
            continue;
        }
        if (entry.isFile())
            out.push(full);
    }
    return out.sort((a, b) => a.localeCompare(b));
}
function shouldIncludeFile(filePath, pool) {
    const name = basename(filePath);
    const ignoreNames = new Set([
        ...DEFAULT_IGNORE_NAMES,
        ...(Array.isArray(pool.ignore_names) ? pool.ignore_names : []),
    ]);
    if (ignoreNames.has(name))
        return false;
    const exts = Array.isArray(pool.extensions) ? pool.extensions : DEFAULT_EXTENSIONS;
    return exts.some((e) => name.endsWith(e));
}
function statusAllowed(status, pool) {
    const include = pool.include_statuses;
    if (!Array.isArray(include) || include.length === 0)
        return true;
    return status !== null && include.includes(status);
}
/**
 * Coerce a YAML-parsed frontmatter status field to a comparable string.
 * YAML loaders may parse unquoted statuses as identifiers (string),
 * but a status like `2026-05-03` would parse as Date. We coerce to ISO
 * for non-string scalars so include_statuses comparisons remain stable.
 */
function statusFromFrontmatter(fm) {
    const v = fm.status;
    if (v === undefined || v === null)
        return null;
    if (typeof v === "string")
        return v;
    if (v instanceof Date)
        return v.toISOString();
    return String(v);
}
/**
 * Scan one or more artifact pools per spec(s). Mirrors POC
 * `scanArtifactPools(pools)`. Returns the flat union of matches across
 * all pools, sorted by absolute path. Missing pools yield empty.
 *
 * Throws if `pools` is undefined / empty / shapeless — POC contract:
 * the policy spec MUST declare at least one pool.
 */
export async function scanArtifactPools(pools) {
    const expanded = expandPools(pools);
    if (expanded.length === 0) {
        throw new Error("artifact pool policy: context pool list is required");
    }
    const out = [];
    for (const pool of expanded) {
        if (!pool.path) {
            throw new Error("artifact pool policy: every pool requires a path");
        }
        const files = listFiles(pool.path, Boolean(pool.recursive));
        for (const filePath of files) {
            if (!shouldIncludeFile(filePath, pool))
                continue;
            let st;
            try {
                st = statSync(filePath);
            }
            catch {
                continue;
            }
            if (!st.isFile())
                continue;
            let parsed;
            try {
                parsed = readFrontmatter(filePath);
            }
            catch {
                continue;
            }
            if (parsed.frontmatter_parse_error && !pool.include_malformed_frontmatter) {
                continue;
            }
            const status = statusFromFrontmatter(parsed.frontmatter);
            if (!statusAllowed(status, pool))
                continue;
            out.push({
                path: filePath,
                pool_path: pool.path,
                raw: parsed.raw,
                frontmatter: parsed.frontmatter,
                frontmatter_parse_error: parsed.frontmatter_parse_error,
                status,
            });
        }
    }
    return out.sort((a, b) => a.path.localeCompare(b.path));
}
/**
 * Expand the convenience input shape (single object, array of objects,
 * or `paths: [...]` shorthand) into a flat array of single-path pools.
 */
function expandPools(pools) {
    if (!pools)
        return [];
    const list = Array.isArray(pools) ? pools : [pools];
    const out = [];
    for (const spec of list) {
        if (spec.path) {
            out.push(spec);
        }
        else if (Array.isArray(spec.paths)) {
            for (const p of spec.paths)
                out.push({ ...spec, path: p, paths: undefined });
        }
    }
    return out;
}
/**
 * Format an artifact list as bullet lines. Mirrors POC formatArtifactList:
 * `- /full/absolute/path`. The POC favors the full path so receivers can
 * cd / open / cat the artifact directly without further lookup.
 */
export function formatArtifactList(artifacts, maxItems) {
    return artifacts
        .slice(0, maxItems)
        .map((a) => `- ${a.path}`)
        .join("\n");
}
/**
 * Compute the source-key for an artifact. Mirrors POC sourceKeyFor:
 * prefer frontmatter[keyField], else basename sans .md extension.
 * Coerces non-string scalars (Date, number) to string for comparison.
 */
export function sourceKeyFor(artifact, keyField) {
    const value = artifact.frontmatter[keyField];
    if (value === undefined || value === null || value === "") {
        return basename(artifact.path).replace(/\.md$/, "");
    }
    if (typeof value === "string")
        return value;
    if (value instanceof Date)
        return value.toISOString();
    return String(value);
}
//# sourceMappingURL=artifact-pool-helpers.js.map