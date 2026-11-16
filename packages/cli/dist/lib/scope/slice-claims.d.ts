/** One persistent claim reserves the ordinal and records unfinished registration. */
export declare function tryClaimSliceNN(missionPath: string, nn: number, ref: string): boolean;
/** Older unlisted folders and verified registrations are never adopted. */
export declare function pendingCompletedSliceRefs(missionPath: string): string[];
/** Retire pending evidence after observing registration, including a repaired peer.
 * A stale manifest rename after this observation is not automatically repaired. */
export declare function markSliceRegistrationsVerified(missionPath: string, refs: string[]): void;
//# sourceMappingURL=slice-claims.d.ts.map