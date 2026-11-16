/**
 * Declared configurations (docs/reference/bundle-formats.md, bundle-configurations.v1): which runtime
 * each seat may use, the profile each runtime uses, and named presets. The generator applies a chosen
 * mapping to an owned copy of the rig folder, then the one bundler packs it. Nothing here invents a
 * resource: a runtime's differences live in the profile the author named for it.
 */
export declare const CONFIGURATIONS_FILE = "configurations.yaml";
export interface DeclaredConfigurations {
    recommended: string;
    seats: Record<string, {
        runtimes: Record<string, string>;
    }>;
    presets: Record<string, Record<string, string>>;
}
export interface ChosenConfiguration {
    /** pod.member -> runtime, for every member. */
    mapping: Record<string, string>;
    configurationId: string;
    /** The preset whose mapping this is, when it matches one exactly. */
    preset?: string;
}
export declare class ConfigurationError extends Error {
}
/** Read configurations.yaml beside rig.yaml. Returns null when the bundle declares none. */
export declare function readDeclaredConfigurations(rigDir: string): DeclaredConfigurations | null;
/** The runtime each member uses in rig.yaml as authored. */
export declare function authoredMapping(rigSpecPath: string): Record<string, string>;
/**
 * Check a declaration against rig.yaml as written: every seat it lists is a member, every preset
 * stays within the declared runtimes, and the recommended preset is rig.yaml's own mapping, so
 * building it gives the authored package. Create, `rig bundle configurations` and `rig bundle check`
 * share this check. Throws ConfigurationError naming the first problem.
 */
export declare function checkDeclaredConfigurations(declared: DeclaredConfigurations, authored: Record<string, string>): void;
/**
 * Resolve a preset plus per-seat choices into a full mapping, checked against what the bundle
 * declares. Throws ConfigurationError naming the allowed set when a choice isn't declared.
 */
export declare function resolveConfiguration(declared: DeclaredConfigurations, authored: Record<string, string>, choice: {
    preset?: string;
    seats?: string[];
}): ChosenConfiguration;
/** Every declared preset with its configuration ID, and which preset is rig.yaml as authored. */
export declare function listConfigurations(declared: DeclaredConfigurations, authored: Record<string, string>): {
    preset: string;
    configurationId: string;
    recommended: boolean;
    authored: boolean;
}[];
/**
 * Copy the rig folder to a new owned directory and apply the chosen runtime and profile to every
 * member whose runtime changes, so the author's folder is never modified. Returns the copy's rig.yaml.
 * Links are copied as the files they point to, so nothing in the copy leads back to the author's
 * files. If staging fails, the copy is removed and a ConfigurationError says why.
 */
export declare function stageConfiguration(rigDir: string, rigSpecFile: string, declared: DeclaredConfigurations, chosen: ChosenConfiguration): {
    stagingDir: string;
    rigSpecPath: string;
};
//# sourceMappingURL=bundle-configuration.d.ts.map