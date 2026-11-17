// S8 Wave A — the NARROW `@openrig-local/daemon/entry-guard` public surface.
// Only the entry-guard decision API crosses the daemon→CLI boundary; the daemon's
// internals are NOT re-exported (packaging ruling A, same shape as the other surfaces).
export { ACCEPTED_RISK_CLI_COMMANDS, appendAudit, checkDaemonBoot, checkEntry, classifyEntryVerb, classifyHome, isFixtureScopedHome, readLaunchRecord, redactArgv, } from "./entry-guard.js";
export { ACCEPTED_RISK_HTTP_ROUTES } from "./entry-guard-http.js";
//# sourceMappingURL=entry-guard-surface.js.map