import { Command } from "commander";
import { DaemonClient } from "../client.js";
import { getDaemonStatus, getDaemonUrl, daemonStatusGuard } from "../daemon-lifecycle.js";
import { realDeps } from "./daemon.js";
export function snapshotCommand(depsOverride) {
    const cmd = new Command("snapshot").description("Manage rig snapshots");
    const getDeps = () => depsOverride ?? { lifecycleDeps: realDeps(), clientFactory: (url) => new DaemonClient(url) };
    async function getClient(deps) {
        const status = await getDaemonStatus(deps.lifecycleDeps);
        if (!daemonStatusGuard(status))
            return null;
        return deps.clientFactory(getDaemonUrl(status));
    }
    // rig snapshot <rigId> — default action creates a snapshot
    cmd
        .argument("<rigId>", "Rig ID to snapshot")
        .option("--intended-seats <ids>", "Comma-separated intended topology roster stored with the snapshot")
        .action(async (rigId, opts) => {
        const deps = getDeps();
        const client = await getClient(deps);
        if (!client) {
            process.exitCode = 1;
            return;
        }
        const intendedSeats = opts.intendedSeats?.split(",").map((seat) => seat.trim()).filter(Boolean);
        const res = await client.post(`/api/rigs/${encodeURIComponent(rigId)}/snapshots`, intendedSeats ? { intendedSeats } : undefined);
        if (res.status === 404) {
            console.error(`Rig '${rigId}' not found`);
            process.exitCode = 1;
        }
        else if (res.status >= 400) {
            console.error(`Snapshot failed: ${res.data.error ?? "unknown error"}`);
            process.exitCode = 1;
        }
        else {
            console.log(`Snapshot created: ${res.data.id}`);
            console.log(`To restore: rig restore ${res.data.id} --rig ${rigId}`);
        }
    });
    // rig snapshot list <rigId>
    cmd
        .command("list <rigId>")
        .description("List snapshots for a rig")
        .action(async (rigId) => {
        const deps = getDeps();
        const client = await getClient(deps);
        if (!client) {
            process.exitCode = 1;
            return;
        }
        const res = await client.get(`/api/rigs/${encodeURIComponent(rigId)}/snapshots`);
        if (res.status >= 400) {
            console.error(`Failed to list snapshots: ${res.data.error ?? "unknown error"}`);
            process.exitCode = 1;
            return;
        }
        const snapshots = res.data;
        if (snapshots.length === 0) {
            console.log("No snapshots");
            return;
        }
        console.log("ID                         Kind    Status    Created");
        for (const snap of snapshots) {
            console.log(`${snap.id.padEnd(27)} ${snap.kind.padEnd(8)} ${snap.status.padEnd(10)} ${snap.createdAt}`);
        }
    });
    return cmd;
}
//# sourceMappingURL=snapshot.js.map