// Slice-04 (OPR.0.5.0.4) C1 (resume) — the production ProviderService. getReadModel is fully
// wired over the collection seam (real codex-auth reader + node-inventory across rigs + clock).
// precheck composes the pure precheckSwitch gate (fails closed on unknown auth per BR-3). switch
// is precheck-gated and NEVER fabricates success — the switch-execution + BR-1 action-record path
// is the D seam; until it lands, switch returns an honest failed_safely with an operational reason.
import nodePath from "node:path";
import os from "node:os";
import { AGENT_ACTIVITY_FRESHNESS_MS, } from "../agent-activity-store.js";
import { getNodeInventory } from "../node-inventory.js";
import { readCodexAuthMetadata } from "./codex-auth-reader.js";
import { collectFourBlockReadModel } from "./provider-collect.js";
import { configuredSeatAccounts } from "./provider-seat-accounts.js";
import { precheckSwitch } from "./provider-policy.js";
import { collectReactiveEventSignals } from "./reactive-tap.js";
export class ProviderServiceImpl {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async getReadModel() {
        const env = this.deps.env ?? process.env;
        const asOf = (this.deps.now ?? (() => new Date().toISOString()))();
        let auth;
        let seats;
        const readAuth = () => auth ??= readCodexAuthMetadata(env);
        const listSeats = () => seats ??= this.listSeats();
        const collectReactiveSignals = () => {
            if (!this.deps.agentActivityStore)
                return [];
            const result = collectReactiveEventSignals({
                seats: listSeats(),
                auth: readAuth(),
                activity: this.deps.agentActivityStore,
                now: asOf,
                freshnessMs: AGENT_ACTIVITY_FRESHNESS_MS,
            });
            const warn = this.deps.warn ?? ((message) => console.warn(message));
            for (const disposition of [...result.triggers, ...result.discards]) {
                warn(`[provider-reactive-tap] ${JSON.stringify(disposition)}`);
            }
            return result.signals;
        };
        const model = collectFourBlockReadModel({
            readCodexAuth: readAuth,
            listSeats,
            collectSignals: () => [
                ...(this.deps.collectClaudeSignals?.() ?? []),
                ...collectReactiveSignals(),
            ],
            now: () => asOf,
        });
        // Slice 01: memory only. A read never starts a native probe (the wake ladder reads this every tick).
        const usage = this.usageWindowsEnabled() ? this.deps.usageWindows.windows.project(asOf) : null;
        if (!usage)
            return model;
        // The read covers only the login active in the daemon's CODEX_HOME: say so whenever saved rig auth
        // profiles exist, so a profile without a row never reads as fine.
        const profiles = model.accounts.filter((a) => a.provider === "codex").map((a) => a.accountId);
        const savedProfiles = profiles.length > 0
            ? { names: profiles, note: "saved rig auth profiles: not read (usage unknown); this reading is only the login active in the daemon's CODEX_HOME" }
            : null;
        const codexRows = savedProfiles ? usage.map((row) => ({ ...row, savedProfiles })) : usage;
        const allUsage = [...codexRows, ...(this.deps.usageWindows.claude?.project(asOf) ?? [])];
        // Each seat's configured account, from the same seat universe and registry metadata (names only), never
        // linked to a usage row.
        const seatAccounts = configuredSeatAccounts({
            seats: listSeats(),
            auth: readAuth(),
            usage: allUsage,
            claudeSamples: this.deps.usageWindows.claude?.seatSamples() ?? null,
            codexHome: env.CODEX_HOME || nodePath.join(env.HOME ?? os.homedir(), ".codex"),
            claudeConfigDir: env.CLAUDE_CONFIG_DIR,
            home: env.HOME ?? os.homedir(),
        });
        return { ...model, usage: allUsage, seatAccounts };
    }
    async refreshUsage(provider) {
        if (!this.usageWindowsEnabled())
            return { disabled: true };
        if (provider === "claude")
            return this.deps.usageWindows.claude?.refresh() ?? { unavailable: true };
        return this.deps.usageWindows.windows.refresh();
    }
    usageWindowsEnabled() {
        if (!this.deps.usageWindows)
            return false;
        try {
            return this.deps.usageWindows.enabled();
        }
        catch {
            return false;
        }
    }
    listSeats() {
        const seats = [];
        for (const rig of this.deps.listRigs()) {
            for (const entry of getNodeInventory(this.deps.db, rig.id)) {
                if (!entry.canonicalSessionName)
                    continue;
                seats.push({
                    seatSession: entry.canonicalSessionName,
                    rigName: entry.rigName ?? "",
                    runtime: entry.runtime ?? "unknown",
                    lifecycleState: entry.lifecycleState,
                });
            }
        }
        return seats;
    }
    async precheck(input) {
        const model = await this.getReadModel();
        const target = model.accounts.find((a) => a.accountId === input.toAccount);
        // Validate-at-use: an unknown target OR unknown auth fails closed (BR-3 — disk presence never
        // asserts active). Live-conversation state is not yet wired (the C2 activity seam), so assume
        // live — the conservative direction never strands a conversation silently. This is the MANUAL
        // precheck variant (no triggeringSignal; that's for automated policy-driven switches).
        return precheckSwitch({
            targetProvider: target?.provider ?? "codex",
            targetAuthState: target?.authState ?? "unknown",
            seatHasLiveConversation: true,
        });
    }
    async switchAccount(input) {
        // Precheck-gate: never switch past an unsafe verdict unless explicitly forced.
        const verdict = await this.precheck({ seat: input.seat, toAccount: input.toAccount });
        if (verdict.safe === false && !input.forceUnsafe) {
            const reasons = verdict.reasons.length > 0 ? verdict.reasons : ["precheck_unsafe"];
            return { outcome: "failed_safely", reasons: reasons };
        }
        // D seam (compose the rig-auth codex switch + BR-1 durable action record) is NOT yet wired.
        // Honest operational failure — never fabricate a succeeded/rebind_in_progress outcome.
        return { outcome: "failed_safely", reasons: ["switch_execution_not_yet_wired"] };
    }
}
//# sourceMappingURL=provider-service-impl.js.map