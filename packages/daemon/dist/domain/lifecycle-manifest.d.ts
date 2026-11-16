export interface LifecycleMissionMember {
    ref: string;
    normalizedRef: string;
    order: number;
    active: boolean;
    path: string;
}
export declare class LifecycleManifestValidationError extends Error {
    readonly code: string;
    readonly details?: Record<string, unknown> | undefined;
    constructor(code: string, message: string, details?: Record<string, unknown> | undefined);
}
/**
 * The one strict reader for mission composition membership. Read surfaces and
 * scope mutation planning consume this exact parser, so a manifest cannot be
 * actionable in one path and malformed in another.
 */
export declare function validateMissionComposition(mission: unknown, missionPath: string): LifecycleMissionMember[];
//# sourceMappingURL=lifecycle-manifest.d.ts.map