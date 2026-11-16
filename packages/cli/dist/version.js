import { readFileSync } from "node:fs";
import { BUILD_INFO } from "./build-info.js";
function readPackageVersion() {
    const packageJsonPath = new URL("../package.json", import.meta.url);
    const parsed = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    return parsed.version ?? "0.0.0";
}
/** OPR.0.4.4.11 FR-7 — a STAMPED build prints `<semver> (<shortsha>)` (plus
 *  a dirty marker when dirty); an unstamped dev run prints the semver alone
 *  exactly as before (negative AC: no fake identity). */
export function formatCliVersion(semver, info) {
    if (!info.commit)
        return semver;
    const short = info.commit.slice(0, 8);
    return info.dirty ? `${semver} (${short}, dirty)` : `${semver} (${short})`;
}
export const CLI_VERSION = formatCliVersion(readPackageVersion(), BUILD_INFO);
/** Local-line identity (r19): `rig --version` names the fork, not only its semver.
 *  `CLI_VERSION` stays the bare/stamped semver for MCP `serverInfo.version` and for
 *  scripts that parse a version; only the human-facing banner carries the product. */
export function formatProductVersion(version) {
    return `openrig-local ${version}`;
}
export const PRODUCT_VERSION = formatProductVersion(CLI_VERSION);
//# sourceMappingURL=version.js.map