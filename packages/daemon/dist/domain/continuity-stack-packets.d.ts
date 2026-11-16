export interface ContinuitySeatIdentity {
    sessionName: string;
    successorSessionName: string;
    predecessorResumeHandle: string;
    mechanicDestination: string;
}
export declare const RUNG_1_STACK_STEPS: readonly ["create-staged-unbound-successor", "freshness-check", "model-divergence-gate", "world-install", "mission-install", "position-grant", "introduce-yourself"];
export declare function rung1StackSteps(): string[];
export declare function renderRung1Packet(seat: ContinuitySeatIdentity): string;
export declare function renderRung1IncumbentNotice(seat: ContinuitySeatIdentity): string;
export interface Rung2Baton {
    destination: string;
    template: string;
    custodyTable: Array<{
        duty: string;
        holder: string;
        effectReceipt: string;
    }>;
}
export declare function renderRung2Baton(seat: ContinuitySeatIdentity): Rung2Baton;
export declare function validateCustodyRecord(record: {
    claimedAt: "intent" | "effect";
    effectReceipt: string | null;
}): {
    ok: true;
};
export declare function checkStandingDutyCustody(input: {
    deposits: string[];
    custodyTable: string[];
}): {
    missing: string[];
};
export interface GateReceipt {
    gate: string;
    evidence: string;
    worder: string;
}
export declare function validateGateModel(input: {
    receipts: GateReceipt[];
    simplerModel: string | null;
}): {
    ok: true;
    model: "receipts" | "declared-simpler";
};
export declare function renderPostCutoverPacket(seat: ContinuitySeatIdentity): string;
export declare function readyCheck(input: {
    expectedModel: string;
    liveModel: string;
    sessionName: string;
}): {
    ok: boolean;
    reason: string | null;
};
export interface WidthRecoveryReceipt {
    postRestoreUsedPercentage: number;
    postRestoreUsableWidthPercentage: number;
    saturationBoundPercentage: number;
    widthRecovered: boolean;
    reason: "usable_width_recovered" | "restore_replayed_past_saturation_bound";
}
export declare function buildWidthRecoveryReceipt(input: {
    usedPercentage: number;
    maximumUsablePercentage: number;
}): WidthRecoveryReceipt;
//# sourceMappingURL=continuity-stack-packets.d.ts.map