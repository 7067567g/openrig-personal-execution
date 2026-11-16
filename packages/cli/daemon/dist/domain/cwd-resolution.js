import nodePath from "node:path";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
const ENV_REF = /\$(?:\{([A-Za-z_][A-Za-z0-9_]*)\}|([A-Za-z_][A-Za-z0-9_]*))/g;
/** Expands a leading `~` and `$VAR` / `${VAR}` references. A reference to an unset variable is
 *  left as written so preflight reports the path instead of launching in a silently shortened one. */
export function expandCwd(authored, env = process.env, home = homedir()) {
    const tilded = authored === "~" || authored.startsWith("~/") ? home + authored.slice(1) : authored;
    return tilded.replace(ENV_REF, (ref, braced, bare) => env[braced ?? bare] ?? ref);
}
/** Picks the directory an authored cwd means. The literal path wins when it exists, so a directory
 *  named with `~` or `$NAME` keeps its destination; otherwise the expanded path is used. A relative
 *  path resolves under `specRoot`; with no `specRoot` it stays relative, as the caller selected before. */
export function resolveAuthoredCwd(authored, specRoot, exists = existsSync, env = process.env, home = homedir()) {
    const place = (p) => (specRoot === null || nodePath.isAbsolute(p) ? p : nodePath.resolve(specRoot, p));
    const literal = place(authored);
    return exists(literal) ? literal : place(expandCwd(authored, env, home));
}
export function resolveLaunchCwd(authoredCwd, specRoot, cwdOverride) {
    if (cwdOverride && cwdOverride.trim().length > 0) {
        return nodePath.resolve(cwdOverride);
    }
    if (!authoredCwd || authoredCwd.trim().length === 0) {
        return nodePath.resolve(specRoot);
    }
    return resolveAuthoredCwd(authoredCwd, specRoot);
}
export function getOpenRigInstallRoot() {
    return nodePath.resolve(import.meta.dirname, "../..");
}
export function isPathInsideRoot(candidatePath, rootPath) {
    const relative = nodePath.relative(nodePath.resolve(rootPath), nodePath.resolve(candidatePath));
    return relative === "" || (relative !== ".." && !relative.startsWith(`..${nodePath.sep}`) && !nodePath.isAbsolute(relative));
}
export function isFilesystemRoot(cwd) {
    const resolved = nodePath.resolve(cwd);
    return resolved === nodePath.parse(resolved).root;
}
export function getOpenRigInstallCwdError(resolvedCwd, cwdOverride, installRoot = getOpenRigInstallRoot()) {
    // The filesystem root is not refused (#226): an explicit --cwd / or `cwd: /` is the person's
    // choice, and `rig up` warns when it defaulted to '/' itself.
    if (cwdOverride && cwdOverride.trim().length > 0) {
        return null;
    }
    if (!isPathInsideRoot(resolvedCwd, installRoot)) {
        return null;
    }
    return `Resolved cwd '${resolvedCwd}' is inside the OpenRig installation '${installRoot}', which is not a valid project workspace. Pass --cwd <path> to launch into your project directory.`;
}
//# sourceMappingURL=cwd-resolution.js.map