import { ulid } from "ulid";
/**
 * Executes approved external install actions via injected ExecFn.
 * Journals everything to bootstrap_actions table.
 * On failure: marks failed, continues to next (no global abort).
 * No automatic uninstall rollback.
 */
export class ExternalInstallExecutor {
    exec;
    db;
    constructor(deps) {
        this.exec = deps.exec;
        this.db = deps.db;
    }
    /**
     * Execute tagged actions. All actions are journaled (including skipped).
     * @param bootstrapId - links journal entries to a bootstrap run
     * @param taggedActions - full action set with approval decisions
     */
    async execute(bootstrapId, taggedActions, startSeq = 1) {
        const results = [];
        for (let i = 0; i < taggedActions.length; i++) {
            const { action, approved } = taggedActions[i];
            const seq = startSeq + i;
            const actionId = ulid();
            // Skip: unapproved, manual_only (defense in depth), or no command
            if (!approved || action.classification === "manual_only" || !action.commandPreview) {
                const result = {
                    actionId,
                    requirementName: action.requirementName,
                    status: "skipped",
                    command: action.commandPreview,
                    stdout: null,
                    errorMessage: null,
                    durationMs: 0,
                };
                this.journal(actionId, bootstrapId, seq, action, "skipped", { stdout: null, errorMessage: null, durationMs: 0 });
                results.push(result);
                continue;
            }
            // Execute
            const start = Date.now();
            try {
                const stdout = await this.exec(action.commandPreview);
                const durationMs = Date.now() - start;
                const result = {
                    actionId,
                    requirementName: action.requirementName,
                    status: "completed",
                    command: action.commandPreview,
                    stdout: stdout ?? null,
                    errorMessage: null,
                    durationMs,
                };
                this.journal(actionId, bootstrapId, seq, action, "completed", { stdout: stdout ?? null, errorMessage: null, durationMs });
                results.push(result);
            }
            catch (err) {
                const durationMs = Date.now() - start;
                const errorMessage = err.message ?? "unknown error";
                const result = {
                    actionId,
                    requirementName: action.requirementName,
                    status: "failed",
                    command: action.commandPreview,
                    stdout: null,
                    errorMessage,
                    durationMs,
                };
                this.journal(actionId, bootstrapId, seq, action, "failed", { stdout: null, errorMessage, durationMs });
                results.push(result);
                // Continue to next — no abort
            }
        }
        return {
            results,
            completed: results.filter((r) => r.status === "completed"),
            failed: results.filter((r) => r.status === "failed"),
            skipped: results.filter((r) => r.status === "skipped"),
        };
    }
    journal(id, bootstrapId, seq, action, status, detail) {
        this.db.prepare(`INSERT INTO bootstrap_actions (id, bootstrap_id, seq, action_kind, subject_type, subject_name, provider, command_preview, status, detail_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, bootstrapId, seq, "external_install", action.kind, action.requirementName, action.provider, action.commandPreview, status, JSON.stringify(detail));
    }
}
//# sourceMappingURL=external-install-executor.js.map