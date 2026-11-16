import type { ContextPackLibraryService } from "./context-packs/context-pack-library-service.js";
type Source = {
    kind: string;
    path: string;
    sha256: string;
    binding: "matches-bound" | "differs-from-bound" | "not-bound";
};
type Component = {
    id: string;
    owner?: string;
    admission?: string;
};
export interface GuidanceInput {
    instanceId: string;
    contextRefs?: string[];
    binding?: Record<string, unknown> | null;
    stepId?: string;
    ownerSession?: string;
    packetId?: string;
    component?: string;
    full?: boolean;
    library?: ContextPackLibraryService;
}
/** Current authored advice. No component cursor, scheduler, cache or adoption write. */
export declare function readWorkflowGuidance(input: GuidanceInput): {
    stories?: {
        address: string;
        text: string;
    }[] | undefined;
    components?: Component[] | undefined;
    edges?: {
        from: string;
        to: string;
        when?: string;
    }[] | undefined;
    teaching?: (Component & {
        address: string;
        text: string;
    })[] | undefined;
    state: string;
    selectionSource: string | null;
    catalogSource: string | null;
    catalogPath: string | null;
    catalogHash: string | null;
    sources: Source[];
    position: string;
    ownerSession: string | null;
    unknowns: string[];
    expansionCommand: string;
    lines: string[];
};
export {};
//# sourceMappingURL=workflow-guidance.d.ts.map