import type { MissionTemplateKind, SliceTemplateKind } from "./types.js";
export interface RenderOpts {
    id: string;
    slice_number?: string;
    slug: string;
    mission: string;
    title: string;
    created_date: string;
    /** Authored purpose. Defaults to title for backwards-compatible callers. */
    intent?: string;
    /** Advisory build-order edges to sibling work-node dot-IDs. */
    depends_on?: string[];
    release_version?: string;
    intent_visual_image_path?: string;
    intent_visual_diff_path?: string;
    intent_visual_build_command?: string;
}
export declare function renderSliceTemplate(kind: SliceTemplateKind, opts: RenderOpts): string;
/** Legacy renderer retained for callers reading or repairing pre-convention
 * trees. New scope scaffolds never call it. */
export declare function renderImplementationPrdTemplate(opts: RenderOpts): string;
export declare function renderMissionTemplate(kind: MissionTemplateKind, opts: RenderOpts): string;
export declare function renderCapabilityDeltaTemplate(opts: RenderOpts): string;
export interface NotesRenderOpts {
    mission_id: string;
    mission_name: string;
    created_date: string;
}
export type NotesTemplateSource = "env" | "legacy-env" | "built-in";
/** Resolve the current NOTES.md template. The retired environment name stays
 * readable as a fallback and is surfaced to callers as `legacy-env`. */
export declare function resolveNotesTemplatePath(envValue?: string): {
    absPath: string;
    resolvedFrom: NotesTemplateSource;
};
export declare function renderNotesTemplate(opts: NotesRenderOpts, envValue?: string): {
    rendered: string;
    resolvedFrom: NotesTemplateSource;
    absPath: string;
};
export declare function renderMissionProgressTemplate(missionName: string): string;
export declare function renderSliceProgressTemplate(sliceName: string): string;
export interface SliceProofRenderOpts {
    id: string;
    title: string;
}
export declare function renderSliceProofTemplate(opts: SliceProofRenderOpts): string;
/** Convert a folder-slug to a title-cased display name. */
export declare function titleFromSlug(slug: string): string;
//# sourceMappingURL=templates.d.ts.map