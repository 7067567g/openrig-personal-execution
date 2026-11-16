import type { ClassificationDecision, ClassificationRequest } from "@openrig-local/daemon/stream-classifier";
import type { prepareWorker } from "./project-worker.js";
export declare const JEV_ENDPOINT = "https://openrouter.ai/api/alpha/decisions";
export declare const JEV_MODEL = "typesafe/jev-1.13";
export interface ExperimentConfig {
    enabled: boolean;
    maxRequests: number;
    timeoutMs: number;
}
export declare const DEFAULT_EXPERIMENT: ExperimentConfig;
export type ChoiceQuestion = {
    type: "choice";
    instructions: string;
    criteria: Record<string, string>;
};
type Answers = Record<string, {
    type: "choice";
    choice: string;
    confidence: number;
    probabilities: Record<string, number>;
}>;
export type JevResult = {
    status: "answered";
    answers: Answers;
    model: string;
} | {
    status: "unavailable";
    reason: string;
};
export declare function readBounded(file: string, limit?: number): string;
export declare function readExperiment(file: string, read?: typeof readBounded): ExperimentConfig;
export declare function setExperiment(file: string, enabled: boolean, options?: Partial<ExperimentConfig>): {
    enabled: boolean;
    maxRequests: number;
    timeoutMs: number;
};
export declare function experimentStatus(file: string, read?: typeof readBounded): {
    endpoint: string;
    model: string;
    credential: string;
    requestBytes: number;
    responseBytes: number;
    retries: number;
    providerPriceCeiling: {
        prompt: number;
        completion: number;
        request: number;
    };
    note: string;
    enabled: boolean;
    maxRequests: number;
    timeoutMs: number;
    experimental: boolean;
    advisoryOnly: boolean;
    configFile: string;
};
/** Concrete bounded client, owned by the invoking occupant, never constructed in daemon startup. */
export declare class JevRun {
    private readonly file;
    private readonly read;
    private readonly send;
    readonly controller: AbortController;
    readonly config: ExperimentConfig;
    calls: number;
    lastResult: JevResult | null;
    private halt;
    private pending;
    private readonly key;
    constructor(file: string, read?: typeof readBounded, env?: NodeJS.ProcessEnv, send?: typeof fetch);
    stop: () => void;
    stopped: () => boolean;
    status(): {
        experimental: boolean;
        advisoryOnly: boolean;
        calls: number;
        maxRequests: number;
        stopped: boolean;
        reason: string | null;
        pending: boolean;
        lastResult: JevResult | null;
    };
    request(state: unknown, questions: Record<string, ChoiceQuestion>, signal?: AbortSignal): Promise<JevResult>;
}
export declare function validateJev(x: unknown, questions: Record<string, ChoiceQuestion>): Extract<JevResult, {
    status: "answered";
}>;
export declare function streamDecision(run: JevRun, prepared: Awaited<ReturnType<typeof prepareWorker>>): (request: ClassificationRequest, signal: AbortSignal) => Promise<ClassificationDecision>;
export declare const CAPTURE_QUESTIONS: {
    state: ChoiceQuestion;
};
export declare function classifyCapture(run: JevRun, observation: unknown): Promise<{
    experimental: boolean;
    status: string;
    reason: string;
    advisoryOnly?: undefined;
    attemptId?: undefined;
    binding?: undefined;
    captureHash?: undefined;
    delivery?: undefined;
    deliveryReason?: undefined;
    result?: undefined;
} | {
    experimental: boolean;
    advisoryOnly: boolean;
    attemptId: string;
    binding: Record<string, any>;
    captureHash: string;
    delivery: string;
    deliveryReason: string;
    result: JevResult;
    status?: undefined;
    reason?: undefined;
}>;
export {};
//# sourceMappingURL=project-jev.d.ts.map