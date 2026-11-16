/** The persisted selection ("local" ≡ no remote selection). Never throws:
 *  a malformed config file falls back to "local" (read paths must not
 *  break). */
export declare function readSelectedHost(): string;
/** FR-2: the effective host for a command that already supports `--host`.
 *  Explicit flag wins; else the persisted selection (when not "local");
 *  else undefined (= today's local path, untouched). */
export declare function resolveEffectiveHost(explicitHost: string | undefined): string | undefined;
/** OPR.0.4.6.MH1 FR-4 — the own-host display name (default "localhost";
 *  arch Ruling 1: home = the settings twins). Same read discipline as
 *  readSelectedHost: local ConfigStore, never throws. */
export declare function readOwnHostName(): string;
//# sourceMappingURL=host-selection.d.ts.map