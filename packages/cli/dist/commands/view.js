import { Command } from "commander";
import { DaemonClient } from "../client.js";
import { getDaemonStatus, getDaemonUrl, daemonStatusGuard } from "../daemon-lifecycle.js";
import { realDeps } from "./daemon.js";
async function withClient(deps, fn) {
    const status = await getDaemonStatus(deps.lifecycleDeps);
    if (!daemonStatusGuard(status))
        return undefined;
    const client = deps.clientFactory(getDaemonUrl(status));
    return fn(client);
}
function printResult(json, body, status) {
    if (json) {
        console.log(JSON.stringify(body));
    }
    else {
        console.log(JSON.stringify(body, null, 2));
    }
    if (status >= 400)
        process.exitCode = status >= 500 ? 2 : 1;
}
export function viewCommand(depsOverride) {
    const cmd = new Command("view").description("Coordination L5 — daemon-backed views over coordination state");
    const getDeps = () => depsOverride ?? {
        lifecycleDeps: realDeps(),
        clientFactory: (url) => new DaemonClient(url),
    };
    cmd
        .command("list")
        .description("List built-in + custom views")
        .option("--json", "JSON output for agents")
        .action(async (opts) => {
        const deps = getDeps();
        await withClient(deps, async (client) => {
            const res = await client.get("/api/views/list");
            printResult(opts.json ?? false, res.data, res.status);
        });
    });
    cmd
        .command("show <viewName>")
        .description("Run a view (built-in or custom). Built-in views: recently-active, founder, pod-load, escalations, held, activity, pickup")
        .option("--rig <rig>", "Filter by rig name (matches destination_session OR source_session @<rig>)")
        .option("--limit <n>", "Result row limit", "100")
        .option("--mission <id>", "Mission scope for the execution view (defaults to the newest release-* mission)")
        .option("--project <name>", "Project scope for the execution view")
        .option("--json", "JSON output for agents")
        .action(async (viewName, opts) => {
        const deps = getDeps();
        const params = new URLSearchParams();
        if (opts.rig)
            params.set("rig", opts.rig);
        if (opts.limit)
            params.set("limit", opts.limit);
        if (opts.mission)
            params.set("mission", opts.mission);
        if (opts.project)
            params.set("project", opts.project);
        const query = params.toString();
        await withClient(deps, async (client) => {
            const path = `/api/views/${encodeURIComponent(viewName)}${query ? `?${query}` : ""}`;
            const res = await client.get(path);
            printResult(opts.json ?? false, res.data, res.status);
        });
    });
    cmd
        .command("register")
        .description("Register or update a custom view")
        .requiredOption("--name <name>", "Custom view name (must NOT collide with built-in names)")
        .requiredOption("--definition <sql>", "SQL definition (operator-supplied; not validated for taxonomy)")
        .requiredOption("--session <session>", "Registering operator session")
        .option("--json", "JSON output for agents")
        .action(async (opts) => {
        const deps = getDeps();
        await withClient(deps, async (client) => {
            const res = await client.post("/api/views/custom/register", {
                viewName: opts.name,
                definition: opts.definition,
                registeredBySession: opts.session,
            });
            printResult(opts.json ?? false, res.data, res.status);
        });
    });
    return cmd;
}
//# sourceMappingURL=view.js.map