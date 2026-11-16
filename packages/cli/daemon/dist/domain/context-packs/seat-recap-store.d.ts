export declare const RECAP_FILENAME = "RECAP.md";
export declare class RecapWriteError extends Error {
    constructor(message: string);
}
export interface RecapChainEntry {
    /** Absolute path of the superseded recap. */
    path: string;
    /** The supersession timestamp encoded in the filename (ms epoch). */
    supersededAtMs: number;
    /** Same-millisecond disambiguator (1 for the bare name, 2+ for -N suffixes). */
    sequence: number;
}
/** Write the seat's current recap, superseding any existing one into the
 *  chain. The gate is ADDRESSABILITY only — never prose shape. */
export declare function writeSeatRecap(opts: {
    seatDir: string;
    content: string;
    now?: () => number;
}): void;
/** The superseded chain, oldest first. Empty when no recap was ever superseded. */
export declare function listRecapChain(seatDir: string): RecapChainEntry[];
export type RecapContractFinding = {
    kind: "no-decisions-section";
} | {
    kind: "nonstandard-unverified-marker";
    line: number;
};
/** The authoring contract's CHECKABLE subset (Q2): decisions-with-rationale has
 *  a structural proxy (a decisions-titled section exists); the UNVERIFIED
 *  marker has a canonical grammar (`UNVERIFIED:` uppercase) that must stay
 *  findable — a variant marker hides exactly the fact it exists to flag.
 *  Advisory: findings, never throws. */
export declare function validateRecapContract(content: string): RecapContractFinding[];
/** BUILD FOLLOW-UP (r1 verdict bb00e850; row 17015088) — the authored-recap
 *  pointer resolution, ONE-HOMED here beside the store it reads, parsing the
 *  seat ref through the CANONICAL parseSessionName (first-@ split, the
 *  documented greedy-rig ruling) — never a second parser. Safety floor
 *  preserved: an unresolved or non-canonical ref fails with a LABELED reason
 *  carrying what was tried; fuzzy-matching another seat's directory would hand
 *  a successor a DIFFERENT occupant's decisions, which is strictly worse than
 *  honest absence. */
export declare function resolveAuthoredRecapPointer(seatRef: string, topologyRoot: string): {
    address: string;
    chainLength: number;
} | {
    absentReason: string;
};
//# sourceMappingURL=seat-recap-store.d.ts.map