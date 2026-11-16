/** Author-declared setup, for display only. OpenRig never executes or checks it. */
export interface BundlePrecondition {
    name: string;
    commands?: string[];
}
export declare function normalizePreconditionsBlock(raw: unknown, onMalformed?: (reason: string) => void): BundlePrecondition[] | undefined;
export interface BundleSourceIdentity {
    repository: string;
    folder: string;
    requestedRef: string;
    resolvedCommit: string;
    canonicalUrl: string;
}
/** Shared source-format spelling. Attribution only, not proof of authorship. */
export declare function normalizeBundleSource(raw: unknown): BundleSourceIdentity | undefined;
/**
 * Provenance block — attribution metadata for a bundle artifact. All fields
 * optional for backward compat; bundles without provenance install unchanged.
 * Captured by the bundle-assembler at create time; surfaced in inspect output
 * and audit-trail records. Not cryptographically signed at this stage.
 */
export interface BundleProvenance {
    source?: BundleSourceIdentity;
    /** ISO timestamp; mirrors root createdAt at create time. */
    createdAt?: string;
    /** os.hostname() of the host that ran rig bundle create. */
    sourceHost?: string;
    /** Canonical session name of the creator (e.g. dev-build@starter). */
    authorSession?: string;
    /** ULID of the source rig, if creating from a live rig. */
    sourceRigId?: string;
    /** Name of the source rig, if creating from a live rig. */
    sourceRigName?: string;
    /** Daemon version at create time (e.g. 0.3.2). */
    daemonVersion?: string;
    /** CLI version at create time (e.g. 0.3.2). */
    cliVersion?: string;
    /** Operator-authored notes from the --notes flag on rig bundle create. */
    notes?: string;
}
/**
 * Cross-primitive bundling — Item 6 / slice-05 Checkpoint 7.1.
 *
 * Manifest may optionally declare typed sibling primitives the bundle should
 * route to their respective libraries on install. v0 ships the `skills` kind
 * (Checkpoint 7.1). Plugins + workflow_specs + context_packs + agent_images
 * land additively in subsequent checkpoints as their libraries are reachable.
 *
 * PRD §Item 6: bundles list these alongside the existing rig + agents +
 * packages fields (no `contents:` re-grouping — that would be a schema
 * reorg violating the no-bump constraint). Each kind is an optional top-
 * level field; missing kinds keep backward compat.
 */
/**
 * Plugin reference — Item 6 / slice-05 Checkpoint 7.3b. Bundle manifest may
 * declare plugin references the bundle includes (in HYBRID mode the bundle
 * REFERENCES the existing 0.3.1 plugin rather than forking its content; per
 * orch-ratified decision doc).
 */
export interface BundlePluginReference {
    /** Plugin id (matches the plugin primitive's id surface). */
    id: string;
    /** Where to resolve the plugin from. v0 supports local-path source. */
    source: {
        kind: "local";
        path: string;
    };
}
/**
 * Compatibility block — operator-declared install-time requirements for a
 * bundle artifact. All fields optional; missing block keeps backward compat
 * (bundles install unchanged). Install-time version check (Item 2 Checkpoint
 * 3.3) consults this block before bootstrap delegation; --skip-version-check
 * is the operator-explicit override.
 */
export interface BundleCompatibility {
    /** Minimum daemon version required to install this bundle (semver string). */
    minDaemonVersion?: string;
    /** Minimum CLI version required to install this bundle (semver string). */
    minCliVersion?: string;
    /** Schema version reaffirmed; mirrors root schemaVersion when set. */
    schemaVersion?: number;
}
/**
 * Normalize raw snake_case compatibility to typed camelCase BundleCompatibility.
 * Returns undefined when absent or empty. Exported alongside the provenance
 * normalizer so the v2 inspect-route projection can produce a single
 * camelCase shape for both manifest schemas.
 */
export declare function normalizeCompatibilityBlock(raw: unknown): BundleCompatibility | undefined;
/**
 * Normalize raw snake_case provenance (as parsed from YAML or received from
 * a request body) to typed camelCase BundleProvenance. Returns undefined when
 * absent or empty. Exported so both the v1 normalizer pipeline and the v2
 * inspect-route projection produce identical camelCase shapes — the
 * /api/bundles/inspect contract is one shape regardless of schema version.
 */
