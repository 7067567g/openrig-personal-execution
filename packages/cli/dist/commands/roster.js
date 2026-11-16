import { Command } from "commander";
import { closeSync, constants, fstatSync, openSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { ConfigStore } from "../config-store.js";
const object = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v) => typeof v === "string" && v.trim() ? v : null;
const strings = (v) => Array.isArray(v) && v.every(x => text(x) !== null);
const reference = (v) => object(v) && text(v.seat) !== null && text(v.host) !== null;
/** Select authored fields only: a file cannot supply runtime or observed-model facts. */
export function parseRoster(value) {
    if (!object(value) || value.version !== 1 || !reference(value.curator) ||
        ![value.id, value.name, value.purpose, value.updated_at].every(v => text(v) !== null) || !Array.isArray(value.members)) {
        throw new Error("Expected a version 1 roster with id, name, purpose, curator, updated_at and members");
    }
    const members = value.members.map((m) => {
        if (!reference(m) || !object(m) || !strings(m.capabilities) || !strings(m.engagement) ||
            text(m.use_when) === null || text(m.why) === null || (m.caveat !== undefined && typeof m.caveat !== "string")) {
            throw new Error("Each member needs seat, host, capabilities, engagement, use_when and why (optional caveat)");
        }
        return { seat: m.seat, host: m.host, capabilities: m.capabilities, engagement: m.engagement,
            use_when: m.use_when, why: m.why, ...(m.caveat === undefined ? {} : { caveat: m.caveat }) };
    });
    return { version: 1, id: value.id, name: value.name, purpose: value.purpose,
        curator: { seat: value.curator.seat, host: value.curator.host }, updated_at: value.updated_at, members };
}
export function readRosters(folder) {
    const rosters = [], warnings = [];
    let names;
    try {
        names = readdirSync(folder).filter(n => n.endsWith(".json")).sort();
    }
    catch (error) {
        return { rosters, warnings: [`Cannot read roster folder ${folder}: ${error.message}`] };
    }
    for (const name of names) {
        let fd;
        try {
            // Inspect the opened target before reading; NONBLOCK also handles a FIFO
            // without waiting for a writer. Regular-file symlinks remain readable.
            fd = openSync(join(folder, name), constants.O_RDONLY | constants.O_NONBLOCK);
            if (!fstatSync(fd).isFile())
                throw new Error("Not a regular file; skipped");
            rosters.push(parseRoster(JSON.parse(readFileSync(fd, "utf8"))));
        }
        catch (error) {
            warnings.push(`${name}: ${error.message}`);
        }
        finally {
            if (fd !== undefined)
                closeSync(fd);
        }
    }
    return { rosters, warnings };
}
// Reuse ps's local routing and observation-only HTTP fan-out, including its partial failures.
// Explicit fields keep native transcripts, resume tokens and fresh pane captures out of this read.
const fields = "rigId,logicalId,canonicalSessionName,hostSelfId,runtime,model,sessionStatus,agentActivity";
export async function readRosterInventory() {
    const nodes = [], sources = [];
    for (const remote of [false, true]) {
        const argv = [fileURLToPath(new URL("../index.js", import.meta.url)), "ps", "--no-cleanup", "--nodes", "-A", "--json", "--fields", fields,
            ...(remote ? ["--all-hosts"] : [])];
        const result = await new Promise(done => {
            execFile(process.execPath, argv, { env: { ...process.env, OPENRIG_HOST_SELECTED: "local" },
                timeout: 45_000, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => done({ error, stdout, stderr }));
        });
        const scope = remote ? "registered-hosts" : "configured-daemon";
        try {
            const data = JSON.parse(result.stdout);
            const entries = Array.isArray(data) ? data : object(data) ? data.entries ?? data.items : null;
            if (!Array.isArray(entries))
                throw new Error("ps returned no node array");
            nodes.push(...entries.filter(object));
            sources.push({ scope, status: result.error || result.stderr.trim() ? "partial" : "ok",
                ...(object(data) && Array.isArray(data.hosts) ? { hosts: data.hosts } : {}),
                ...(result.stderr.trim() ? { warning: result.stderr.trim() } : {}),
                ...(result.error ? { error: result.error.message } : {}) });
        }
        catch (error) {
            sources.push({ scope, status: "unavailable", error: result.stderr.trim() || error.message });
        }
    }
    return { readAt: new Date().toISOString(), nodes, sources };
}
export function enrichRosterMember(member, inventory) {
    const matches = inventory.nodes.filter(n => n.hostSelfId === member.host && n.canonicalSessionName === member.seat);
    // Two aliases can query the same host. Collapse repeated identical identity/configuration,
    // but leave conflicting identities or values ambiguous rather than choosing a route's answer.
    const identities = new Set(matches.map(n => JSON.stringify([n.rigId, n.logicalId, n.runtime, n.model, n.sessionStatus])));
    const node = identities.size === 1 ? matches[0] : undefined;
    const sessionStatus = node ? text(node.sessionStatus) : null;
    const current = sessionStatus === "running";
    const activity = current && object(node?.agentActivity) ? node.agentActivity : null;
    return { ...member, live: {
            status: !node ? "unknown" : current ? "reported" : "stale",
            reason: !node ? (matches.length ? "Conflicting node observations" : "No exact hostSelfId and seat match; check observation gaps")
                : current ? "Registry and activity report; not native model verification" : "Seat is not reported running; current runtime and model are unknown",
            runtime: current ? text(node?.runtime) : null,
            configuredModel: current ? text(node?.model) : null,
            observedModel: null,
            sessionStatus,
            agentActivity: { state: text(activity?.state) ?? "unknown", reason: text(activity?.reason), sampledAt: text(activity?.sampledAt) },
        } };
}
export function rosterCommand(deps = {}) {
    const cmd = new Command("roster").description("Find recommended specialists across rigs and hosts (read-only)");
    cmd.addHelpText("after", "\nRosters are recommendations, not assignments or authority. Contact members through rig send or rig queue.\nFiles: <workspace.root>/rosters/*.json; --folder reads another folder without installing it.\nConfigured model is registry data; observed native model remains unknown.\n");
    for (const verb of ["list", "show", "find"]) {
        const sub = cmd.command(verb === "list" ? "list" : `${verb} <${verb === "show" ? "id" : "query"}>`)
            .description(verb === "list" ? "List authored purposes and curators" : verb === "show" ? "Read a roster with current node observations" : "Find a capability or seat across all rosters")
            .option("--folder <path>", "Roster folder (default: workspace.root/rosters)").option("--json", "JSON output");
        sub.action(async (...args) => {
            const query = verb === "list" ? "" : args[0];
            const opts = args[verb === "list" ? 0 : 1];
            const folder = resolve(opts.folder ?? deps.folder?.() ?? join(new ConfigStore().get("workspace.root"), "rosters"));
            const { rosters, warnings } = readRosters(folder);
            let result;
            if (verb === "list") {
                result = { folder, rosters: rosters.map(({ members, ...r }) => ({ ...r, memberCount: members.length })), warnings };
            }
            else {
                const selected = verb === "show" ? rosters.filter(r => r.id === query) : rosters;
                if (verb === "show" && selected.length !== 1) {
                    result = { folder, error: selected.length ? `Ambiguous roster id: ${query}` : `Roster not found: ${query}; use rig roster list`, warnings };
                    process.exitCode = 1;
                }
                else {
                    const inventory = await (deps.inventory ?? readRosterInventory)();
                    const matches = selected.flatMap(r => r.members.filter(m => verb === "show" ||
                        [m.seat, ...m.capabilities].some(s => s.toLowerCase().includes(query.toLowerCase())))
                        .map(m => ({ roster: { id: r.id, name: r.name, purpose: r.purpose, curator: r.curator }, ...enrichRosterMember(m, inventory) })));
                    result = { folder, ...(verb === "show" ? { roster: { ...selected[0], members: matches.map(({ roster: _, ...m }) => m) } } : { query, matches }),
                        observations: { readAt: inventory.readAt, sources: inventory.sources }, warnings };
                }
            }
            if (opts.json)
                console.log(JSON.stringify(result));
            else {
                if (result.error)
                    console.error(result.error);
                else if (verb === "list")
                    for (const r of result.rosters)
                        console.log(`${r.id} — ${r.purpose}\n  Curator: ${r.curator.seat} (${r.curator.host}); ${r.memberCount} members`);
                else {
                    const members = (verb === "show" ? result.roster.members : result.matches);
                    if (verb === "show") {
                        const r = result.roster;
                        console.log(`${r.name} — ${r.purpose}\nCurator: ${r.curator.seat} (${r.curator.host})`);
                    }
                    for (const m of members)
                        console.log(`${m.seat} (${m.host})${m.roster ? ` [${m.roster.id}]` : ""}\n  ${m.engagement.join(", ")}: ${m.capabilities.join(", ")}\n  When: ${m.use_when}\n  Why: ${m.why}${m.caveat ? `\n  Caveat: ${m.caveat}` : ""}\n  ${m.live.status}: runtime ${m.live.runtime ?? "unknown"}; configured model ${m.live.configuredModel ?? "unknown"}; observed model unknown\n  Activity: ${m.live.agentActivity.state}; sampled ${m.live.agentActivity.sampledAt ?? "unknown"}\n  ${m.live.reason}`);
                    if (!members.length)
                        console.log("No matching members.");
                    const obs = result.observations;
                    for (const source of obs.sources)
                        if (source.status !== "ok")
                            console.error(`Observation gap (${source.scope}): ${source.warning ?? source.error ?? source.status}`);
                    console.log("Recommendations only; use rig send or rig queue to contact a member.");
                }
                for (const warning of warnings)
                    console.error(warning);
            }
        });
    }
    return cmd;
}
//# sourceMappingURL=roster.js.map