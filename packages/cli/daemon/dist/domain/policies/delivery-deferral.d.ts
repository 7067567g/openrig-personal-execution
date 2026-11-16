import type { QueueRepository } from "../queue-repository.js";
import type { WatchdogJobsRepository } from "../watchdog-jobs-repository.js";
import type { Policy } from "./types.js";
export declare const DELIVERY_DEFERRAL_POLICY = "delivery-deferral";
export declare const DELIVERY_DEFERRAL_ARMED_PREFIX = "delivery-deferral-armed";
export declare const DELIVERY_DEFERRAL_FIRED_PREFIX = "delivery-deferral-fired";
export interface ArmDeliveryDeferralInput {
    jobsRepo: WatchdogJobsRepository;
    queueRepo: QueueRepository;
    qitemId: string;
    entityId: string;
    minutes: number;
    notificationKey?: string;
    now?: Date;
}
/** Arm the one-shot deferral. Idempotent per notification key: an already-armed
 *  live deferral for the same episode is returned, never duplicated (the
 *  exactly-once half of AM-F3 — one delivery at T, never immediate-plus-deferred). */
export declare function armDeliveryDeferral(input: ArmDeliveryDeferralInput): {
    jobId: string;
};
export interface FireDeliveryDeferralInput {
    jobsRepo: WatchdogJobsRepository;
    queueRepo: QueueRepository;
    jobId: string;
    /** R1 B-3: the EPISODE key rides the fire so the Slice 14 receipt lands
     *  current-episode-exact — never the bare-qitemId fallback. */
    deliverInterrupt: (qitemId: string, notificationKey: string) => Promise<{
        ok: boolean;
    }>;
    now?: Date;
}
/** Fire the deferral iff due — v3 (dual-rebind repair, R1 76a8cfd1 + R2
 *  003f4786): the LOCKED contract is exactly-once at T+30, never zero, never
 *  two. The job stays ACTIVE (the redrive) until the episode's own posted
 *  receipt is OBSERVED on the row; only that observation writes the fired
 *  transition and the terminal state. Delivery rides a durable episode-stable
 *  decision id (`deferral:<key>`), so a replayed pending decision and a
 *  re-dispatch converge on one post; a death anywhere before the receipt
 *  leaves the ACTIVE job to redrive after reconstruction. */
export declare function fireDeliveryDeferralIfDue(input: FireDeliveryDeferralInput): Promise<{
    fired: boolean;
}>;
/** Watchdog-engine policy wrapper (additionalPolicies injection, the
 *  parked-owner-consumer wiring precedent). The engine's scheduler cadence
 *  drives evaluation; the due arithmetic above owns the timing. */
export declare function makeDeliveryDeferralPolicy(deps: {
    jobsRepo: WatchdogJobsRepository;
    queueRepo: QueueRepository;
    deliverInterrupt: (qitemId: string, notificationKey: string) => Promise<{
        ok: boolean;
    }>;
}): Policy;
//# sourceMappingURL=delivery-deferral.d.ts.map