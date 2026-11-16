import type Database from "better-sqlite3";
import type { NodeInventoryEntry } from "./types.js";
import { CaptureObserver } from "./capture-observer.js";
export interface ShadowConfig {
    destination: string;
    maxRecords: number;
    maxBytes: number;
    capacity: number;
    maxQueuedBytes: number;
    maxObservationBytes: number;
}
export interface ShadowWriter {
    append(bytes: string): Promise<void>;
    close(): Promise<void>;
}
export declare class ShadowCapture {
    readonly config: ShadowConfig;
    private readonly open;
    readonly observer: CaptureObserver;
    private writer?;
    private written;
    private bytes;
    private completedRecords;
    private completedBytes;
    private dropped;
    private sinkErrors;
    private error;
    private stopped;
    private collecting;
    private activeDrain?;
    private stopping?;
    constructor(config: ShadowConfig, open?: (destination: string) => Promise<ShadowWriter>);
    drain(): Promise<{
        enabled: boolean;
        config: ShadowConfig;
        observer: import("./capture-observer.js").CaptureObserverStats;
        sink: {
            reservedRecords: number;
            reservedBytes: number;
            completedRecords: number;
            completedBytes: number;
            dropped: number;
            errors: number;
            stopped: boolean;
            error: string | null;
        };
    }>;
    /** Disable immediately, then finish the finite retained queue before closing. */
    stop(): Promise<{
        enabled: boolean;
        config: ShadowConfig;
        observer: import("./capture-observer.js").CaptureObserverStats;
        sink: {
            reservedRecords: number;
            reservedBytes: number;
            completedRecords: number;
            completedBytes: number;
            dropped: number;
            errors: number;
            stopped: boolean;
            error: string | null;
        };
    }>;
    status(): {
        enabled: boolean;
        config: ShadowConfig;
        observer: import("./capture-observer.js").CaptureObserverStats;
        sink: {
            reservedRecords: number;
            reservedBytes: number;
            completedRecords: number;
            completedBytes: number;
            dropped: number;
            errors: number;
            stopped: boolean;
            error: string | null;
        };
    };
}
/** Source-only opt-in. Missing/invalid configuration never creates a sink or collects bytes. */
export declare function configureShadowCapture(raw: string | undefined): {
    capture?: ShadowCapture;
    error?: string;
};
/** Inventory has its own probe path. Resolve labels synchronously before that probe awaits. */
export declare function inventoryCaptureOptions(db: Database.Database, capture?: ShadowCapture): {
    captureObserver?: undefined;
    observationBinding?: undefined;
} | {
    captureObserver: CaptureObserver;
    observationBinding: (entry: NodeInventoryEntry) => {
        nodeId: string;
        pane: string | null;
        occupant: string | null;
    };
};
//# sourceMappingURL=shadow-capture.d.ts.map