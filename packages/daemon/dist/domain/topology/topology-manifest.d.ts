export interface TopologyRigEntry {
    source: string;
    host?: string;
}
export interface TopologyManifest {
    rigs: TopologyRigEntry[];
    /** Normalized: the manifest's cap, or the default 1 (sequential). */
    concurrency: number;
}
export type TopologyManifestResult = {
    ok: true;
    manifest: TopologyManifest;
} | {
    ok: false;
    errors: string[];
};
/** Validate an already-parsed YAML document as a topology manifest.
 *  Collects EVERY structural error (per-entry, what/why/fix) rather than
 *  failing fast — FR-1 reports them all before any launch. */
export declare function validateTopologyManifest(parsed: unknown, sourcePath: string): TopologyManifestResult;
/** Load + parse + validate a topology manifest file. Parse failures error AS
 *  a topology (arch ruling 1: the declared kind binds — no rig-spec
 *  fall-through). */
export declare function loadTopologyManifest(path: string): TopologyManifestResult;
/** Detection sniff (FR-1 + guard G-1/yaml folds): a parsed YAML document is
 *  topology-SHAPED iff it carries a top-level `rigs:` LIST. A rig spec never
 *  carries top-level `rigs`, so the sniff is unambiguous. Shape only — full
 *  validation still runs (and rejects) as a topology afterwards. */
export declare function hasTopLevelRigsList(parsed: unknown): boolean;
/** Raw-text form of the sniff for router branches that have not parsed yet
 *  (the extensionless path-form fallback). Unparseable YAML sniffs false —
 *  it then flows to the existing non-topology handling unchanged. */
export declare function yamlTextHasTopLevelRigsList(raw: string): boolean;
//# sourceMappingURL=topology-manifest.d.ts.map