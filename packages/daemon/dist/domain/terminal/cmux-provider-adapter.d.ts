import type { CmuxAdapter } from "../../adapters/cmux.js";
import { type CmuxLayoutService } from "../cmux-layout-service.js";
import type { ComposedView, OpenViewResult, ProviderLiveness, ProviderStatus, TerminalProvider } from "./terminal-provider.js";
export interface CmuxProviderDeps {
    cmuxAdapter: CmuxAdapter;
    layoutService: CmuxLayoutService;
    /**
     * Mint a fresh launch token per `openView` so a relaunch creates new
     * workspaces (fresh-on-relaunch, same discipline as the herdr adapter).
     * Injectable for deterministic tests. Default: a per-instance monotonic
     * counter (unique within a daemon lifetime).
     */
    newLaunchToken?: () => string;
    /** Workspace-name prefix (default `openrig`). */
    workspacePrefix?: string;
}
export declare class CmuxProviderAdapter implements TerminalProvider {
    private readonly deps;
    readonly name = "cmux";
    private readonly newLaunchToken;
    private readonly workspacePrefix;
    private launchCounter;
    constructor(deps: CmuxProviderDeps);
    status(): Promise<ProviderStatus>;
    liveness(): Promise<ProviderLiveness>;
    openView(view: ComposedView): Promise<OpenViewResult>;
}
//# sourceMappingURL=cmux-provider-adapter.d.ts.map