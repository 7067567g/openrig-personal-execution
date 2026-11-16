import { type WorkflowSpecCache } from "../workflow-spec-cache.js";
export interface StarterSpecLoadResult {
    /** Specs newly seeded into the cache during this call. */
    loaded: Array<{
        name: string;
        version: string;
        sourcePath: string;
    }>;
    /** Specs that were already cached (operator override or prior startup). */
    skipped: Array<{
        name: string;
        version: string;
        sourcePathInCache: string;
    }>;
    /** Specs that failed to parse / load — surfaced for diagnostic logging. */
    errors: Array<{
        sourcePath: string;
        code: string;
        message: string;
    }>;
}
export interface StarterSpecLoaderOpts {
    /** Phase D's workflow-spec-cache (already constructed in startup.ts). */
    cache: WorkflowSpecCache;
    /** Absolute directory containing built-in starter spec files (.yaml only at v0). */
    builtinDir: string;
}
/**
 * Walks the builtinDir and seeds each spec file into the cache, skipping
 * those that are already cached for the same (name, version). Idempotent
 * on repeated calls. Returns a structured result for diagnostic logging
 * (which the daemon can log at INFO; tests assert on the shape).
 *
 * If the builtinDir doesn't exist, returns an empty result (no error) —
 * a daemon shipped without bundled starter specs is a valid configuration.
 */
export declare function loadStarterWorkflowSpecs(opts: StarterSpecLoaderOpts): StarterSpecLoadResult;
/**
 * Resolves the default built-in starter directory relative to this
 * loader file's location on disk. Works in both dev (running from
 * `src/`) and prod (running from `dist/`) — the build step copies the
 * workflow spec files to `dist/builtins/workflow-specs/` when bundled
 * specs are present, so the resolved path works in both layouts.
 *
 * Layout: this file is at `<pkg>/{src|dist}/domain/workflow/`. The
 * built-in dir is at `<pkg>/{src|dist}/builtins/workflow-specs/`. Two
 * levels up from this file's dirname is the package's src/ or dist/
 * root.
 */
export declare function defaultBuiltinSpecsDir(): string;
//# sourceMappingURL=starter-spec-loader.d.ts.map