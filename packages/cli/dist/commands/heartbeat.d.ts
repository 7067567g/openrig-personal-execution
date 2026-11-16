import { Command } from "commander";
export type HeartbeatExecutionState = "checked-out" | "proven-active" | "stalled" | "unproven" | "blocked" | "parked" | "done";
export interface HeartbeatProof {
    at: string;
    ageSeconds: number;
    line: string;
    path: string | null;
}
export interface HeartbeatItem {
    id: string;
    rig: string;
    owner: string;
    session: string;
    title: string;
    queueState: string;
    executionState: HeartbeatExecutionState;
    queueFile: string;
    checkoutAt: string | null;
    checkoutAgeSeconds: number | null;
    lastProof: HeartbeatProof | null;
    blockedOn: string | null;
}
export interface HeartbeatSummary {
    total: number;
    checkedOut: number;
    provenActive: number;
    stalled: number;
    unproven: number;
    blocked: number;
    parked: number;
    done: number;
}
export interface HeartbeatResult {
    generatedAt: string;
    sharedDocsRoot: string;
    rigFilter: string | null;
    windows: {
        firstProofSeconds: number;
        heartbeatSeconds: number;
    };
    summary: HeartbeatSummary;
    items: HeartbeatItem[];
    nudgeResults?: HeartbeatNudgeResult[];
}
export interface HeartbeatNudgeResult {
    id: string;
    session: string;
    executionState: "stalled" | "unproven";
    ok: boolean;
    message: string;
}
interface QueueEntry {
    id: string;
    rig: string;
    owner: string;
    session: string;
    title: string;
    queueState: string;
    queueFile: string;
    meta: Record<string, string>;
    body: string;
}
export interface HeartbeatOptions {
    rig?: string;
    firstProofSeconds?: number;
    heartbeatSeconds?: number;
    includeDone?: boolean;
    now?: Date;
}
export interface HeartbeatDeps {
    sharedDocsRoot?: string;
    env?: NodeJS.ProcessEnv;
    now?: () => Date;
    send?: (session: string, text: string) => Promise<{
        ok: boolean;
        message: string;
    }>;
}
export declare function heartbeatCommand(depsOverride?: HeartbeatDeps): Command;
export declare function analyzeHeartbeat(input: {
    sharedDocsRoot: string;
    rig?: string;
    firstProofSeconds?: number;
    heartbeatSeconds?: number;
    includeDone?: boolean;
    now?: Date;
}): HeartbeatResult;
export declare function parseQueueFile(sharedDocsRoot: string, queueFile: string): QueueEntry[];
export declare function classifyQueueEntry(entry: QueueEntry, opts: {
    now: Date;
    firstProofSeconds: number;
    heartbeatSeconds: number;
}): HeartbeatItem | null;
export declare function sendHeartbeatNudges(items: HeartbeatItem[], send: (session: string, text: string) => Promise<{
    ok: boolean;
    message: string;
}>): Promise<HeartbeatNudgeResult[]>;
export {};
//# sourceMappingURL=heartbeat.d.ts.map