import { Command } from "commander";
import { DaemonClient } from "../client.js";
import { getDaemonStatus, getDaemonUrl, daemonStatusGuard } from "../daemon-lifecycle.js";
import { realDeps } from "./daemon.js";
const LONG_RUNNING_TIMEOUT_MS = 45_000;
export function envCommand(depsOverride) {
    const cmd = new Command("env")
        .description("Inspect and control rig environment services for service-backed rigs and managed apps")
        .addHelpText("after", `
Examples:
  rig env status secrets-manager
  rig env logs secrets-manager vault
  rig env down secrets-manager
`);
    const getDeps = () => depsOverride ?? { lifecycleDeps: realDeps(), clientFactory: (url) => new DaemonClient(url) };
    async function getClient(deps) {
        const status = await getDaemonStatus(deps.lifecycleDeps);
        if (!daemonStatusGuard(status))
            return null;
        return deps.clientFactory(getDaemonUrl(status));
    }
    async function resolveRigId(client, rigRef) {
        const summaries = await client.get("/api/rigs/summary");
        if (summaries.status >= 400) {
            const error = !Array.isArray(summaries.data) ? summaries.data?.error : undefined;
            throw new Error(error ?? `Failed to list rigs (HTTP ${summaries.status})`);
        }
        if (!Array.isArray(summaries.data))
            throw new Error("The daemon returned an invalid rig summary.");
        const match = summaries.data.find((r) => r.name === rigRef || r.id === rigRef);
        if (!match)
            throw new Error(`Rig '${rigRef}' not found`);
        return match.id;
    }
    // rig env status <rig>
    cmd
        .command("status")
        .argument("<rig>", "Rig name or ID")
        .option("--json", "JSON output")
        .action(async (rig, opts) => {
        const deps = getDeps();
        const client = await getClient(deps);
        if (!client) {
            process.exitCode = 1;
            return;
        }
        let rigId;
        try {
            rigId = await resolveRigId(client, rig);
        }
        catch (err) {
            console.error(err.message);
            process.exitCode = 1;
            return;
        }
        const res = await client.get(`/api/rigs/${encodeURIComponent(rigId)}/env`);
        if (res.status >= 400) {
            if (opts.json)
                console.log(JSON.stringify(res.data, null, 2));
            else
                console.error(res.data?.["error"] ?? `Failed to get service status (HTTP ${res.status})`);
            process.exitCode = res.status >= 500 ? 2 : 1;
            return;
        }
        if (opts.json) {
            console.log(JSON.stringify(res.data, null, 2));
            return;
        }
        if (!res.data["hasServices"]) {
            console.log("No services configured for this rig.");
            return;
        }
        const receipt = res.data["receipt"];
        const probeStatus = res.data["probeStatus"];
        if (probeStatus === "stale" || probeStatus === "no_orchestrator") {
            const probeError = res.data["probeError"];
            console.error(`Service status is ${probeStatus === "stale" ? "stale" : "unverified"} (probe: ${probeStatus}); ${receipt ? "showing the saved receipt" : "no saved receipt is available"}.${typeof probeError === "string" && probeError ? ` ${probeError}` : ""}`);
        }
        if (!receipt) {
            console.log("Services configured but no receipt available yet.");
            return;
        }
        console.log(`Env: ${res.data["kind"]} (${res.data["projectName"]})`);
        const services = receipt["services"];
        if (services) {
            for (const svc of services) {
                const health = svc.health ? ` (${svc.health})` : "";
                console.log(`  ${svc.name}: ${svc.status}${health}`);
            }
        }
    });
    // rig env logs <rig> [service]
    cmd
        .command("logs")
        .argument("<rig>", "Rig name or ID")
        .argument("[service]", "Specific service name")
        .option("--tail <n>", "Number of lines", "100")
        .action(async (rig, service, opts) => {
        const deps = getDeps();
        const client = await getClient(deps);
        if (!client) {
            process.exitCode = 1;
            return;
        }
        let rigId;
        try {
            rigId = await resolveRigId(client, rig);
        }
        catch (err) {
            console.error(err.message);
            process.exitCode = 1;
            return;
        }
        const params = new URLSearchParams({ tail: opts.tail });
        if (service)
            params.set("service", service);
        const res = await client.get(`/api/rigs/${encodeURIComponent(rigId)}/env/logs?${params}`);
        if (res.status >= 400 || !res.data.ok) {
            console.error(res.data.error ?? `Failed to get logs (HTTP ${res.status})`);
            process.exitCode = 1;
            return;
        }
        console.log(res.data.output ?? "");
    });
    // rig env down <rig> [--volumes]
    cmd
        .command("down")
        .argument("<rig>", "Rig name or ID")
        .option("--volumes", "Also remove volumes")
        .action(async (rig, opts) => {
        const deps = getDeps();
        const client = await getClient(deps);
        if (!client) {
            process.exitCode = 1;
            return;
        }
        let rigId;
        try {
            rigId = await resolveRigId(client, rig);
        }
        catch (err) {
            console.error(err.message);
            process.exitCode = 1;
            return;
        }
        const res = await client.post(`/api/rigs/${encodeURIComponent(rigId)}/env/down`, { volumes: opts.volumes ?? false }, { timeoutMs: LONG_RUNNING_TIMEOUT_MS });
        if (res.status >= 400 || !res.data.ok) {
            console.error(res.data.error ?? `Failed to stop services (HTTP ${res.status})`);
            process.exitCode = 1;
            return;
        }
        console.log(res.data.kept ?? `Services stopped for ${rig}.`);
    });
    return cmd;
}
//# sourceMappingURL=env.js.map