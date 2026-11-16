/** True when THIS machine refused to make the connection (a sandbox or security policy), as
 *  opposed to a daemon that refused it. The daemon may still be running. */
export declare function isBlockedConnectionCode(code: string | undefined): code is string;
/** Never advises starting a daemon, and names no access setting: whether a seat gets network
 *  access is the user's choice, taught in the help guide section it routes to. The guide is the
 *  offline copy, because `rig context get` itself needs the daemon this shell cannot reach. */
export declare function blockedConnectionGuidance(code: string, env?: NodeJS.ProcessEnv, helpPath?: string | undefined): {
    consequence: string;
    action: string;
};
/** The help guide that ships with this CLI, readable without the daemon. `baseDir` is this
 *  module's directory (`src/` in a checkout, `dist/` when installed). In a source checkout its
 *  `docs/` wins, as in resolveDaemonPath; then the copy the package build places under
 *  `daemon/docs/reference/`. An installed package (under `node_modules`) never looks outside
 *  itself. Pure: `exists` is injected. */
export declare function resolveOfflineHelpPath(baseDir: string, exists: (p: string) => boolean): string | undefined;
export declare function getOfflineHelpPath(): string | undefined;
//# sourceMappingURL=daemon-reachability.d.ts.map