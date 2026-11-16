type Exists = (path: string) => boolean;
/** The running daemon's assets root (packages/daemon/assets, or <cli>/daemon/assets when packaged). */
export declare function runningBuiltinAssetsRoot(): string;
/** The running daemon's shipped specs root (packages/daemon/specs, or <cli>/daemon/specs when packaged). */
export declare function runningShippedSpecsRoot(): string;
/**
 * Re-anchor one stored startup file to the running install when it ships with OpenRig:
 * - a built-in: its logical name is one of the four built-ins, its stored absolutePath is
 *   exactly <ownerRoot>/<known relative path>, and ownerRoot is a recognized install's
 *   daemon/assets directory; or
 * - a shipped-spec file: its ownerRoot and absolutePath both lie under the same recognized
 *   install's daemon/specs (for example the kernel rig culture and agent role/startup files).
 * Dev-checkout files are re-anchored only when missing. Anything else (custom rig/agent files,
 * user content with a matching basename) is returned unchanged. Required, applicability,
 * delivery and every other field are preserved.
 */
export declare function reanchorBuiltinStartupFile<T extends {
    path: string;
    absolutePath: string;
    ownerRoot: string;
}>(file: T, assetsRoot?: string, specsRoot?: string, exists?: Exists): T;
/**
 * Re-anchor one stored projection entry to the running install when it is a shipped-spec
 * resource: both its sourcePath and its resource absolutePath lie under the same recognized
 * OpenRig install's daemon/specs root (dev-checkout resources only when missing). A resource
 * stored elsewhere (a plugin under ~/.openrig/plugins, user specs, custom paths) is returned
 * unchanged even when its sourcePath is a shipped spec. Identifiers, category, target and
 * merge behavior are preserved.
 */
export declare function reanchorShippedProjectionEntry<T extends {
    sourcePath: string;
    absolutePath: string;
}>(entry: T, specsRoot?: string, exists?: Exists): T;
export {};
//# sourceMappingURL=builtin-startup-files.d.ts.map