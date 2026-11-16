import { Command } from "commander";
import { writeTextAtomically } from "../atomic-text-write.js";
import { DaemonClient } from "../client.js";
import { getDaemonStatus, getDaemonUrl, daemonStatusGuard } from "../daemon-lifecycle.js";
import { realDeps } from "./daemon.js";
export function exportCommand(depsOverride) {
    const cmd = new Command("export").description("Export a rig spec as YAML");
    const getDeps = () => depsOverride ?? {
        lifecycleDeps: realDeps(),
        clientFactory: (url) => new DaemonClient(url),
        writeFile: (p, content) => writeTextAtomically(p, content, "export"),
    };
    cmd
        .argument("<rigId>", "Rig ID to export")
        .option("-o, --output <path>", "Output file path", "rig.yaml")
        .action(async (rigId, opts) => {
        const deps = getDeps();
        const status = await getDaemonStatus(deps.lifecycleDeps);
        if (!daemonStatusGuard(status))
            return;
        const client = deps.clientFactory(getDaemonUrl(status));
        const res = await client.getText(`/api/rigs/${encodeURIComponent(rigId)}/spec`);
        if (res.status === 404) {
            console.error(`Rig '${rigId}' not found`);
            process.exitCode = 1;
        }
        else if (res.status >= 400) {
            console.error(`Export failed: ${res.data}`);
            process.exitCode = 1;
        }
        else {
            deps.writeFile(opts.output, res.data);
            console.log(`Exported to ${opts.output}`);
        }
    });
    return cmd;
}
//# sourceMappingURL=export.js.map