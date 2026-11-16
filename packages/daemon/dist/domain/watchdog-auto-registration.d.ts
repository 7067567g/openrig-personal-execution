import type Database from "better-sqlite3";
import type { SettingsStore } from "./user-settings/settings-store.js";
import { type WatchdogJob, type WatchdogJobsRepository } from "./watchdog-jobs-repository.js";
export declare class WatchdogAutoRegistrationError extends Error {
    readonly code: "target_mismatch" | "missing";
    readonly details: Record<string, unknown>;
    constructor(code: "target_mismatch" | "missing", message: string, details: Record<string, unknown>);
}
export interface WatchdogAutoRegistrationDeps {
    db: Database.Database;
    jobsRepo: WatchdogJobsRepository;
    settingsStore: SettingsStore;
    warn?: (message: string) => void;
}
export declare function formatWatchdogRegistrationError(error: unknown): string;
/**
 * W2c's one structural seam: every canonical seat mint ensures its role-bound
 * idle-gate job, while startup only audits existing live-like seats. Core seat
 * creation remains fail-isolated from this additive supervision layer.
 */
export declare class WatchdogAutoRegistration {
    private readonly deps;
    private readonly warn;
    constructor(deps: WatchdogAutoRegistrationDeps);
    /** Named exclusions: flat legacy and noncanonical/external seats cannot own qitems. */
    isEligibleSessionName(sessionName: string): boolean;
    /**
     * A discovered handover may legitimately claim a noncanonical tmux name.
     * It is not eligible for a new role job, but the retired canonical target
     * must stop being deliverable. Terminal history lets a later canonical
     * occupant create a fresh active job; an operator-stopped row stays stopped.
     */
    reconcileHandover(nodeId: string, sessionName: string): WatchdogJob | null;
    /**
     * B6 founder ruling — auto-registration is NOT default-on. A NEW job is created only when the
     * fleet opted in (`auto_register: "all"`) or this seat is named in `opt_in_sessions`. A seat that
     * ALREADY HAS a job keeps being maintained regardless: existing registered jobs survive the
     * default flip, and their alias refresh must not silently stop.
     */
    private autoRegisterAllowed;
    ensure(nodeId: string, sessionName: string): WatchdogJob | null;
    assertCoverage(nodeId: string, sessionName: string): WatchdogJob | null;
    /** Audit every latest live-like seat at startup; never create or delete rows. */
    assertLiveSeatCoverage(): void;
    private resolveTopology;
    private canonicalAliases;
    private resolveCadence;
    private generatedSpec;
}
//# sourceMappingURL=watchdog-auto-registration.d.ts.map