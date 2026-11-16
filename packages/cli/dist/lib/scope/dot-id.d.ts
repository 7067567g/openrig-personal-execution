import type { DotId } from "./types.js";
/** Default project prefix for the OpenRig single-project workspace.
 *  Multi-project work waits for a real second project (convention §1). */
export declare const DEFAULT_PROJECT_PREFIX = "OPR";
/** Parse a dot-ID string into structured parts; returns null when the
 *  string doesn't conform to the §1 positional grammar. When `tier`
 *  is supplied, the trailing segments are peeled off into `n` (slice)
 *  or `n` + `m` (sub-slice). With no tier, all numeric segments are
 *  returned as `version` for backwards compatibility. */
export declare function parseDotId(raw: string, tier?: "mission" | "slice" | "sub-slice"): DotId | null;
/** Depth-based tier discriminator. Per §1 the positional grammar
 *  is fixed:
 *    mission   = <PFX>.<ver>           (ver = 2-3 numeric segments;
 *                                       escape band is exactly 99.0.n)
 *    slice     = <PFX>.<ver>.<n>       (3-4 numeric segments)
 *    sub-slice = <PFX>.<ver>.<n>.<m>   (4-5 numeric segments)
 *  Where a mission shape OVERLAPS with a slice shape (e.g. release
 *  X.Y mission has 2 segments; release X.Y.Z mission has 3 segments
 *  which is also the slice shape for release X.Y missions) the tier
 *  is resolved by depth: mission caps at 3 numeric segments; slice
 *  always has 3-4; sub-slice has 4-5. Escape band is fully unambiguous
 *  because §1 fixes both the 99 marker AND the 0 segment that follows. */
export declare function isMissionDotId(raw: unknown): boolean;
export declare function isSliceDotId(raw: unknown): boolean;
/** Render a DotId back to its canonical dot-string. */
export declare function formatDotId(id: DotId): string;
/** Compose a slice ID by appending an ordinal to a parent mission ID. */
export declare function sliceIdFromMission(missionId: string, n: number): string;
/** Infer the (project, version) pair from a mission folder name when
 *  no explicit id is supplied. Release missions use their semver; any
 *  other name falls into the escape band where the caller supplies the
 *  next ordinal via the second arg. */
export declare function inferMissionDotId(missionFolderName: string, escapeBandOrdinal: number | null, projectPrefix?: string): string;
/** Pick the next escape-band ordinal by scanning peer mission IDs.
 *  Looks for `<PFX>.99.0.<m>` shapes and returns max(m)+1, starting
 *  at 1 when no peer exists. */
export declare function nextEscapeBandOrdinal(existingIds: ReadonlyArray<string | null>, projectPrefix?: string): number;
/** Does this candidate string parse as a valid §1 dot-ID at ANY
 *  tier? Prefer the tier-specific isMissionDotId/isSliceDotId at use
 *  sites where the tier is known — depth alone doesn't disambiguate
 *  mission vs slice for release IDs with overlapping shapes. */
export declare function isConformantDotId(raw: unknown): boolean;
//# sourceMappingURL=dot-id.d.ts.map