export declare function normalizeProvenanceBlock(raw: unknown): BundleProvenance | undefined;
export interface PodBundleAgentImportEntry {
    name: string;
    version: string;
    path: string;
    originalRef: string;
    hash: string;
}
export interface PodBundleAgentEntry {
    name: string;
    version: string;
    path: string;
    originalRef: string;
    hash: string;
    importEntries: PodBundleAgentImportEntry[];
}
export interface PodBundleManifest {
    schemaVersion: 2;
    name: string;
    version: string;
    createdAt: string;
    rigSpec: string;
    agents: PodBundleAgentEntry[];
    cultureFile?: string;
    integrity?: BundleIntegrity;
    /** Exact archive-relative harness login paths deliberately included by the producer. Not authentication. */
    includedLoginFiles?: string[];
    provenance?: BundleProvenance;
    assembler?: {
        openrigVersion: string;
        commit?: string;
    };
    compatibility?: BundleCompatibility;
    preconditions?: BundlePrecondition[];
    /** Item 6 cross-primitive bundling: skill paths to route to the operator skills library on install. */
    skills?: string[];
    /** Item 6 cross-primitive bundling: plugin references to install via the plugin primitive (HYBRID-mode bundles reference existing plugins rather than forking content). */
    plugins?: BundlePluginReference[];
    /** Item 6 cross-primitive bundling: workflow spec YAML paths to route to the operator workflow-specs library on install (Checkpoint 7.3e). */
    workflowSpecs?: string[];
    /** Item 6 cross-primitive bundling: paths to context-pack manifest.yaml files; router copies the parent dir to the operator context-packs library on install (Checkpoint 7.3f). */
    contextPacks?: string[];
    /** Item 6 cross-primitive bundling: paths to agent-image DIRECTORIES (per PRD §Item 6 line 197); router copies the declared directory to the operator agent-images library on install. Consumer requires manifest.yaml inside each image dir. (Checkpoint 7.3g) */
    agentImages?: string[];
    /** The project this rig works in: its id and the bundle folder holding project.yaml. Install registers it in the workspace catalog and associates the rig with it. */
    project?: BundleProjectReference;
    /** The configuration this archive was built in (configuration ID, and the preset when it matches one). Outside the package digest. */
    configuration?: {
        id: string;
        preset?: string;
    };
}
export interface BundleProjectReference {
    id: string;
    path: string;
}
/** A producer declaration, never a wildcard or a receiver approval. */
export declare function normalizeIncludedLoginFiles(raw: unknown): string[] | undefined;
export declare function validatePodBundleManifest(raw: unknown): {
    valid: boolean;
    errors: string[];
};
export declare function serializePodBundleManifest(manifest: PodBundleManifest): string;
export declare function parsePodBundleManifest(yaml: string): unknown;
/** A package entry in the legacy bundle manifest */
export interface LegacyBundlePackageEntry {
    name: string;
    version: string;
    path: string;
    originalSource: string;
    /** All original source refs when deduped from multiple inputs */
    originalSources?: string[];
}
/** Integrity section with per-file checksums */
export interface BundleIntegrity {
    algorithm: "sha256";
    files: Record<string, string>;
}
/** The bundle.yaml manifest */
export interface LegacyBundleManifest {
    schemaVersion: number;
    name: string;
    version: string;
    createdAt: string;
    rigSpec: string;
    packages: LegacyBundlePackageEntry[];
    integrity?: BundleIntegrity;
    /** Exact archive-relative harness login paths deliberately included by the producer. Not authentication. */
    includedLoginFiles?: string[];
    provenance?: BundleProvenance;
    assembler?: {
        openrigVersion: string;
        commit?: string;
    };
    compatibility?: BundleCompatibility;
    preconditions?: BundlePrecondition[];
    /** Item 6 cross-primitive bundling: skill paths to route to the operator skills library on install. */
    skills?: string[];
    /** Item 6 cross-primitive bundling: plugin references to install via the plugin primitive (HYBRID-mode bundles reference existing plugins rather than forking content). */
    plugins?: BundlePluginReference[];
    /** Item 6 cross-primitive bundling: workflow spec YAML paths to route to the operator workflow-specs library on install (Checkpoint 7.3e). */
    workflowSpecs?: string[];
    /** Item 6 cross-primitive bundling: paths to context-pack manifest.yaml files; router copies the parent dir to the operator context-packs library on install (Checkpoint 7.3f). */
    contextPacks?: string[];
    /** Item 6 cross-primitive bundling: paths to agent-image DIRECTORIES (per PRD §Item 6 line 197); router copies the declared directory to the operator agent-images library on install. Consumer requires manifest.yaml inside each image dir. (Checkpoint 7.3g) */
    agentImages?: string[];
}
/** Validation options */
interface ValidateOptions {
    requireIntegrity?: boolean;
}
/**
 * Check if a path is a safe archive-relative path.
 * Rejects: absolute paths, ../ traversal, backslashes, dot segments (./, bare .),
 * empty segments (//), empty string.
 */
export declare function isRelativeSafePath(p: string): boolean;
/** Validate a raw parsed bundle manifest */
export declare function validateLegacyBundleManifest(raw: unknown, opts?: ValidateOptions): {
    valid: boolean;
    errors: string[];
};
/** Parse bundle.yaml YAML string to unknown */
export declare function parseLegacyBundleManifest(yaml: string): unknown;
/** Normalize raw parsed manifest to typed LegacyBundleManifest */
export declare function normalizeLegacyBundleManifest(raw: unknown): LegacyBundleManifest;
/** Serialize a LegacyBundleManifest to YAML */
export declare function serializeLegacyBundleManifest(manifest: LegacyBundleManifest): string;
export {};
//# sourceMappingURL=bundle-types.d.ts.map