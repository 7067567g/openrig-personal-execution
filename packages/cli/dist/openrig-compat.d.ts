/**
 * Sentinel file a QA/test fixture drops in its scratch OPENRIG_HOME to mark
 * the home as fixture-scoped. This is the preferred (most-honest) signal.
 */
export declare const FIXTURE_HOME_MARKER = ".openrig-fixture";
/**
 * OPR.0.4.3.12 — PATH-ONLY predicate: is `home` a fixture-scoped OpenRig home?
 *
 * Recognizes a fixture home by EITHER an explicit sentinel marker file
 * (`.openrig-fixture`, preferred/most-honest) OR the temp-path QA convention
 * (an `openrig-qa*` home under a system temp root, e.g.
 * `OPENRIG_HOME=/tmp/openrig-qa-…-home`).
 *
 * Deliberately has NO ConfigStore dependency: `ConfigStore` imports this
 * module, so importing it here would create a cycle. Callers that need the
 * divergent-daemon-target confirmation (restore-check) compose this path
 * predicate with `ConfigStore.resolveWithSource` at the call site.
 */
export declare function isFixtureScopedHome(home: string): boolean;
export declare function getOpenRigHome(): string;
export declare function getLegacyRiggedHome(): string;
export declare const OPENRIG_HOME: string;
export declare const LEGACY_RIGGED_HOME: string;
export declare function readOpenRigEnv(primary: string, legacy?: string): string | undefined;
export declare function getPreferredOpenRigHome(): string;
export declare function getDefaultOpenRigPath(filename: string): string;
export declare function getCompatibleOpenRigPath(filename: string): string;
//# sourceMappingURL=openrig-compat.d.ts.map