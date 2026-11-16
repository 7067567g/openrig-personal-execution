import type { ContextPackManifest } from "./context-pack-types.js";
/** A plain eval-case object in the harness's declarative format. The harness's
 *  validateEvalCase is the authority on this shape; the bridge emits data. */
export type CompiledEvalCaseData = Record<string, unknown>;
/**
 * Compile every probed atom of a manifest into behavior-category eval-case
 * data. Atoms without probes are skipped (a probe is acceptance evidence,
 * not an obligation). Case ids are namespaced by the pack ref so cases from
 * multiple packs never collide in one harness run.
 *
 * The mapping, field by field:
 *   id               <- <packRef>/<atomId>
 *   name             <- the probe's expect (the observable-behavior contract
 *                       IS the case's human name — what a grader reads first)
 *   category         <- "behavior"
 *   prompt           <- probe.prompt (the natural prompt, mini-req 2)
 *   expectedPatterns <- probe.expectedPatterns (the deterministic door leg;
 *                       validated compilable at manifest ingest)
 *   rubric           <- probe.rubric, else the expect prose (the judged leg
 *                       always has at least the behavior contract to judge by)
 */
export interface CompiledProbeCases {
    cases: CompiledEvalCaseData[];
    /** Probes that could not become harness cases, WITH reasons — a bound the
     *  caller must surface (no silent caps): a probe without expectedPatterns
     *  has no deterministic-door leg, and the bridge refuses both to fabricate
     *  a pattern from prose and to lose the atom silently. */
    skipped: Array<{
        atomId: string;
        reason: string;
    }>;
}
export declare function compileAtomProbesToEvalCases(manifest: ContextPackManifest, packRef: string): CompiledProbeCases;
//# sourceMappingURL=probe-eval-bridge.d.ts.map