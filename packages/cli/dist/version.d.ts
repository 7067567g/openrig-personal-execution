import { type BuildInfo } from "./build-info.js";
/** OPR.0.4.4.11 FR-7 — a STAMPED build prints `<semver> (<shortsha>)` (plus
 *  a dirty marker when dirty); an unstamped dev run prints the semver alone
 *  exactly as before (negative AC: no fake identity). */
export declare function formatCliVersion(semver: string, info: BuildInfo): string;
export declare const CLI_VERSION: string;
/** Local-line identity (r19): `rig --version` names the fork, not only its semver.
 *  `CLI_VERSION` stays the bare/stamped semver for MCP `serverInfo.version` and for
 *  scripts that parse a version; only the human-facing banner carries the product. */
export declare function formatProductVersion(version: string): string;
export declare const PRODUCT_VERSION: string;
//# sourceMappingURL=version.d.ts.map