import { type WorkerOptions, type ClassificationCandidates } from "@openrig-local/daemon/stream-classifier";
import type { DaemonClient } from "../client.js";
type Client = Pick<DaemonClient, "get" | "post">;
export interface WakeOptions {
    project: string;
    taxonomy: string;
    classifierVersion: string;
    evidenceEpoch: string;
    decisions?: string;
    limit?: string;
}
type SourceSnapshot = {
    occupant: {
        session: string;
        nodeId: string;
        generation: string;
        rigId: string;
    };
    version: string;
    observedAt: string;
    unavailable: string[];
    sources: {
        project: unknown;
        scopes: {
            id: string;
            source: string;
            hash: string;
        }[];
        roster: {
            session: string;
            nodeId: string;
            generation: string;
        }[];
        recent: {
            streamItemId: string;
            body: string;
            evidenceRef: string;
        }[];
    };
};
declare function localText(file: string): string;
export declare function prepareWorker(client: Client, opts: WakeOptions, read?: typeof localText): Promise<{
    snapshot: SourceSnapshot;
    candidates: ClassificationCandidates;
    taxonomy: {
        version: any;
        source: string;
        hash: string;
        questions: any;
    };
    eligible: {
        items: {
            streamItemId: string;
        }[];
        nextAfterSortKey: string | null;
    };
}>;
/** The receiving entry for one occupant-owned bounded wake. No automatic registration. */
export declare function runProjectWake(client: Client, opts: WakeOptions, read?: typeof localText, experiment?: {
    decide: (prepared: Awaited<ReturnType<typeof prepareWorker>>) => WorkerOptions["classify"];
    signal: AbortSignal;
    shouldStop: () => boolean;
    timeoutMs: number;
}): Promise<{
    occupant: {
        session: string;
        nodeId: string;
        generation: string;
        rigId: string;
    };
    candidateSetVersion: string;
    evidenceEpoch: string;
    result: import("@openrig-local/daemon/stream-classifier").WakeResult;
    nextCommand: null;
    wakeRequest: null;
    registered: boolean;
    sourceSnapshot: SourceSnapshot;
    continuation: string;
} | {
    occupant: {
        session: string;
        nodeId: string;
        generation: string;
        rigId: string;
    };
    candidateSetVersion: string;
    evidenceEpoch: string;
    result: import("@openrig-local/daemon/stream-classifier").WakeResult;
    nextCommand: string[];
    wakeRequest: unknown;
    registered: boolean;
    sourceSnapshot: SourceSnapshot;
    continuation?: undefined;
}>;
export {};
//# sourceMappingURL=project-worker.d.ts.map