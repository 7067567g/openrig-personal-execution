import type Database from "better-sqlite3";
export type TelemetryStream = "events" | "queue-transitions" | "tenures";
export interface TelemetrySource {
    hostId: string | null;
    bootEpoch: string | null;
}
export interface TelemetryRead {
    cursor?: string;
    start?: string;
    limit?: string;
    nodeId?: string;
    rigId?: string;
    qitemId?: string;
}
export declare const TELEMETRY_LIMITS: {
    readonly rows: 128;
    readonly responseBytes: number;
    readonly recordBytes: 4096;
    readonly cursorBytes: 2048;
};
type Gap = {
    code: string;
    id?: string;
    field?: string;
    from?: string;
    through?: string;
};
export declare class TelemetryInputError extends Error {
}
export declare const TELEMETRY_PAGE_SQL: {
    events: string;
    active: string;
    archive: string;
    tenures: string;
};
/** One read snapshot and a finite source prefix. No writes, subscription or catch-up loop. */
export declare function readTelemetryPage(db: Database.Database, source: TelemetrySource, stream: TelemetryStream, input: TelemetryRead, observedAt?: string): {
    schemaVersion: number;
    stream: TelemetryStream;
    observedAt: string;
    source: {
        hostId: string | null;
        bootEpoch: string;
        sequenceSpaceId: null;
    };
    rows: Record<string, string | null>[];
    page: {
        requestedAfter: string | null;
        requestedBefore: string | null;
        lastScanned: string;
        through: string;
        retainedHighWatermark: string;
        hasMore: boolean;
        nextCursor: string | null;
        restartCursor: string | null;
        fetched: number;
        scanned: number;
        filtered: number;
        withheld: number;
        returned: number;
        capReason: string | null;
    };
    coverage: {
        status: string;
        historyCompleteness: string;
        retainedMinimum: string | null;
        gaps: Gap[];
        gapCount: number;
        gapDetailsTruncated: boolean;
        eventPayloads: string;
    };
};
export {};
//# sourceMappingURL=finite-telemetry.d.ts.map