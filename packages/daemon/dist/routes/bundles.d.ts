import { Hono } from "hono";
import { type ConformanceResult } from "../domain/spec-live-conformance.js";
import type { RigRepository } from "../domain/rig-repository.js";
export declare const bundleRoutes: Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
/**
 * Build B — compare the spec about to be exported against the RUNNING rig of the same name.
 *
 * The assembler copies the spec text VERBATIM into the bundle and never reads the live DB, so a rig
 * expanded at runtime (nothing writes the spec back) exports as the smaller, stale topology in
 * complete silence. This says the delta out loud.
 *
 * Returns null — and the caller then says nothing at all — when there is genuinely nothing to
 * report: no repo, a spec whose rig is not running (authoring a NEW rig is not drift), or agreement.
 * Reporting only: never mutates, never blocks, never throws into the export path.
 */
export declare function describeSpecLiveDrift(rawParsed: unknown, rigRepo: RigRepository | undefined): string | null;
/**
 * The same comparison as `describeSpecLiveDrift`, returned STRUCTURED rather than as a sentence.
 *
 * Null means there is genuinely nothing to compare: no repository, a spec with no `name:`, a shape
 * that is neither pod-aware nor legacy, or no rig of that name on record. Those are all honest
 * absences of a comparison.
 *
 * A REPOSITORY OR QUERY FAILURE IS NOT ONE OF THEM AND PROPAGATES. The reporting helper above may
 * swallow it, because the worst case there is a missing banner. Enforcement may not: translating a
 * failed DB read into "no drift" would let the export proceed on the strength of a comparison that
 * never happened, which is the fail-open this guard exists to remove. Callers fail closed.
 */
export declare function assessSpecLiveDrift(rawParsed: unknown, rigRepo: RigRepository | undefined): ConformanceResult | null;
/**
 * Does this spec describe a different rig than the one on record — in EITHER direction?
 *
 * An earlier revision refused only the drop direction, on the reasoning that a spec declaring MORE
 * than is live is a bundle whose job is to bring the rest up. That was wrong, and the reason is what
 * the DB rows actually are: `nodes` is the rig's PERSISTED topology, not a list of currently-running
 * sessions. A restore that brings up seats the spec never declared produces a different rig just as
 * surely as one that drops them. Direction is not the test; disagreement is. `--allow-drift` is the
 * honest way through for an operator who means it.
 */
export declare function specDivergesFromLive(result: ConformanceResult | null): boolean;
/** The refusal an operator can act on: what disagrees, and the way through. */
export declare function bundleExportRefusal(result: ConformanceResult): string;
//# sourceMappingURL=bundles.d.ts.map