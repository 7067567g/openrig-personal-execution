export declare const SYSTEM_WORLD_SCHEMA = "openrig.system-world/v0alpha1";
export declare const DEFAULT_SYSTEM_WORLD_SELECTION = "default";
export declare const DISABLED_SYSTEM_WORLD_SELECTION = "disabled";
export declare const DEFAULT_SYSTEM_WORLD_RELATIVE_PATH = "system/system-world.yaml";
export declare const DEFAULT_SYSTEM_WORLD_MANIFEST = "schema: openrig.system-world/v0alpha1\nid: openrig-default\nversion: \"0.5.9\"\ncontext:\n  - ref: onboarding-width\n  - ref: world-public\n    profiles:\n      claude: guided\n      codex: codex-coverage\nskills: []\n";
export interface SystemWorldContextSelection {
    ref: string;
    profiles?: {
        claude?: string;
        codex?: string;
    };
}
export interface SystemWorldManifest {
    schema: typeof SYSTEM_WORLD_SCHEMA;
    id: string;
    version: string;
    context: SystemWorldContextSelection[];
    skills: string[];
}
export type SystemWorldSource = "default" | "file" | "env";
export type SystemWorldResolution = {
    ok: true;
    state: "default" | "replacement" | "disabled";
    source: SystemWorldSource;
    selection: string;
    manifestPath: string | null;
    manifest: SystemWorldManifest | null;
} | {
    ok: false;
    state: "default" | "replacement";
    source: SystemWorldSource;
    selection: string;
    manifestPath: string;
    error: {
        code: "system_world_missing" | "system_world_invalid";
        message: string;
    };
};
/** One ordered context selection, `{ ref, profiles? }`. Shared by the System World
 *  manifest and a project's `install.worlds`; throws with `label` in the message. */
export declare function parseContextSelection(entry: unknown, label: string): SystemWorldContextSelection;
export declare function parseSystemWorldManifest(text: string, sourcePath?: string): SystemWorldManifest;
export declare function resolveSystemWorld(input: {
    contextRoot: string;
    selection: string;
    source: SystemWorldSource;
}): SystemWorldResolution;
//# sourceMappingURL=system-world.d.ts.map