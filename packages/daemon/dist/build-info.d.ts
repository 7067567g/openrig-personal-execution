export interface BuildInfo {
    semver: string | null;
    commit: string | null;
    dirty: boolean | null;
    builtAt: string | null;
}
export declare const BUILD_INFO: BuildInfo;
/** The additive /healthz fields: the four stamp keys when stamped, an EMPTY
 *  object when dev — existing consumers (including exact-body probes against
 *  dev daemons) see no change. */
export declare function stampFields(info?: BuildInfo): Record<string, unknown>;
//# sourceMappingURL=build-info.d.ts.map