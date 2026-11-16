import type Database from "better-sqlite3";
import { type EffectiveOperatorContextMode, type OperatorContextMode, type OperatorContextModeBinding, type OperatorContextReadContext, type OperatorContextScope } from "./rig-mode-types.js";
/** A saved legacy mode and an operating posture are separate categories at one scope and qualifier (migration 109). */
export type BindingCategory = "mode" | "posture";
export declare function bindingCategory(mode: string): BindingCategory;
export interface SetBindingResult {
    ok: true;
    binding: OperatorContextModeBinding;
}
export interface SetBindingError {
    ok: false;
    errors: string[];
}
export interface RigModeStoreOpts {
    /** Override the clock for tests; defaults to new Date(). */
    now?: () => Date;
}
export declare class RigModeStore {
    private readonly db;
    private readonly now;
    constructor(db: Database.Database, opts?: RigModeStoreOpts);
    /**
     * Operator-only set. Validates the candidate record + the
     * scope/qualifier shape, then upserts. Returns the typed binding
     * on success.
     *
     * scope == 'global_host' REQUIRES qualifier === null;
     * scope != 'global_host' REQUIRES a non-empty qualifier string.
     * Both are operator/host invariants — the route validates and
     * the store rejects on disagreement.
     */
    setBinding(scope: OperatorContextScope, qualifier: string | null, mode: unknown, candidateRecord: unknown): SetBindingResult | SetBindingError;
    /** The binding at this scope and qualifier: the latest set, when a mode and a posture are both kept there. */
    getBinding(scope: OperatorContextScope, qualifier: string | null): OperatorContextModeBinding | null;
    /** Each category's binding at this scope and qualifier, latest set first. */
    getBindings(scope: OperatorContextScope, qualifier: string | null): OperatorContextModeBinding[];
    listBindings(): OperatorContextModeBinding[];
    /** Delete one binding: the given category's, or without one the latest set (the one getBinding returns). A row of
     *  the other category at the same target is kept. */
    deleteBinding(scope: OperatorContextScope, qualifier: string | null, category?: BindingCategory): boolean;
    /** As deleteBinding, returning the removed binding. */
    removeBinding(scope: OperatorContextScope, qualifier: string | null, category?: BindingCategory): OperatorContextModeBinding | null;
    /**
     * Resolve the most-specific applicable binding for a read context.
     * Returns null when no binding matches — callers MUST treat null as
     * `unknown_posture` per convention §Q6 (do NOT default to `desk`).
     *
     * Specificity ranks (qitem > workstream > rig > global_host) are
     * defined in rig-mode-types.SCOPE_SPECIFICITY. For each scope the
     * resolver picks the binding whose qualifier matches the read
     * context. Among multiple matching bindings, the most-specific
     * scope wins.
     */
    resolveEffective(ctx: OperatorContextReadContext, modes?: readonly OperatorContextMode[]): EffectiveOperatorContextMode | null;
}
//# sourceMappingURL=rig-mode-store.d.ts.map