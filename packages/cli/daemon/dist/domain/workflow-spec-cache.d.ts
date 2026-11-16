import type Database from "better-sqlite3";
import type { WorkflowSpec, WorkflowSpecRow } from "./workflow-types.js";
export declare class WorkflowSpecError extends Error {
    readonly code: string;
    readonly details?: Record<string, unknown> | undefined;
    constructor(code: string, message: string, details?: Record<string, unknown> | undefined);
}
/**
 * OPR.0.4.6.WF1 FR-7 — THE closed keysets, EXPORTED as named
 * constants: parseWorkflowSpec is the ONLY seam that sees raw keys
 * (the validator operates on the typed spec and can never see dropped
 * keys), so unknown-key rejection lands here — and WF-2's new fields
 * (next_hop.on / harness / host / gate) EXTEND these constants rather
 * than re-plumbing the parser.
 */
export declare const WORKFLOW_TOP_LEVEL_KEYS: readonly ["id", "version", "objective", "target", "entry", "roles", "steps", "invariants", "closure", "loop_guards", "exception_routing", "coordination_terminal_turn_rule", "context_refs"];
export declare const WORKFLOW_STEP_KEYS: readonly ["id", "actor_role", "objective", "allowed_exits", "re_present_after_seconds", "re_present_max_seconds", "next_hop", "harness", "host", "gate", "depends_on", "acceptance"];
/** A spec row with `{rig}` targets resolved against `boundRig`. */
export declare function bindRowToRig(row: WorkflowSpecRow, boundRig: string | null): WorkflowSpecRow;
export declare const WORKFLOW_ROLE_KEYS: readonly ["skill_refs", "preferred_targets"];
export declare const WORKFLOW_NEXT_HOP_KEYS: readonly ["mode", "suggested_roles", "on"];
export declare const WORKFLOW_GATE_KEYS: readonly ["target", "summary", "evidence_ref"];
export declare const WORKFLOW_ACCEPTANCE_KEYS: readonly ["candidate", "verdicts", "evidence_ref"];
export declare const WORKFLOW_TARGET_KEYS: readonly ["rig"];
export declare const WORKFLOW_ENTRY_KEYS: readonly ["role"];
export declare const WORKFLOW_INVARIANTS_KEYS: readonly ["continuation_required", "allowed_exits", "preserve_lineage", "closure_required"];
export declare const WORKFLOW_CLOSURE_KEYS: readonly ["success", "degraded", "failed"];
export declare const WORKFLOW_LOOP_GUARDS_KEYS: readonly ["max_hops", "spawn_budget"];
/** OPR.0.4.6.WF5 FR-2: the dial grammar keyset (WF-2 strictness rail —
 *  unknown keys reject loud naming this set). */
export declare const WORKFLOW_EXCEPTION_ROUTING_KEYS: readonly ["default", "orchestrator_role", "classes"];
/**
 * Parse a workflow spec from raw YAML content. The POC fixture shape
 * wraps everything under a top-level `workflow:` key:
 *
 *   workflow:
 *     id: ...
 *     version: ...
 *     roles: { ... }
 *     steps: [ ... ]
 *
 * Returns the parsed spec or throws WorkflowSpecError on malformed
 * YAML / missing required fields. FR-7: unknown keys at every level
 * are rejected loud against the exported closed keysets above.
 */
export declare function parseWorkflowSpec(rawYaml: string, sourcePath: string): WorkflowSpec;
/**
 * #511 — status of a cached version kept only because unfinished work is pinned to it after its
 * source file disappeared. Readable by name and version; excluded from discovery listings.
 */
