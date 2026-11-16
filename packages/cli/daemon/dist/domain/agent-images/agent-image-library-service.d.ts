import { type AgentImageEntry, type AgentImageManifest, type AgentImageSourceType } from "./agent-image-types.js";
export interface AgentImageLibraryRoot {
    /** Absolute path to a directory whose immediate children are image dirs. */
    path: string;
    sourceType: AgentImageSourceType;
}
export interface AgentImageLibraryOpts {
    roots: AgentImageLibraryRoot[];
}
/** Stable id format: agent-image:<name>:<version> (parallel to context-pack:). */
export declare function agentImageId(name: string, version: string): string;
export declare function parseAgentImageId(id: string): {
    name: string;
    version: string;
} | null;
export declare function estimateTokensFromBytes(bytes: number): number;
export declare class AgentImageLibraryService {
    private entries;
    private readonly roots;
    constructor(opts: AgentImageLibraryOpts);
    getRoots(): readonly AgentImageLibraryRoot[];
    scan(): {
        count: number;
        errors: Array<{
            source: string;
            error: string;
        }>;
    };
    list(): AgentImageEntry[];
    get(id: string): AgentImageEntry | null;
    getByNameVersion(name: string, version: string): AgentImageEntry | null;
    /**
     * Atomically update stats.json — bump lastUsedAt always; increment
     * forkCount only when `incrementForkCount: true` (default true to
     * preserve back-compat with the first-shipped signature). Used by
     * the instantiator in two phases:
     *   1. Pre-launch (incrementForkCount: false): records the operator's
     *      INTENT to consume the image. lastUsedAt updates so the library
     *      view shows recent activity even when the launch ultimately
     *      fails — operators see "this image was tried" without conflating
     *      attempts with successful forks.
     *   2. Post-launch on success (incrementForkCount: true): increments
     *      forkCount only when startupResult.ok===true. Prior
     *      behavior incremented on intent regardless of outcome, which
     *      polluted forkCount with failed-launch noise.
     *
     * Best-effort: a stat-write failure surfaces as an AgentImageError but
     * does NOT abort the consumer (the image consumption path itself does
     * not depend on stats; the operator just loses fork-count visibility
     * on this consumption).
     *
     * Back-compat: legacy `recordConsumption(id, () => new Date())` form
     * still works — a positional function argument is treated as the
     * `now` clock with `incrementForkCount: true`.
     */
    recordConsumption(id: string, optsOrNow?: {
        incrementForkCount?: boolean;
        now?: () => Date;
    } | (() => Date)): void;
    /** Pin an image — creates a `.pinned` sentinel file inside the image directory. */
    pin(id: string): void;
    /** Unpin — removes the `.pinned` sentinel. */
    unpin(id: string): void;
    private readImageEntry;
    /** Write a fresh manifest + empty stats.json + cwd-deltas (if any) to a new image directory. */
    install(targetRootPath: string, manifest: AgentImageManifest, fileContents: Map<string, string>): string;
}
//# sourceMappingURL=agent-image-library-service.d.ts.map