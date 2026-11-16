// Fork Primitive + Starter Agent Images v0 (PL-016) — library service.
//
// Walks discovery roots, parses each image's manifest.yaml + stats.json,
// and emits AgentImageEntry records for daemon HTTP routes + UI library
// + CLI verb family. Mirrors ContextPackLibraryService (PL-014) in
// shape; differences:
//   - sourceResumeToken passes through to consumers (the instantiator
//     consumes it; the operator-facing surfaces redact it)
//   - stats.json is a separate file (mutable; updated atomically on
//     fork-count increment)
//   - .pinned sentinel file pins an image from prune
//
// Storage filesystem-canonical at ~/.openrig/agent-images/<name>/ +
// workspace-local .openrig/agent-images/<name>/. NO new SQLite tables.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, unlinkSync, rmSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { parseAgentImageManifest } from "./manifest-parser.js";
import { AgentImageError, } from "./agent-image-types.js";
/** Stable id format: agent-image:<name>:<version> (parallel to context-pack:). */
export function agentImageId(name, version) {
    return `agent-image:${name}:${version}`;
}
export function parseAgentImageId(id) {
    if (!id.startsWith("agent-image:"))
        return null;
    const rest = id.slice("agent-image:".length);
    const last = rest.lastIndexOf(":");
    if (last === -1)
        return null;
    return { name: rest.slice(0, last), version: rest.slice(last + 1) };
}
export function estimateTokensFromBytes(bytes) {
    return Math.ceil(bytes / 4);
}
const PINNED_SENTINEL = ".pinned";
const STATS_FILENAME = "stats.json";
const DEFAULT_STATS = {
    forkCount: 0,
    lastUsedAt: null,
    estimatedSizeBytes: 0,
    lineage: [],
};
export class AgentImageLibraryService {
    entries = new Map();
    roots;
    constructor(opts) {
        this.roots = opts.roots;
    }
    getRoots() {
        return this.roots;
    }
    scan() {
        const next = new Map();
        const errors = [];
        for (const root of this.roots) {
            let dirents;
            try {
                dirents = existsSync(root.path)
                    ? readdirSync(root.path, { withFileTypes: true })
                    : [];
            }
            catch {
                continue;
            }
            for (const dirent of dirents) {
                if (!dirent.isDirectory())
                    continue;
                const imageDir = join(root.path, dirent.name);
                const manifestPath = join(imageDir, "manifest.yaml");
                if (!existsSync(manifestPath))
                    continue;
                try {
                    const entry = this.readImageEntry(imageDir, manifestPath, root);
                    // Last-wins on collision (workspace > user_file > builtin in
                    // discovery order configured at startup).
                    next.set(entry.id, entry);
                }
                catch (err) {
                    errors.push({
                        source: imageDir,
                        error: err instanceof AgentImageError ? `${err.code}: ${err.message}` : err.message,
                    });
                }
            }
        }
        this.entries = next;
        return { count: next.size, errors };
    }
    list() {
        return Array.from(this.entries.values()).sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
    }
    get(id) {
        return this.entries.get(id) ?? null;
    }
    getByNameVersion(name, version) {
        return this.entries.get(agentImageId(name, version)) ?? null;
    }
    /**
     * Atomically update stats.json — bump lastUsedAt always; increment
     * forkCount only when `incrementForkCount: true` (default true to
     * preserve back-compat with the first-shipped signature). Used by
     * the instantiator in two phases:
     *   1. Pre-launch (incrementForkCount: false): records the operator's
     *      INTENT to consume the image. lastUsedAt updates so the library
     *      view shows recent activity even when the launch ultimately
     *      fails — operators see "this image was tried" without conflating
     *      attempts with successful forks.
     *   2. Post-launch on success (incrementForkCount: true): increments
     *      forkCount only when startupResult.ok===true. Prior
     *      behavior incremented on intent regardless of outcome, which
     *      polluted forkCount with failed-launch noise.
     *
     * Best-effort: a stat-write failure surfaces as an AgentImageError but
     * does NOT abort the consumer (the image consumption path itself does
     * not depend on stats; the operator just loses fork-count visibility
     * on this consumption).
     *
     * Back-compat: legacy `recordConsumption(id, () => new Date())` form
     * still works — a positional function argument is treated as the
     * `now` clock with `incrementForkCount: true`.
     */
    recordConsumption(id, optsOrNow) {
        const entry = this.entries.get(id);
        if (!entry) {
            throw new AgentImageError("image_not_found", `agent image '${id}' not found in library`);
        }
        const opts = typeof optsOrNow === "function"
            ? { incrementForkCount: true, now: optsOrNow }
            : { incrementForkCount: optsOrNow?.incrementForkCount ?? true, now: optsOrNow?.now ?? (() => new Date()) };
        const statsPath = join(entry.sourcePath, STATS_FILENAME);
        let current = { ...entry.stats };
        try {
            if (existsSync(statsPath)) {
                const raw = readFileSync(statsPath, "utf-8");
                const parsed = JSON.parse(raw);
                current = { ...current, ...parsed };
            }
        }
        catch {
            // Malformed stats.json — fall through with the in-memory copy.
        }
        const next = {
            forkCount: (current.forkCount ?? 0) + (opts.incrementForkCount ? 1 : 0),
            lastUsedAt: opts.now().toISOString(),
            estimatedSizeBytes: current.estimatedSizeBytes ?? entry.stats.estimatedSizeBytes,
            lineage: current.lineage ?? entry.stats.lineage,
        };
        try {
            writeFileSync(statsPath, JSON.stringify(next, null, 2) + "\n", "utf-8");
        }
        catch (err) {
            throw new AgentImageError("stats_write_failed", `failed to update stats.json for ${id}: ${err.message}`, { id, statsPath });
        }
        // Mirror the new stats into the in-memory entry so subsequent reads
        // see the bumped fork-count without re-walking the filesystem.
        entry.stats = next;
    }
    /** Pin an image — creates a `.pinned` sentinel file inside the image directory. */
    pin(id) {
        const entry = this.entries.get(id);
        if (!entry)
            throw new AgentImageError("image_not_found", `agent image '${id}' not found`);
        const sentinelPath = join(entry.sourcePath, PINNED_SENTINEL);
        writeFileSync(sentinelPath, new Date().toISOString() + "\n", "utf-8");
        entry.pinned = true;
    }
    /** Unpin — removes the `.pinned` sentinel. */
    unpin(id) {
        const entry = this.entries.get(id);
        if (!entry)
            throw new AgentImageError("image_not_found", `agent image '${id}' not found`);
        const sentinelPath = join(entry.sourcePath, PINNED_SENTINEL);
        try {
            unlinkSync(sentinelPath);
        }
        catch {
            // Already absent — no-op.
        }
        entry.pinned = false;
    }
    readImageEntry(imageDir, manifestPath, root) {
        const raw = readFileSync(manifestPath, "utf-8");
        const manifest = parseAgentImageManifest(raw, manifestPath);
        let mostRecentMtime = 0;
        let totalBytes = 0;
        try {
            const st = statSync(manifestPath);
            mostRecentMtime = st.mtimeMs;
            totalBytes += st.size;
        }
        catch { /* unreadable — fall through */ }
        const files = manifest.files.map((mf) => {
            const abs = join(imageDir, mf.path);
            let bytes = null;
            let mtime = 0;
            try {
                const st = statSync(abs);
                bytes = st.size;
                mtime = st.mtimeMs;
                totalBytes += bytes;
            }
            catch {
                bytes = null;
            }
            if (mtime > mostRecentMtime)
                mostRecentMtime = mtime;
            return {
                path: mf.path,
                role: mf.role,
                summary: mf.summary ?? null,
                absolutePath: bytes === null ? null : abs,
                bytes,
                estimatedTokens: bytes === null ? null : estimateTokensFromBytes(bytes),
            };
        });
        const derivedEstimatedTokens = files.reduce((acc, f) => acc + (f.estimatedTokens ?? 0), 0);
        // Read stats.json if present; default to empty stats.
        const statsPath = join(imageDir, STATS_FILENAME);
        let stats = { ...DEFAULT_STATS };
        if (existsSync(statsPath)) {
            try {
                const statRaw = readFileSync(statsPath, "utf-8");
                const parsed = JSON.parse(statRaw);
                stats = {
                    forkCount: typeof parsed.forkCount === "number" ? parsed.forkCount : 0,
                    lastUsedAt: typeof parsed.lastUsedAt === "string" ? parsed.lastUsedAt : null,
                    estimatedSizeBytes: typeof parsed.estimatedSizeBytes === "number" ? parsed.estimatedSizeBytes : totalBytes,
                    lineage: Array.isArray(parsed.lineage) ? parsed.lineage.filter((l) => typeof l === "string") : [],
                };
                const statStat = statSync(statsPath).mtimeMs;
                if (statStat > mostRecentMtime)
                    mostRecentMtime = statStat;
            }
            catch {
                // Malformed stats — surface zero values; the daemon refresh
                // overwrites on next consumption.
            }
        }
        if (stats.estimatedSizeBytes === 0)
            stats.estimatedSizeBytes = totalBytes;
        if (stats.lineage.length === 0 && manifest.lineage)
            stats.lineage = [...manifest.lineage];
        const pinned = existsSync(join(imageDir, PINNED_SENTINEL));
        return {
            id: agentImageId(manifest.name, manifest.version),
            kind: "agent-image",
            name: manifest.name,
            version: manifest.version,
            runtime: manifest.runtime,
            sourceSeat: manifest.sourceSeat,
            sourceSessionId: manifest.sourceSessionId,
            sourceResumeToken: manifest.sourceResumeToken,
            // Surface sourceCwd verbatim from the manifest.
            // null when the manifest predates source_cwd support (back-compat).
            sourceCwd: manifest.sourceCwd ?? null,
            notes: manifest.notes ?? null,
            createdAt: manifest.createdAt,
            sourceType: root.sourceType,
            sourcePath: imageDir,
            relativePath: relative(root.path, imageDir) || ".",
            updatedAt: new Date(mostRecentMtime || Date.now()).toISOString(),
            manifestEstimatedTokens: typeof manifest.estimatedTokens === "number" ? manifest.estimatedTokens : null,
            derivedEstimatedTokens,
            files,
            stats,
            lineage: stats.lineage,
            pinned,
        };
    }
    /** Write a fresh manifest + empty stats.json + cwd-deltas (if any) to a new image directory. */
    install(targetRootPath, manifest, fileContents) {
        const targetDir = join(targetRootPath, manifest.name);
        if (existsSync(targetDir)) {
            throw new AgentImageError("image_referenced", `agent image directory already exists at ${targetDir}; choose a different name or remove the existing dir`, { name: manifest.name, targetDir });
        }
        for (const relPath of fileContents.keys()) {
            if (relPath.includes("..") || relPath.startsWith("/")) {
                throw new AgentImageError("manifest_invalid", `install file path '${relPath}' must be relative inside the image (no '..', no leading '/')`);
            }
        }
        mkdirSync(dirname(targetDir), { recursive: true });
        // Exclusively create the target so failure cleanup owns only this attempt.
        try {
            mkdirSync(targetDir);
        }
        catch (error) {
            if (error.code !== "EEXIST")
                throw error;
            throw new AgentImageError("image_referenced", `agent image directory already exists at ${targetDir}; choose a different name or remove the existing dir`, { name: manifest.name, targetDir });
        }
        let installed = false;
        try {
            // Emit manifest as YAML — write camelCase keys mapped to snake_case
            // for forward-compat with operator hand-edits.
            const yamlLines = [
                `name: ${quoteYamlString(manifest.name)}`,
                `version: ${quoteYamlString(manifest.version)}`,
                `runtime: ${quoteYamlString(manifest.runtime)}`,
                `source_seat: ${quoteYamlString(manifest.sourceSeat)}`,
                `source_session_id: ${quoteYamlString(manifest.sourceSessionId)}`,
                `source_resume_token: ${quoteYamlString(manifest.sourceResumeToken)}`,
                `created_at: ${quoteYamlString(manifest.createdAt)}`,
            ];
            // Persist sourceCwd to manifest YAML so the
            // Use-as-starter snippet can emit `cwd: <source_cwd>` from the
            // library entry. Omitted when capture-time cwd was unknown.
            if (manifest.sourceCwd) {
                yamlLines.push(`source_cwd: ${quoteYamlString(manifest.sourceCwd)}`);
            }
            if (manifest.notes !== undefined) {
                yamlLines.push(`notes: ${quoteYamlString(manifest.notes)}`);
            }
            if (typeof manifest.estimatedTokens === "number")
                yamlLines.push(`estimated_tokens: ${manifest.estimatedTokens}`);
            if (manifest.lineage && manifest.lineage.length > 0) {
                yamlLines.push("lineage:");
                for (const l of manifest.lineage)
                    yamlLines.push(`  - ${quoteYamlString(l)}`);
            }
            yamlLines.push("files:");
            for (const f of manifest.files) {
                yamlLines.push(`  - path: ${quoteYamlString(f.path)}`);
                yamlLines.push(`    role: ${quoteYamlString(f.role)}`);
                if (f.summary)
                    yamlLines.push(`    summary: ${quoteYamlString(f.summary)}`);
            }
            // Empty stats — fork count starts at 0; lineage from manifest.
            const stats = {
                forkCount: 0,
                lastUsedAt: null,
                estimatedSizeBytes: 0,
                lineage: manifest.lineage ? [...manifest.lineage] : [],
            };
            writeFileSync(join(targetDir, STATS_FILENAME), JSON.stringify(stats, null, 2) + "\n", "utf-8");
            for (const [relPath, content] of fileContents) {
                const abs = join(targetDir, relPath);
                mkdirSync(join(abs, ".."), { recursive: true });
                writeFileSync(abs, content, "utf-8");
            }
            // The scanner's discovery marker is published only after every member.
            writeFileSync(join(targetDir, "manifest.yaml"), yamlLines.join("\n") + "\n", "utf-8");
            installed = true;
            return targetDir;
        }
        finally {
            if (!installed) {
                try {
                    rmSync(targetDir, { recursive: true, force: true });
                }
                catch { /* preserve the write error */ }
            }
        }
    }
}
function quoteYamlString(s) {
    // JSON string literals are valid YAML scalars and prevent implicit coercion.
    return JSON.stringify(s);
}
//# sourceMappingURL=agent-image-library-service.js.map