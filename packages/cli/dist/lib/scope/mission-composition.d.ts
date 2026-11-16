export interface MissionSliceMembership {
    ref: string;
    order: number;
    active: boolean;
}
export interface MissionCompositionEdit {
    manifestPath: string;
    original: string;
    updated: string;
}
export declare function planMissionMembershipAdd(missionPath: string, ref: string, order?: number): MissionCompositionEdit | null;
/** Repair only positively unfinished registrations into a fresh union, then verify
 *  this creator's entry. Rename is not compare-and-swap: a later writer can
 *  still supersede a verified snapshot, so completed scaffolds stay on disk. */
export declare function appendMissionMembership(missionPath: string, ref: string): Promise<void>;
export declare function planMissionMembershipRemove(missionPath: string, ref: string): MissionCompositionEdit | null;
export declare function nextMissionMembershipOrder(missionPath: string): number;
/** Replace one or more already-validated manifests with rollback on write error. */
export declare function applyMissionCompositionEdits(edits: MissionCompositionEdit[]): void;
//# sourceMappingURL=mission-composition.d.ts.map