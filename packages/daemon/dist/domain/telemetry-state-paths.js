import { join } from "node:path";
export function contextUsageDirectory(openrigHome) {
    return join(openrigHome, "state", "context-usage");
}
export function legacyContextUsageDirectory(openrigHome) {
    return join(openrigHome, "context");
}
export function providerUsageDirectory(openrigHome) {
    return join(openrigHome, "state", "provider-usage");
}
export function legacyProviderUsageDirectory(openrigHome) {
    return join(openrigHome, "provider-usage");
}
export function telemetrySidecarFilename(sessionName) {
    return `${sessionName.replace(/[^a-zA-Z0-9@._-]/g, "_")}.json`;
}
export function telemetrySidecarPath(directory, sessionName) {
    return join(directory, telemetrySidecarFilename(sessionName));
}
//# sourceMappingURL=telemetry-state-paths.js.map