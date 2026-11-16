/**
 * Terminal runtime adapter for infrastructure nodes.
 * All operations are no-ops — the shell is immediately interactive.
 * Startup actions (send_text) are handled by the startup orchestrator,
 * not by this adapter.
 */
export class TerminalAdapter {
    runtime = "terminal";
    async listInstalled(_binding) {
        return [];
    }
    async project(_plan, _binding) {
        return { projected: [], skipped: [], failed: [] };
    }
    async deliverStartup(_files, _binding) {
        return { delivered: 0, failed: [] };
    }
    async launchHarness(_binding, opts) {
        if (opts.forkSource) {
            return {
                ok: false,
                error: "terminal runtime has no native fork primitive; remove session_source for terminal members",
            };
        }
        return { ok: true };
    }
    async checkReady(_binding) {
        return { ready: true };
    }
}
//# sourceMappingURL=terminal-adapter.js.map