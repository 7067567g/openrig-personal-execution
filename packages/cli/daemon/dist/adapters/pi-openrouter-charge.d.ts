import { type PiProviderCharge } from "../domain/openrouter-charge.js";
import type { PiUsageFact } from "../domain/pi-usage-facts.js";
/** Whether a request's credential is established (from pi-readiness judgeChargeProvenance). */
export type ChargeProvenance = {
    ok: true;
    credentialSource: string;
} | {
    ok: false;
    reason: string;
};
export type GenerationReply = {
    status: number;
    body: unknown;
} | {
    status: number;
    malformed: true;
} | {
    status: number;
    tooLarge: true;
} | {
    error: "timeout" | "network";
};
export interface ChargeLookupIo {
    /** GET /api/v1/generation?id=… with the forwarded key. Never throws. */
    fetchGeneration(generationId: string): Promise<GenerationReply>;
    /** POST the outcomes to the daemon; the entry ids it stored or already had (false when the post failed). */
    postCharges(piSessionId: string, charges: PiProviderCharge[]): Promise<ReadonlySet<string> | false>;
    schedule(fn: () => void, ms: number): void;
    /** A line for the seat's pane (an outcome the daemon kept refusing). */
    notice?(line: string): void;
}
/** The largest generation reply read; a larger one is an explicit "unavailable", never parsed. */
export declare const OPENROUTER_REPLY_LIMIT_BYTES: number;
/** The production lookup: GET /api/v1/generation?id=… with the given key, bounded by one timeout that covers the
 *  headers and the body, and by a byte limit on the body. Never throws; the key goes only into the Authorization
 *  header and is scrubbed from the reply. A body cut off by the timeout is a timeout; a complete body that isn't
 *  JSON is "malformed"; a body over the limit is "too large". */
export declare function openRouterGenerationFetcher(key: () => string | undefined, fetchImpl?: typeof fetch | undefined, timeoutMs?: number, limitBytes?: number): (generationId: string) => Promise<GenerationReply>;
export declare const OPENROUTER_CHARGE_MAX_ATTEMPTS = 5;
/** How often an outcome the daemon didn't acknowledge is posted again before it is given up (with a notice). */
export declare const OPENROUTER_CHARGE_MAX_POSTS = 5;
export declare class OpenRouterChargeLookup {
    private readonly io;
    private readonly retryDelaysMs;
    private readonly queue;
    /** Keys queued, being looked up, or finished (stored by the daemon). */
    private readonly known;
    private readonly unposted;
    private running;
    private flushScheduled;
    constructor(io: ChargeLookupIo, retryDelaysMs?: number[]);
    private delay;
    /** Queue the own OpenRouter requests among facts the daemon has stored, each with its credential provenance;
     *  `charged` already have a charge there. */
    enqueue(piSessionId: string, items: Array<{
        fact: PiUsageFact;
        provenance: ChargeProvenance;
    }>, charged: ReadonlySet<string>): void;
    private pump;
    /** Post the outcomes not yet acknowledged, per Pi session. What the daemon didn't acknowledge is posted again
     *  later on its own schedule (never looked up again), up to a cap, then given up with a notice. */
    private flush;
    /** A scheduled post retry on a quiet seat: posts only, never another lookup. */
    private flushAlone;
    private lookUp;
}
//# sourceMappingURL=pi-openrouter-charge.d.ts.map