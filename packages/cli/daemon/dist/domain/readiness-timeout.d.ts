import { SettingsStore } from "./user-settings/settings-store.js";
/** Resolve at launch time so a config change applies to the next seat, while
 * preserving explicit millisecond overrides used by callers and tests. A
 * settings read that throws (e.g. config.json edited into invalid JSON while
 * the daemon runs) costs a warning and the 30-second default, never a launch. */
export declare function resolveReadinessTimeoutMs(explicitMs: number | undefined, settings?: Pick<SettingsStore, "resolveOne">): number;
//# sourceMappingURL=readiness-timeout.d.ts.map