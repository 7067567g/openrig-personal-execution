export type MirrorDriftSafeResult = {
    ok: true;
    skipped: false;
    stale: boolean;
    changes: string[];
} | {
    ok: true;
    skipped: true;
    reason: string;
} | {
    ok: false;
    reason: string;
};
export declare function checkMirrorDriftSafe(repoRoot?: string): Promise<MirrorDriftSafeResult>;
//# sourceMappingURL=skill-mirror-drift.d.ts.map