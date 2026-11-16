import type { LockedArtifact } from "../review/types.js";
/**
 * Derive the ordered, deduped `locked-artifacts` set for a slice plan-lock.
 * @param nodeContent current authored node content (SPEC.md, or legacy README.md).
 * @param prd legacy IMPLEMENTATION-PRD content; null when absent.
 * @param nodeFileName current node filename; SPEC.md for new work.
 */
export declare function derivePlanLockArtifacts(nodeContent: string | null, prd: string | null, nodeFileName?: "SPEC.md" | "README.md"): LockedArtifact[];
/**
 * True when a DERIVED plan-lock set would freeze nothing anybody authored: the set is only the
 * unconditional node pin, and the node file is missing or still shipped-template scaffold (no authored
 * intent prose, no authored mini-req, no authored proof-contract row — the ONE scaffold grammar).
 *
 * A plan-lock's entire meaning is "THIS artifact set is what gets built"; letting the default pin a
 * placeholder writes the strongest structural claim in the SDLC with content nobody chose. Two live
 * locks did exactly that before this check existed. Approve refuses on this predicate unless the
 * stamper names the set explicitly.
 */
export declare function isContentlessPlanLockSet(nodeContent: string | null, artifacts: LockedArtifact[]): boolean;
//# sourceMappingURL=plan-lock-artifacts.d.ts.map