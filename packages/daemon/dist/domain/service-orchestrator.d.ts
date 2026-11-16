import type { RigRepository } from "./rig-repository.js";
import type { ComposeServicesAdapter } from "../adapters/compose-services-adapter.js";
import type { EnvReceipt } from "./types.js";
export type ServiceBootResult = {
    ok: true;
    receipt: EnvReceipt;
    health: "healthy" | "degraded";
} | {
    ok: false;
    code: string;
    error: string;
    receipt?: EnvReceipt;
};
export type ServiceTeardownResult = {
    ok: true;
    kept?: string;
} | {
    ok: false;
    code: string;
    error: string;
};
interface ServiceOrchestratorDeps {
    rigRepo: RigRepository;
    composeAdapter: ComposeServicesAdapter;
}
/**
 * Leaf service called by existing orchestrators (bootstrap, teardown, restore).
 * Does NOT independently manage boot/teardown timing — callers decide when.
 */
export declare class ServiceOrchestrator {
    private rigRepo;
    private composeAdapter;
    constructor(deps: ServiceOrchestratorDeps);
    /**
     * Boot services for a rig. Called by bootstrap orchestrator as a stage before agent launch.
     * 1. Load persisted services record
     * 2. Run docker compose up
     * 3. Evaluate wait targets
     * 4. Persist receipt
     */
    boot(rigId: string, opts?: {
        waitTimeoutMs?: number;
        waitPollIntervalMs?: number;
    }): Promise<ServiceBootResult>;
    /**
     * Tear down services for a rig. Called by teardown orchestrator during rig down.
     * Honors down_policy from the persisted spec.
     */
    teardown(rigId: string, opts?: {
        policyOverride?: "down" | "down_and_volumes" | "leave_running";
    }): Promise<ServiceTeardownResult>;
    /**
     * Capture a fresh receipt from current compose state. Called by snapshot capture.
     */
    captureReceipt(rigId: string): Promise<EnvReceipt | null>;
    private parseSpec;
    private buildReceipt;
}
export {};
//# sourceMappingURL=service-orchestrator.d.ts.map