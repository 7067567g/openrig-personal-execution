// Public adapter for the S01 project-workspace owner used by S05 instance
// initialization. The bytes and behavior live in @openrig-local/daemon.
import { Command } from "commander";
import { ensureDefaultWorkspace, workspaceScaffoldDirs, workspaceScaffoldFiles, } from "../../daemon/dist/instance-initialization-surface.js";
import { ConfigStore } from "../config-store.js";
export { workspaceScaffoldDirs, workspaceScaffoldFiles };
export function initWorkspaceCommand(configPath) {
    const cmd = new Command("init-workspace")
        .description("Scaffold a repo-ready project workspace")
        .option("--root <path>", "Override workspace root (default: workspace.root setting)")
        .option("--force", "Deprecated compatibility flag; existing files are still preserved")
        .option("--dry-run", "Show what would be created without writing")
        .option("--json", "JSON output")
        .action((opts) => {
        try {
            const effectiveJson = opts.json ?? Boolean(cmd.optsWithGlobals().json);
            const result = runInitWorkspace({ ...opts, json: effectiveJson, configPath });
            if (effectiveJson) {
                console.log(JSON.stringify(result, null, 2));
            }
            else {
                if (result.dryRun)
                    console.log(`(dry-run) workspace root: ${result.root}`);
                else
                    console.log(`workspace root: ${result.root}`);
                for (const sub of result.subdirs) {
                    console.log(`  ${sub.created ? "+" : " "} ${sub.name}/`);
                }
                for (const file of result.files) {
                    console.log(`  ${file.created ? "+" : " "} ${file.relPath}${file.skipped ? `  (skipped: ${file.skipped})` : ""}`);
                }
                if (result.dryRun)
                    console.log("(dry-run; no files written.)");
            }
        }
        catch (err) {
            console.error(err.message);
            process.exitCode = 1;
        }
    });
    return cmd;
}
export function runInitWorkspace(opts) {
    const store = new ConfigStore(opts.configPath);
    const root = opts.root ?? store.get("workspace.root");
    const result = ensureDefaultWorkspace({ root, dryRun: !!opts.dryRun });
    if (!result.ok) {
        const detail = result.conflicts
            .map((conflict) => `${conflict.path}: expected ${conflict.expected}, found ${conflict.actual}`)
            .join("; ");
        throw new Error(`Workspace initialization blocked: ${detail}`);
    }
    return result;
}
//# sourceMappingURL=config-init-workspace.js.map