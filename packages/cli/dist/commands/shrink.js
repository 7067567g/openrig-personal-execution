import { Command } from "commander";
import { DaemonClient } from "../client.js";
import { getDaemonStatus, getDaemonUrl, daemonStatusGuard } from "../daemon-lifecycle.js";
import { realDeps } from "./daemon.js";
export function shrinkCommand(depsOverride) {
    const cmd = new Command("shrink").description("Remove an entire pod from a running rig");
    const getDeps = () => depsOverride ?? { lifecycleDeps: realDeps(), clientFactory: (url) => new DaemonClient(url) };
    async function getClient(deps) {
        const status = await getDaemonStatus(deps.lifecycleDeps);
        if (!daemonStatusGuard(status))
            return null;
        return deps.clientFactory(getDaemonUrl(status));
    }
    cmd
        .argument("<rigId>", "Target rig ID")
        .argument("<podRef>", "Pod namespace or pod ID")
        .option("--fallback <live-seat>", "Reroute active qitems to this running seat before removing the pod")
        .option("--json", "JSON output")
        .action(async (rigId, podRef, opts) => {
        const deps = getDeps();
        const client = await getClient(deps);
        if (!client) {
            process.exitCode = 1;
            return;
        }
        const fallbackQuery = opts.fallback ? `?fallback=${encodeURIComponent(opts.fallback)}` : "";
        const res = await client.delete(`/api/rigs/${encodeURIComponent(rigId)}/pods/${encodeURIComponent(podRef)}${fallbackQuery}`);
        if (opts.json) {
            console.log(JSON.stringify(res.data, null, 2));
            if (res.status >= 400 || (res.data.ok && res.data.status !== "ok"))
                process.exitCode = 1;
            return;
        }
        if ((res.data.reroutedQitemIds?.length ?? 0) > 0 && res.data.fallbackDestination) {
            console.log(`Rerouted ${res.data.reroutedQitemIds.join(", ")} to ${res.data.fallbackDestination}`);
        }
        if (res.status >= 400) {
            console.error(res.data["error"] ?? `Shrink failed (HTTP ${res.status})`);
            process.exitCode = 1;
            return;
        }
        if (res.data.status === "partial") {
            console.log(`Partially removed pod ${res.data.namespace} from rig ${res.data.rigId} (${res.data.removedLogicalIds?.length ?? 0} node(s), ${res.data.sessionsKilled} session killed)`);
            for (const node of res.data.nodes ?? []) {
                const icon = node.status === "removed" ? "OK" : "FAIL";
                const error = node.error ? ` — ${node.error}` : "";
                const kept = node.sessionKeptFor ? ` (session kept: owned by ${node.sessionKeptFor})` : "";
                console.log(`  [${icon}] ${node.logicalId}${kept}${error}`);
            }
            process.exitCode = 1;
            return;
        }
        console.log(`Removed pod ${res.data.namespace} from rig ${res.data.rigId} (${res.data.removedLogicalIds?.length ?? 0} node(s), ${res.data.sessionsKilled} session killed)`);
        for (const node of res.data.nodes ?? []) {
            if (node.sessionKeptFor)
                console.log(`  ${node.logicalId}: session kept, owned by ${node.sessionKeptFor}`);
        }
    });
    return cmd;
}
//# sourceMappingURL=shrink.js.map