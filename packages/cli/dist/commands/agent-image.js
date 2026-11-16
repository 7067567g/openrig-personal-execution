// Fork Primitive + Starter Agent Images v0 (PL-016) — `rig agent-image`
// CLI verb family. Parallel to `rig context` (the context-pack library,
// shipped in PL-014; grammar renamed from `rig context-pack` in Atom-7).
//
// Subcommands:
//   create   <source-session> --name <name>     — capture image from a live seat
//   list                                         — list all images
//   show     <name-or-id>                        — manifest + stats
//   preview  <name-or-id>                        — assembled preview + starter snippet
//   delete   <name-or-id> [--force]              — delete (subject to evidence guard)
//   pin      <name-or-id>                        — pin from prune
//   unpin    <name-or-id>                        — unpin
//   prune    [--force] [--dry-run] [--json]      — bulk delete evictable images
//   sync                                         — re-walk discovery roots
import { Command } from "commander";
import { DaemonClient } from "../client.js";
import { getDaemonStatus, getDaemonUrl, statusGuardMessage } from "../daemon-lifecycle.js";
import { realDeps } from "./daemon.js";
async function resolveImage(client, nameOrId) {
    if (nameOrId.startsWith("agent-image:")) {
        const res = await client.get(`/api/agent-images/library/${encodeURIComponent(nameOrId)}`);
        if (res.status === 200)
            return res.data;
        if (res.status === 404)
            throw new Error(`Agent image '${nameOrId}' not found in library. Run 'rig agent-image list' to see what's installed.`);
        throw new Error(`Daemon returned HTTP ${res.status} for /api/agent-images/library/${nameOrId}`);
    }
    const res = await client.get("/api/agent-images/library");
    if (res.status !== 200)
        throw new Error(`Daemon returned HTTP ${res.status} for /api/agent-images/library`);
    const matches = (res.data ?? []).filter((e) => e.name === nameOrId);
    if (matches.length === 0) {
        throw new Error(`Agent image '${nameOrId}' not found in library. Run 'rig agent-image list' to see what's installed.`);
    }
    if (matches.length > 1) {
        const versions = matches.map((m) => m.version).join(", ");
        throw new Error(`Agent image '${nameOrId}' is ambiguous (versions: ${versions}). Use 'agent-image:${nameOrId}:<version>'.`);
    }
    return matches[0];
}
export function agentImageCommand(depsOverride) {
    const cmd = new Command("agent-image")
        .description("Browse, snapshot, and manage agent images (PL-016)")
        .addHelpText("after", `
Examples:
  rig agent-image list
  rig agent-image show driver-release-primed
  rig agent-image create dev-build@starter --name driver-release-primed --notes "after review"
  rig agent-image preview driver-release-primed
  rig agent-image pin driver-release-primed
  rig agent-image prune --dry-run
  rig agent-image delete driver-release-primed --force
`);
    const getDeps = () => depsOverride ?? {
        lifecycleDeps: realDeps(),
        clientFactory: (url) => new DaemonClient(url),
    };
    async function getClient() {
        const deps = getDeps();
        const status = await getDaemonStatus(deps.lifecycleDeps);
        if (status.state !== "running" || status.healthy === false) {
            // B8-1b: epistemic-matched language via the one helper (down ≠ busy).
            const gm = statusGuardMessage(status);
            throw new Error(`${gm.fact} ${gm.action}`);
        }
        return deps.clientFactory(getDaemonUrl(status));
    }
    cmd.command("list")
        .description("List all agent images in the library")
        .option("--runtime <runtime>", "Filter by runtime (claude-code | codex)")
        .option("--json", "JSON output")
        .action(async (opts) => {
        try {
            const client = await getClient();
            const res = await client.get("/api/agent-images/library");
            if (res.status !== 200)
                throw new Error(`Daemon returned HTTP ${res.status}`);
            let entries = res.data ?? [];
            if (opts.runtime)
                entries = entries.filter((e) => e.runtime === opts.runtime);
            if (opts.json) {
                console.log(JSON.stringify(entries, null, 2));
                return;
            }
            if (entries.length === 0) {
                console.log("No agent images. Capture one with: rig agent-image create <source-session> --name <name>");
                return;
            }
            for (const e of entries) {
                const pinned = e.pinned ? " 📌" : "";
                console.log(`${e.name.padEnd(28)} v${String(e.version).padEnd(6)} ${e.runtime.padEnd(12)} forks: ${String(e.stats.forkCount).padStart(3)}  ~${String(e.derivedEstimatedTokens).padStart(6)} tokens  ${e.sourceType}${pinned}`);
            }
        }
        catch (err) {
            console.error(err.message);
            process.exitCode = 1;
        }
    });
    cmd.command("show")
        .argument("<name-or-id>", "Image name or library id")
        .option("--json", "JSON output")
        .description("Show image manifest + statistics")
        .action(async (nameOrId, opts) => {
        try {
            const client = await getClient();
            const entry = await resolveImage(client, nameOrId);
            if (opts.json) {
                console.log(JSON.stringify(entry, null, 2));
                return;
            }
            console.log(`Name:        ${entry.name}`);
            console.log(`Version:     ${entry.version}`);
            console.log(`Runtime:     ${entry.runtime}`);
            console.log(`Source:      ${entry.sourceSeat}`);
            console.log(`Created:     ${entry.createdAt}`);
            console.log(`Path:        ${entry.sourcePath}`);
            console.log(`Tokens (~):  ${entry.derivedEstimatedTokens}${entry.manifestEstimatedTokens !== null ? ` (manifest: ${entry.manifestEstimatedTokens})` : ""}`);
            console.log(`Pinned:      ${entry.pinned}`);
            console.log("");
            console.log(`Stats:`);
            console.log(`  fork count:        ${entry.stats.forkCount}`);
            console.log(`  last used:         ${entry.stats.lastUsedAt ?? "never"}`);
            console.log(`  estimated size:    ${entry.stats.estimatedSizeBytes} bytes`);
            console.log(`  lineage:           ${entry.lineage.length === 0 ? "(none)" : entry.lineage.join(" → ")}`);
            if (entry.notes) {
                console.log("");
                console.log("Notes:");
                console.log(`  ${entry.notes.replaceAll("\n", "\n  ")}`);
            }
        }
        catch (err) {
            console.error(err.message);
            process.exitCode = 1;
        }
    });
    cmd.command("preview")
        .argument("<name-or-id>", "Image name or library id")
        .option("--json", "JSON output")
        .description("Show manifest + sized supplementary file metadata + starter snippet")
        .action(async (nameOrId, opts) => {
        try {
            const client = await getClient();
            const entry = await resolveImage(client, nameOrId);
            const res = await client.get(`/api/agent-images/library/${encodeURIComponent(entry.id)}/preview`);
            if (res.status !== 200)
                throw new Error(`Daemon returned HTTP ${res.status}`);
            const preview = res.data;
            if (opts.json) {
                console.log(JSON.stringify(preview, null, 2));
                return;
            }
            console.log(`# Preview: ${preview.name} v${preview.version} (${preview.runtime})`);
            console.log(`# Source seat: ${preview.sourceSeat}`);
            console.log(`# Stats: fork=${preview.stats.forkCount}, last-used=${preview.stats.lastUsedAt ?? "never"}, size=${preview.stats.estimatedSizeBytes}B`);
            if (preview.lineage.length > 0)
                console.log(`# Lineage: ${preview.lineage.join(" → ")}`);
            console.log("");
            console.log("# Starter snippet (paste into agent.yaml):");
            console.log(preview.starterSnippet);
        }
        catch (err) {
            console.error(err.message);
            process.exitCode = 1;
        }
    });
    cmd.command("create")
        .argument("<source-session>", "Source session canonical name (e.g., dev-build@starter)")
        .description("Capture a productive seat's resumable state into a new agent image")
        .requiredOption("--name <name>", "Image name (used as the directory name and library id)")
        // Use --image-version instead of --version because Commander.js
        // intercepts the global --version flag (prints CLI version + exits
        // 0 silently). Per-command name resolves the collision without
        // losing the global --version surface.
        .option("--image-version <version>", "Image version (default: 1)")
        .option("--notes <text>", "Operator-supplied notes preserved in manifest")
        .option("--estimated-tokens <n>", "Operator-supplied token estimate")
        .option("--lineage <names...>", "Comma-separated parent image names if forking from another image")
        .option("--json", "JSON output")
        .action(async (sourceSession, opts) => {
        try {
            const client = await getClient();
            const body = {
                sourceSession,
                name: opts.name,
            };
            if (opts.imageVersion)
                body["version"] = opts.imageVersion;
            if (opts.notes)
                body["notes"] = opts.notes;
            if (opts.estimatedTokens) {
                const n = Number(opts.estimatedTokens);
                if (Number.isFinite(n))
                    body["estimatedTokens"] = n;
            }
            if (opts.lineage && opts.lineage.length > 0)
                body["lineage"] = opts.lineage;
            const res = await client.post("/api/agent-images/snapshot", body);
            if (res.status !== 200) {
                const data = res.data;
                throw new Error(data.message ?? data.error ?? `Daemon returned HTTP ${res.status}`);
            }
            const r = res.data;
            if (opts.json) {
                console.log(JSON.stringify(r, null, 2));
                return;
            }
            console.log(`Captured ${r.manifest.name} v${r.manifest.version} (${r.manifest.runtime}) at ${r.imagePath}`);
        }
        catch (err) {
            console.error(err.message);
            process.exitCode = 1;
        }
    });
    cmd.command("delete")
        .argument("<name-or-id>", "Image name or library id")
        .option("--force", "Override evidence-preservation guard (CATASTROPHIC if active references exist)")
        .option("--json", "JSON output")
        .description("Delete an agent image (subject to evidence-preservation guard)")
        .action(async (nameOrId, opts) => {
        try {
            const client = await getClient();
            const entry = await resolveImage(client, nameOrId);
            const url = `/api/agent-images/library/${encodeURIComponent(entry.id)}${opts.force ? "?force=true" : ""}`;
            const res = await client.delete(url);
            if (res.status !== 200) {
                const data = res.data;
                throw new Error(data.message ?? data.error ?? `Daemon returned HTTP ${res.status}`);
            }
            if (opts.json) {
                console.log(JSON.stringify(res.data, null, 2));
                return;
            }
            console.log(`Deleted ${entry.id}${opts.force ? " (forced)" : ""}.`);
        }
        catch (err) {
            console.error(err.message);
            process.exitCode = 1;
        }
    });
    cmd.command("pin")
        .argument("<name-or-id>", "Image name or library id")
        .option("--json", "JSON output")
        .description("Pin an image so prune cannot delete it")
        .action(async (nameOrId, opts) => {
        try {
            const client = await getClient();
            const entry = await resolveImage(client, nameOrId);
            const res = await client.post(`/api/agent-images/library/${encodeURIComponent(entry.id)}/pin`);
            if (res.status !== 200)
                throw new Error(`Daemon returned HTTP ${res.status}`);
            if (opts.json)
                console.log(JSON.stringify(res.data, null, 2));
            else
                console.log(`Pinned ${entry.id}.`);
        }
        catch (err) {
            console.error(err.message);
            process.exitCode = 1;
        }
    });
    cmd.command("unpin")
        .argument("<name-or-id>", "Image name or library id")
        .option("--json", "JSON output")
        .description("Unpin an image")
        .action(async (nameOrId, opts) => {
        try {
            const client = await getClient();
            const entry = await resolveImage(client, nameOrId);
            const res = await client.post(`/api/agent-images/library/${encodeURIComponent(entry.id)}/unpin`);
            if (res.status !== 200)
                throw new Error(`Daemon returned HTTP ${res.status}`);
            if (opts.json)
                console.log(JSON.stringify(res.data, null, 2));
            else
                console.log(`Unpinned ${entry.id}.`);
        }
        catch (err) {
            console.error(err.message);
            process.exitCode = 1;
        }
    });
    cmd.command("prune")
        .option("--dry-run", "Preview without deleting (default if not --force)")
        .option("--force", "Override evidence-preservation guard (CATASTROPHIC: deletes referenced images)")
        .option("--json", "JSON output")
        .description("Delete evictable images (protected by evidence-preservation guard)")
        .action(async (opts) => {
        try {
            const client = await getClient();
            const dryRun = opts.dryRun !== false && !opts.force;
            const res = await client.post("/api/agent-images/prune", {
                dryRun,
                force: !!opts.force,
            });
            if (res.status !== 200)
                throw new Error(`Daemon returned HTTP ${res.status}`);
            if (opts.json) {
                console.log(JSON.stringify(res.data, null, 2));
                return;
            }
            const r = res.data;
            if (r.dryRun) {
                const protectedList = r.protected ?? [];
                const evictable = r.evictable ?? [];
                console.log(`(dry-run) ${protectedList.length} protected, ${evictable.length} evictable`);
                if (protectedList.length > 0) {
                    console.log("");
                    console.log("Protected:");
                    for (const p of protectedList) {
                        console.log(`  ${p.imageName} v${p.imageVersion}: ${p.reasons.join(", ")}`);
                        for (const ref of p.references)
                            console.log(`    ↪ ${ref}`);
                    }
                }
                if (evictable.length > 0) {
                    console.log("");
                    console.log("Evictable:");
                    for (const e of evictable)
                        console.log(`  ${e.imageName} v${e.imageVersion}`);
                }
            }
            else {
                console.log(`Deleted ${(r.deleted ?? []).length} image(s).${r.forced ? " (forced)" : ""}`);
                for (const err of r.errors ?? [])
                    console.log(`  error: ${err.imageId}: ${err.error}`);
            }
        }
        catch (err) {
            console.error(err.message);
            process.exitCode = 1;
        }
    });
    cmd.command("sync")
        .option("--json", "JSON output")
        .description("Re-walk discovery roots and refresh the library index")
        .action(async (opts) => {
        try {
            const client = await getClient();
            const res = await client.post("/api/agent-images/library/sync");
            if (res.status !== 200)
                throw new Error(`Daemon returned HTTP ${res.status}`);
            if (opts.json) {
                console.log(JSON.stringify(res.data, null, 2));
                return;
            }
            console.log(`Indexed ${res.data.count} agent image(s).`);
            for (const e of res.data.errors)
                console.log(`  error: ${e.source}: ${e.error}`);
        }
        catch (err) {
            console.error(err.message);
            process.exitCode = 1;
        }
    });
    return cmd;
}
//# sourceMappingURL=agent-image.js.map