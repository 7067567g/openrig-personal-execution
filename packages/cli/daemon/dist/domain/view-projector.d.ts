import type { ProjectRead } from "./workspace/project-read.js";
import type Database from "better-sqlite3";
import type { EventBus } from "./event-bus.js";
import { type ExecutionViewDeps } from "./execution-view.js";
/**
 * View projector (PL-004 Phase B; L5 View — read-only projections).
 *
 * Per PRD § L5 + slice IMPL § Guard Checkpoint Focus item 5+6:
 * - 6 built-in views over Phase A's queue_items + queue_transitions tables.
 * - Custom view registration via views_custom table.
 * - Read-only over Phase A state + Phase B state. NO writes to queue_items
 *   or queue_transitions from this module.
 * - Sub-100 ms latency target (per PRD § Acceptance Criteria); achieved by
 *   leaning on Phase A's existing indexes.
 * - Fixture rig exclusion default: rig names matching `^test-` or `^fixture-`
 *   are excluded; opt-in via OPENRIG_VIEW_INCLUDE_FIXTURES=1.
 *
 * Custom views in views_custom store a SQL string (`definition`) that the
 * projector executes verbatim. Operator-defined; no taxonomy enforced.
 *
 * Pattern mirrors Phase A's queue-repository.ts read-API shape.
 */
export declare const BUILT_IN_VIEW_NAMES: readonly ["recently-active", "founder", "pod-load", "escalations", "held", "activity", "pickup", "execution"];
export type BuiltInViewName = (typeof BUILT_IN_VIEW_NAMES)[number];
export interface ViewQueryResult {
    viewName: string;
    generatedAt: string;
    rows: Record<string, unknown>[];
    rowCount: number;
}
interface ViewShowOptions {
    rig?: string;
    limit?: number;
    mission?: string;
    project?: ProjectRead | null;
}
export interface CustomView {
    viewId: string;
    viewName: string;
    definition: string;
    registeredBySession: string;
    registeredAt: string;
    lastEvaluatedAt: string | null;
}
export declare class ViewProjectorError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export declare class ViewProjector {
    readonly db: Database.Database;
    private readonly eventBus;
    private readonly now;
    constructor(db: Database.Database, eventBus: EventBus, opts?: {
        now?: () => Date;
    });
    private executionDeps;
    setExecutionDeps(deps: ExecutionViewDeps): void;
    /**
     * Run a view by name. Built-in names (BUILT_IN_VIEW_NAMES) dispatch to
     * hardcoded SQL; other names dispatch to custom-view lookup.
     * Only execution is asynchronous; SQL views retain their synchronous API.
     */
    show(viewName: "execution", opts?: ViewShowOptions): Promise<ViewQueryResult>;
    show(viewName: Exclude<BuiltInViewName, "execution">, opts?: ViewShowOptions): ViewQueryResult;
    show(viewName: string, opts?: ViewShowOptions): ViewQueryResult | Promise<ViewQueryResult>;
    /** #586: whether showing this view binds `limit` into SQL. The execution view
     *  never reads it, a custom view with its own LIMIT keeps that one, and an
     *  unregistered name is refused before any SQL runs. */
    bindsLimit(viewName: string): boolean;
    list(): {
        builtIn: BuiltInViewName[];
        custom: CustomView[];
    };
    private runBuiltIn;
    private runCustom;
    /**
     * Register a custom view. UNIQUE on view_name; re-registration of the
     * same name updates the definition (operator-friendly: edit views.yaml,
     * re-register, get the new query).
     */
    registerCustomView(input: {
        viewName: string;
        definition: string;
        registeredBySession: string;
    }): CustomView;
    getCustomView(viewName: string): CustomView | null;
    listCustomViews(): CustomView[];
    /**
     * Used by routes/views.ts to emit view.changed when underlying state
     * changes. Phase B does not auto-evaluate; callers (route SSE handlers)
     * subscribe to event-bus events and trigger this notify.
     */
    notifyViewChanged(viewName: string, cause: string): void;
    private getCustomViewByIdOrThrow;
    private rowToCustomView;
}
export {};
//# sourceMappingURL=view-projector.d.ts.map