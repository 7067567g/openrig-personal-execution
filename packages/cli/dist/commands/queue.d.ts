import { Command } from "commander";
import { DaemonClient } from "../client.js";
import type { StatusDeps } from "./status.js";
/**
 * `rig queue` — coordination primitive L3/inbox/outbox commands (PL-004 Phase A).
 *
 * Backed by `/api/queue`. Operates only via the daemon HTTP API.
 * Does NOT touch the POC `rigx-queue-proto` filesystem state.
 *
 * Hot-potato strict-rejection is enforced at the daemon; `update --state done`
 * without `--closure-reason` returns exit 1 with structured error naming the
 * 6 valid closure reasons.
 */
export interface DeliveryVerifyDeps {
    timeoutMs?: number;
    intervalMs?: number;
    sleep?: (ms: number) => Promise<void>;
    now?: () => number;
}
export interface QueueDeps extends StatusDeps {
    deliveryVerify?: DeliveryVerifyDeps;
}
interface DeliveryResultBase {
    /** human: a human-seat or @external address, a row the gateway owns, or a seat the gateway also
     *  posts to (a registered person with a pane). agent: any other seat. */
    destinationKind: "agent" | "human";
    /** Human destinations only. No receipt can prove that a person read the message. */
    humanReadership?: "unknown";
    detail?: string;
    nextAction: string | null;
}
/** The gateway (Slack connector) owns delivery; its ledger is the receipt. */
export interface GatewayDeliveryResult extends DeliveryResultBase {
    receiptSource: "gateway";
    outcome: "posted" | "transport-failed" | "never-posted" | "still-pending" | "indeterminate";
    /** null means no receipt can presently settle connector acceptance. */
    connectorAccepted: boolean | null;
    /** #96: present for a --reply-to update once posted; false = it posted top-level instead. */
    threaded?: boolean;
}
/** A terminal wake: the row's lastNudgeResult is the receipt, and a claim is the pickup. */
export interface TerminalDeliveryResult extends DeliveryResultBase {
    receiptSource: "terminal";
    /** The class of wakeResult: verified; delivered-ack-pending; claimed (a claimed row whose wake wasn't confirmed);
     *  retained:*; failed:* or unroutable:* (failed); indeterminate:* or an unrecognised value (indeterminate); none yet
     *  (still-pending); or no wake requested by --no-nudge (not-requested). */
    outcome: "verified" | "delivered-ack-pending" | "claimed" | "retained" | "failed" | "indeterminate" | "still-pending" | "not-requested";
    /** The row's lastNudgeResult as recorded; null before any wake result. */
    wakeResult: string | null;
    /** A claim shows the seat took the item; it does not prove the body was read.
     *  pickup is the daemon's derived pickup receipt state, as the row reports it. */
    claim: {
        observed: boolean;
        claimedAt: string | null;
        pickup: string | null;
    };
    /** Present when the gateway may also post this row: a registered person who is also a seat with
     *  its own pane. The Slack receipt, kept apart from the terminal side; posted is not read. */
    gateway?: GatewayReceipt;
}
export type VerifiedDeliveryResult = GatewayDeliveryResult | TerminalDeliveryResult;
export interface DeliveryVerifyTarget {
    destinationSession?: string;
    /** false when the create passed --no-nudge: no wake was requested, so none is awaited. */
    nudge?: boolean;
}
type QueueRow = Record<string, unknown>;
/** The gateway (Slack connector) receipt on the row, in one place for both result shapes. */
interface GatewayReceipt {
    outcome: "posted" | "transport-failed" | "never-posted" | "still-pending";
    connectorAccepted: boolean | null;
    detail?: string;
}
/** The receipt could not be read or correlated: say which part is unknown, nothing more. */
export declare function unreadableDeliveryResult(qitemId: string | null, destination: string | null, row: QueueRow, reason: string): VerifiedDeliveryResult;
export declare function waitForDeliveryOutcome(client: Pick<DaemonClient, "get">, qitemId: string, deps?: DeliveryVerifyDeps, target?: DeliveryVerifyTarget): Promise<VerifiedDeliveryResult>;
export interface BodyPreview {
    preview: string;
    bodyBytes: number;
    bodyTruncated: boolean;
}
export declare function previewBody(body: string, maxCodePoints?: number): BodyPreview;
export interface ResolveBodyOpts {
    body?: string;
    bodyFile?: string;
}
export declare function defaultStdinReader(): Promise<string>;
export declare function resolveQueueBody(opts: ResolveBodyOpts, stdinReader?: () => Promise<string>): Promise<string>;
/**
 * OPR.0.4.6.MH3 D-3 (C3): resolve a queue DESTINATION operand + optional
 * explicit `--host` into the out-of-band request envelope (BR-1 — the session
 * string that leaves the CLI stays 2-part `member@rig`; the host rides
 * `hostId`; the 3-part string NEVER leaves the CLI edge).
 *
 * The queue parse rule (arch-ruled — deliberately DIFFERENT from the
 * interactive verbs' strip-iff-registered rule): queue destinations are
 * CANONICAL-ONLY by construction (the daemon's validateRig rejects any
 * non-canonical parse), so the strip is UNCONDITIONAL after the human-seat
 * classifier — a mistyped host dies loud with the HOST named (unknown-host)
 * instead of a misleading rig-shaped `unknown_destination_rig`:
 *
 *   1. human-seat classifier FIRST (the shipped archetype): a human-seat ref
 *      is never captured. `RESERVED_HOST_IDS` (kernel/host/local) guarantees
 *      no REGISTERED host can shadow the human-seat `@kernel`/`@host` family.
 *   2. fewer than two `@` → plain 2-part session, pass through untouched.
 *   3. two or more `@` → split on the LAST `@`; the trailing segment is the
 *      host qualifier, stripped into `hostId`; the remainder is the
 *      destination session.
 *
 * D-2 (explicit-only): queue verbs NEVER consult the persisted host
 * selection — cross-host routing happens only via `--host <id>` or the
 * host-qualified destination form. Naming BOTH with different hosts is a
 * structured ambiguity error, never a silent precedence pick.
 */
export type QueueHostResolution = {
    ok: true;
    destination: string;
    hostId?: string;
} | {
    ok: false;
    error: string;
    message: string;
};
export declare function resolveQueueHostDestination(destination: string, explicitHost?: string): QueueHostResolution;
export declare function queueCommand(depsOverride?: QueueDeps): Command;
export {};
//# sourceMappingURL=queue.d.ts.map