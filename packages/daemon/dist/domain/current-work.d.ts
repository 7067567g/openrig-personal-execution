/**
 * OPR.0.5.8.14 — derive the seat's current work node from the queue rows it holds.
 *
 * The only consumer today is `queue whoami`, which refocus reads so a returning agent
 * gets the intent of the mission and slice it actually owns. The derivation is
 * deliberately refusal-first: it answers ONLY when the seat's typed rows point at exactly
 * one work node. Anything else returns null with a named basis, because a guessed work
 * node is worse than an honest gap — it silently re-points a whole refocus at the wrong
 * outcome.
 *
 * Two properties are load-bearing and neither is obvious from the tag alone:
 *
 * 1. The canonical queue tags are `mission:<directory>` + `slice:<dot-id>`, e.g.
 *    `mission:release-0.5.8` + `slice:OPR.0.5.8.14`. All new handoffs use that pair.
 *    Some historical rows tag the mission by its SPEC frontmatter id instead, so the
 *    mission join also accepts that legacy form purely for compatibility — refusing an
 *    existing row would be the guess-refusal firing on good data. The legacy form is
 *    never the convention to reach for and is labelled as compat wherever it surfaces.
 *    (orch-lead ruling relayed 2026-09-01 09:43Z.)
 *
 * 2. There are two ambiguity checks and they run in a deliberate order.
 *
 *    WITHIN a row, a malformed baton is rejected up front, before any resolution: a row
 *    carrying two different mission values (or two different slice values) is not a
 *    well-formed baton at all, and rejecting malformed input is this module's job. Those
 *    rows never reach resolution.
 *
 *    ACROSS rows, resolution runs BEFORE counting and is failure-first. If every typed
 *    row resolves, ambiguity is judged on the resolved NODES rather than the raw tag
 *    strings, so two rows naming one slice through different forms collapse to one piece
 *    of work instead of reading as a conflict. But if any typed row fails to resolve, the
 *    answer is a refusal — an unresolved baton is unknown, not irrelevant, and letting the
 *    rows that happened to resolve carry the answer is precisely the guess this module
 *    exists to prevent. A basis-string disclosure does not discharge it: consumers read
 *    workNodePath, not the prose beside it.
 *
 *    Note the resolve-then-compare machinery below COULD tell you that two spellings name
 *    one directory. The within-row check does not use it, and that is a choice about what
 *    a valid baton is, not a limitation.
 */
import type Database from "better-sqlite3";
export interface RoleOrientation {
    state: "unknown" | "no-record" | "not-declared" | "missing" | "present";
    reason?: string;
    recordedAt?: string;
    note?: string;
    files: Array<{
        path: string;
        absolutePath: string;
        ownerRoot: string;
        resolvedPath: string;
        resolvedOwnerRoot: string;
        state: "present" | "missing" | "unknown";
    }>;
}
/** Read the caller's explicit role bindings, not startup content or a guessed basename. */
export declare function deriveRole(db: Database.Database | undefined, nodeId: string | null): RoleOrientation;
type MatchForm = "directory name" | "frontmatter id";
export interface CurrentWork {
    mission: string;
    slice: string;
    workNodePath: string;
    basis: string;
}
export interface CurrentWorkDerivation {
    currentWork: CurrentWork | null;
    /** Always present. Names why the answer is what it is, including every refusal. */
    currentWorkBasis: string;
}
interface TaggedRow {
    state?: string | null;
    tags?: string[] | null;
    /** Optional, but the production call site passes full queue items so it is populated
     *  there. A refusal that names the offending ROW is one command from actionable; one
     *  that names only the values leaves the reader to go find which row meant it. */
    qitemId?: string | null;
}
interface Match {
    dir: string;
    form: MatchForm;
}
/**
 * Directories directly under `root` addressed by `wanted` — either because the directory
 * is named that, or because its SPEC.md frontmatter `id` is that. A directory can only
 * match once, so a name hit short-circuits its own frontmatter read.
 */
export declare function resolveWorkNodeDirs(root: string, wanted: string): Match[];
export declare function deriveCurrentWork(rows: TaggedRow[], missionsRoot: string | null): CurrentWorkDerivation;
/**
 * OPR.0.7.0.12 — labelled work candidates, BESIDE the strict derivation above, never
 * loosening it. deriveCurrentWork answers "which one node is this seat's work" and refuses
 * anything short of certainty; this answers "what evidence does the queue hold", so the
 * refocus packet can show it and let the AGENT decide. Nothing here picks a winner:
 * candidates are evidence the agent may correct, and the absence of evidence is reported as
 * such rather than filled with the project root.
 *
 * - An in-progress row's own `mission:` tag (with or without `slice:`) is a direct candidate,
 *   labelled with that tag as its source. A tag that does not resolve on this host is named,
 *   never swapped for a same-named directory found some other way.
 * - An in-progress row with no mission tag offers its handoff ancestry: the nearest local
 *   ancestor's mission tag, as a labelled candidate. A retargeted handoff (new body, no tags)
 *   or an ancestor that is not on this host gives no assumed mission.
 * - Pending rows are possible next work; blocked rows are held work with their blocker and
 *   continuation. No order is implied between them.
 * - A mission named only in body text is never evidence.
 */
export interface WorkCandidate {
    kind: "tag" | "ancestry";
    qitemId: string | null;
    mission: string;
    slice: string | null;
    /** The slice node when the slice resolves, else the mission node; null when the mission does not. */
    workNodePath: string | null;
    intent: string | null;
    source: string;
    /** Why the tag did not fully resolve on this host, when it did not. */
    unresolved: string | null;
}
export interface WorkCandidates {
    missionsRoot: string | null;
    candidates: WorkCandidate[];
    /** In-progress rows whose work the queue cannot name. */
    unknown: Array<{
        qitemId: string | null;
        summary: string | null;
        reason: string;
    }>;
    next: Array<{
        qitemId: string | null;
        summary: string | null;
        missions: string[];
    }>;
    held: Array<{
        qitemId: string | null;
        summary: string | null;
        blockedOn: string | null;
        continuation: string | null;
    }>;
    /** Mission directories on this host, bounded, so an agent can name one without guessing. */
    missionsOnHost: string[];
    missionsOnHostTruncated: boolean;
}
interface CandidateRow extends TaggedRow {
    summary?: string | null;
    body?: string | null;
    blockedOn?: string | null;
    handedOffFrom?: string | null;
    chainOfRecord?: string[] | null;
}
export interface WorkCandidateLookups {
    /** A row by id on this host, or null when it is not here (remote or removed). */
    getRow: (qitemId: string) => CandidateRow | null;
    /** The recorded park continuation of a blocked row, or null. */
    continuationOf: (qitemId: string) => string | null;
}
/**
 * The one-line `intent:` from SPEC.md frontmatter, read the way trace-to-root.py's `intent()`
 * reads it: a block scalar (`>-`, `|`, …) joins its indented lines with spaces, and wrapping
 * quotes are removed. parseFrontmatter is line-by-line and would return the indicator itself.
 */
export declare function frontmatterIntent(raw: string): string | null;
export declare function deriveWorkCandidates(rows: CandidateRow[], missionsRoot: string | null, lookups: WorkCandidateLookups): WorkCandidates;
export {};
//# sourceMappingURL=current-work.d.ts.map