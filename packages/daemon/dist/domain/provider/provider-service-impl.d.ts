import type Database from "better-sqlite3";
import { type AgentActivityStore } from "../agent-activity-store.js";
import type { CodexUsageWindows } from "./codex-usage-windows.js";
import type { ClaudeUsageWindows } from "./claude-usage-windows.js";
import type { UsageRefreshResult } from "./usage-windows.js";
import type { ProviderService, ProviderPrecheckInput, ProviderSwitchInput, ProviderSwitchResult } from "./provider-service.js";
import type { FourBlockReadModel, PrecheckResult, ProviderSignal } from "./provider-types.js";
export interface ProviderServiceImplDeps {
    db: Database.Database;
    /** The rig universe (rigRepo.listRigs()) — each rig's node-inventory contributes seats. */
    listRigs: () => Array<{
        id: string;
    }>;
    /** Slice-04 C3: the Claude statusline provider_usage signal source (undefined → signals []). */
    collectClaudeSignals?: () => ProviderSignal[];
    /** Slice-04 C4: the shipped structured activity detector. Undefined keeps the reactive lane empty. */
    agentActivityStore?: Pick<AgentActivityStore, "getLatestForNode">;
    /** W2a tap: operator-visible disposition sink. Observability only; never a verification producer. */
    warn?: (message: string) => void;
    env?: NodeJS.ProcessEnv;
    now?: () => string;
    /** Slice 01: Codex usage windows, served only while `enabled()` (provider.usage_windows) is true. */
    usageWindows?: {
        enabled: () => boolean;
        windows: CodexUsageWindows;
        claude?: ClaudeUsageWindows;
    };
}
export declare class ProviderServiceImpl implements ProviderService {
    private readonly deps;
    constructor(deps: ProviderServiceImplDeps);
    getReadModel(): Promise<FourBlockReadModel>;
    refreshUsage(provider: "codex" | "claude"): Promise<UsageRefreshResult | {
        disabled: true;
    } | {
        unavailable: true;
    }>;
    private usageWindowsEnabled;
    private listSeats;
    precheck(input: ProviderPrecheckInput): Promise<PrecheckResult>;
    switchAccount(input: ProviderSwitchInput): Promise<ProviderSwitchResult>;
}
//# sourceMappingURL=provider-service-impl.d.ts.map