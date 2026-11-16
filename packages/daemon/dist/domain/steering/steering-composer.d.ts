export interface SteeringComposerOpts {
    /** Workspace root (e.g., the openrig-work substrate dir). Optional
     *  per-piece overrides (steeringPath / roadmapPath / deliveryReadyDir)
     *  trump the workspace-root-derived defaults. */
    workspaceRoot: string | null;
    steeringPath?: string | null;
    roadmapPath?: string | null;
    deliveryReadyDir?: string | null;
    /** Per-lane top-N items to surface; default 3 (PRD § Item 1D). */
    topNPerLane?: number;
}
export interface PriorityStackPayload {
    /** Verbatim STEERING.md content. UI renders via the v0 MarkdownViewer
     *  for consistency with the Files browser. */
    content: string;
    absolutePath: string;
    mtime: string;
    byteCount: number;
}
export interface RoadmapRailItem {
    line: number;
    text: string;
    done: boolean;
    /** Detected PL-XXX rail-item code if present (e.g., "PL-019"). */
    railItemCode: string | null;
    /** True for the first unchecked item on the rail (UI marks visually). */
    isNextUnchecked: boolean;
}
export interface RoadmapRailPayload {
    absolutePath: string;
    mtime: string;
    items: RoadmapRailItem[];
    /** Total checkbox rows / done / next-unchecked-line for header. */
    counts: {
        total: number;
        done: number;
        nextUncheckedLine: number | null;
    };
}
export interface LaneRailItem {
    line: number;
    text: string;
    status: "active" | "done" | "blocked" | "unknown";
    /** True when this is the lane's "next pull" per the Priority Rail
     *  Rule: first non-done, non-blocked checkbox row on the lane. */
    isNextPull: boolean;
}
export interface LaneRailPayload {
    /** "mode-0" / "mode-1" / etc. — derived from the file's parent dir. */
    laneId: string;
    absolutePath: string;
    mtime: string;
    /** Top-N items shown on the steering panel (active/blocked first;
     *  done items only filling remainder). */
    topItems: LaneRailItem[];
    /** Lane-health aggregate counts across ALL rows in the file. */
    healthBadges: {
        active: number;
        blocked: number;
        done: number;
        total: number;
    };
    /** Convenience: line number of the lane's next-pull row, null if none. */
    nextPullLine: number | null;
}
export interface SteeringPayload {
    priorityStack: PriorityStackPayload | null;
    roadmapRail: RoadmapRailPayload | null;
    laneRails: LaneRailPayload[];
    /** Surface-level diagnostics for the UI to render setup hints when
     *  individual sources are missing. Each entry names the env var that
     *  would resolve it. */
    unavailableSources: Array<{
        section: string;
        reason: string;
        envVar?: string;
    }>;
}
export declare function steeringOptsFromEnv(env?: NodeJS.ProcessEnv): SteeringComposerOpts;
export interface SteeringSettingsDefaults {
    workspaceRoot: string;
    workspaceSteeringPath: string;
}
export declare function steeringOptsFromSettings(settings: SteeringSettingsDefaults, env?: NodeJS.ProcessEnv): SteeringComposerOpts;
export declare class SteeringComposer {
    private readonly opts;
    constructor(opts: SteeringComposerOpts);
    /** True when at least one source is resolvable. Routes use this to
     *  decide between 200 (with possibly-empty unavailableSources) and
     *  503 (no sources at all). */
    isReady(): boolean;
    compose(): SteeringPayload;
    private composePriorityStack;
    private composeRoadmapRail;
    private composeLaneRails;
    private composeLaneFromFile;
    private resolveSteeringPath;
    private resolveRoadmapPath;
    private resolveDeliveryReadyDir;
}
export declare function matchRailItemCode(text: string): string | null;
//# sourceMappingURL=steering-composer.d.ts.map