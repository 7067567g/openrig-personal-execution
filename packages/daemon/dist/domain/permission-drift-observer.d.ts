import type Database from "better-sqlite3";
import { type PermissionDriftDiagnostic, type PermissionDriftFs } from "./permission-drift.js";
export interface PermissionDriftReader {
    diagnose(nodeId: string): PermissionDriftDiagnostic | null;
}
export declare function loadClaudePermissionModes(): Promise<string[] | null>;
/** Warmed outside request handling; cold reads are immediate UNKNOWN. */
export declare class ClaudePermissionModeCache {
    private readonly load;
    private readonly ttlMs;
    private readonly now;
    private value;
    private loading;
    private loadedAt;
    constructor(load?: () => Promise<string[] | null>, ttlMs?: number, now?: () => number);
    warm(): void;
    read(): string[] | null;
}
type AccessSync = (path: string, mode?: number) => void;
/** Strict, read-only, generation-aware observer for an explicitly requested seat. */
export declare class PermissionDriftObserver implements PermissionDriftReader {
    private readonly input;
    private readonly observations;
    private readonly fs;
    private readonly now?;
    constructor(input: {
        db: Database.Database;
        fs?: PermissionDriftFs;
        now?: () => Date;
        permissionModes?: ClaudePermissionModeCache;
        accessSync?: AccessSync;
    });
    diagnose(nodeId: string): PermissionDriftDiagnostic | null;
}
export {};
//# sourceMappingURL=permission-drift-observer.d.ts.map