export declare const RETAINED_STATUS = "retained";
export declare class WorkflowSpecCache {
    private readonly db;
    private readonly now;
    private readonly hasSpecJsonColumn;
    private readonly hasDiagnosticColumns;
    constructor(db: Database.Database, now?: () => Date);
    /**
     * Read a workflow spec from disk through the cache. Returns the
     * cached row (re-caching if source_hash differs OR if the spec was
     * not previously cached).
     */
    readThrough(sourcePath: string): WorkflowSpecRow;
    /**
     * Cache a deterministic generated spec without manufacturing an authored
     * workflow file.  Lifecycle compilation is read-only; this method is called
     * only by the later instantiate boundary, where the runtime needs the normal
     * spec-cache row for projection and restart recovery.
     */
    putGenerated(spec: WorkflowSpec, sourcePath: string, sourceHash: string): WorkflowSpecRow;
    getByNameVersion(name: string, version: string): WorkflowSpecRow | null;
    /** The cached spec as one INSTANCE sees it: `member@{rig}` targets are
     *  resolved against the instance's bound rig. Use this wherever a running
     *  instance reads its roles; `getByNameVersion` keeps the literal `{rig}`. */
    getForInstance(instance: {
        workflowName: string;
        workflowVersion: string;
        boundRig: string | null;
    }): WorkflowSpecRow | null;
    /**
     * OPR.0.3.3.04.1: resolve a passed identifier to a cached spec's STORED
     * (already-resolved) sourcePath by NAME / cache-key. Returns the source_path
     * of the named valid spec (latest version when several exist), or null when no
     * cached spec carries that name.
     *
     * Used so `workflow instantiate <discovered-name>` works for a fresh operator
     * without a hidden file path: the seeded built-ins are cached by name with the
     * sourcePath the starter-spec-loader already resolved at seed time (e.g.
     * `dist/builtins/workflow-specs/...` in a shipped install). Resolution returns
     * that STORED path verbatim - it does NOT re-derive a path from source-tree
     * assumptions, so it stays production-layout safe (cf. the slice-16
     * source-tree-vs-dist lesson). The `version != ''` guard excludes slice-11
     * diagnostic rows (keyed by file basename with an empty version); valid specs
     * always carry a version (parseWorkflowSpec requires workflow.version). We
     * filter on `version` rather than the slice-11 `status` column so resolution
     * does not depend on a later migration being present.
     */
    resolveSourcePathByName(name: string): string | null;
    /**
     * Lists every cached spec, ordered by name then version. Used by the
     * `GET /api/workflow/specs` endpoint. Cheap —
     * the workflow_specs table is bounded by the number of operator-
     * authored + built-in starter specs (single-host MVP).
     */
    listAll(): WorkflowSpecRow[];
    /**
     * Slice 11 (workflow-spec-folder-discovery) — diagnostic row writer.
     * Used by scanWorkflowSpecFolder when YAML parse / validation fails
     * so the Library UI can render an error row at the same path the
     * user dropped a malformed workflow YAML into. The row's name field
     * falls back to the source file basename so the Library has a
     * stable label even when the YAML couldn't be parsed.
     *
     * One diagnostic row per source_path: writeDiagnostic updates the
     * path's existing diagnostic row (status 'error') or inserts one. It
     * never rewrites a cached valid version, because a running workflow
     * may still read that version by name and version (#503). A passing
     * readThrough removes the path's diagnostic rows, or turns the only
     * row of a never-valid file into the valid row.
     */
    writeDiagnostic(opts: {
        sourcePath: string;
        sourceHash: string;
        errorMessage: string;
    }): void;
    /**
     * Slice 11 — remove cache row by source_path (used when scanner
     * detects a workflow YAML was deleted from disk). Returns the
     * number of rows removed (0 when no row exists for that path).
     */
    /**
     * #511 — an unfinished workflow instance (active, waiting, or failed and still resumable) reads
     * its pinned spec by name and version. Such a version outlives its source file until that work
     * ends. A missing instances table (older harnesses) pins nothing.
     */
    isPinnedByUnfinishedWork(name: string, version: string): boolean;
    /**
     * #511 — the workflow name and version a cached row stands for. A row that a previous
     * diagnostic writer blanked (status error, no version) still carries them in its stored spec.
     */
    storedIdentity(specId: string): {
        name: string;
        version: string;
    } | null;
    /** #511 — keep a pinned version whose file is gone: readable by name and version, hidden from discovery. */
    retain(specId: string): void;
    removeBySpecId(specId: string): number;
    removeBySourcePath(sourcePath: string): number;
    /**
     * OPR.0.3.2.22 Bug 4 — prune cached rows whose source_path lives in
     * noise directories that the post-Bug-4 walkYamlFiles SKIP_DIRS
     * guard now refuses to scan. Without this prune, rows that were
     * inserted before the SKIP_DIRS guard landed would survive forever
     * (the scanner cleanup at spec-library-workflow-scanner.ts only
     * fires for paths starting with the workspace `workflows/` folder
     * prefix). Called once at startup. Returns the number of rows
     * removed.
     *
     * installRoot guard (Bug 4 follow-up): when supplied, rows whose
     * source_path starts with the install root are PRESERVED even if
     * they match a noise pattern. This is the load-bearing safety for
     * shipped built-in workflow specs that live at
     * `<pkg>/dist/builtins/workflow-specs/` in production npm-published
     * daemons — without this guard the unscoped DELETE would nuke
     * every shipped built-in on every boot. Pass
     * `getOpenRigInstallRoot()` from cwd-resolution at the call site.
     * When omitted, no install-root preservation is applied (test-only
     * convenience for tests that operate fully outside any install).
     */
    pruneNoiseDirRows(installRoot?: string): number;
    getByIdOrThrow(specId: string): WorkflowSpecRow;
}
/** Exported for the named honest-degrade test only. */
export declare function resetLegacyRehydrationWarnings(): void;
//# sourceMappingURL=workflow-spec-cache.d.ts.map