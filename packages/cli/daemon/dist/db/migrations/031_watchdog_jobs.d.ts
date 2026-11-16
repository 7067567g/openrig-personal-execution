import type { Migration } from "../migrate.js";
/**
 * Watchdog jobs (PL-004 Phase C; daemon-native Watchdog supervision tree).
 *
 * Per PRD § Watchdog + slice IMPL § Write Set: SQLite-canonical watchdog
 * jobs that join the daemon supervision tree. Three policy enum values
 * SHIPPED at Phase C v1: periodic-reminder, artifact-pool-ready,
 * edge-artifact-required. The fourth POC policy (workflow-keepalive)
 * ships in Phase D paired with workflow_instances; daemon registration
 * MUST reject it with a structured deferred-to-phase-d error.
 *
 * State enum:
 *   active   - scheduler is evaluating this job on its interval
 *   stopped  - operator stopped the job; scheduler skips it
 *   terminal - policy declared the job complete (e.g., workflow finished)
 *
 * Cadence columns mirror POC engine semantics:
 *   - interval_seconds is the legacy / fallback cadence.
 *   - scan_interval_seconds overrides the scheduler isDue cadence
 *     (how often to run the policy at all).
 *   - active_wake_interval_seconds throttles re-delivery: when the
 *     pool stays continuously actionable, fire only every Nth scan.
 *
 * Active-wake state (R1 fix; POC parity for active-wake throttle):
 *   - actionable: 1 iff the most recent scan returned action=send.
 *     Used to detect newly-actionable transitions (no throttle on
 *     transition; throttle on continued actionable state).
 *   - last_actionable_at: first attempt time during the current
 *     actionable window. Cleared when the policy returns skip.
 *
 * spec_yaml preserves the original operator-supplied YAML for audit.
 */
export declare const watchdogJobsSchema: Migration;
//# sourceMappingURL=031_watchdog_jobs.d.ts.map