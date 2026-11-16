import { type GatewayWire } from "../gateway-subsystem.js";
import { type InboundFilePort } from "./inbound.js";
import { type RegistrySurface } from "./inbound-admission.js";
import { type WsLike } from "./socket-inbound.js";
import { type QueueRepository } from "../../queue-repository.js";
import type { FetchImpl } from "./slack-api.js";
export interface SlackWireOpts {
    home: string;
    queueRepo: QueueRepository;
    log?: (msg: string) => void;
    /** Injectable seams (tests): fetch, websocket factory, sweep cadence, registry surface. */
    fetchImpl?: FetchImpl;
    wsFactory?: (url: string) => WsLike;
    outboundIntervalMs?: number;
    inboundRetryIntervalMs?: number;
    inboundMaxConnects?: number;
    registry?: RegistrySurface;
    resolveHumanReply?: (input: {
        qitemId: string;
        actorSession: string;
        decision: string;
    }) => Promise<"resolved" | "already-resolved" | "not-applicable">;
}
interface HumanReplyActionPort {
    act(input: {
        verb: "resolve";
        qitemId: string;
        actorSession: string;
        decision: string;
    }): Promise<unknown>;
}
/** Compose an inbound reply with Mission Control's existing human-park resolver.
 * A replay after the durable resolve but before inbound seen-mark is absorbed by
 * the typed transition, so the waiting owner is resumed exactly once. */
export declare function makeHumanReplyResolver(queueRepo: QueueRepository, contract: HumanReplyActionPort | undefined): NonNullable<SlackWireOpts["resolveHumanReply"]>;
/**
 * OPR.0.5.6.2 — the inbound file port: Slack `url_private` → authenticated
 * download → workspace-local media file → LOCAL path for the reply row.
 * Slack owns nothing (design §2): the stored file is OUR copy of the human's
 * contribution to OUR work record; no Slack URL and no token ever leaves this
 * function toward a row. Failure is per-file and NAMED — a failed transfer
 * yields `{ name, error }`, never an exception that could cost the message.
 *
 * Safe-path discipline: filenames sanitize to a bounded [A-Za-z0-9._-] basename
 * prefixed with the event ts, a channel/message/file identity digest, and index,
 * so messages sharing a timestamp across channels cannot overwrite each other. The resolved path
 * is verified to stay inside `mediaDir` before any write.
 */
/** R1 F1 — the anchored Slack-host verdict now lives in slack-api.ts and is
 *  enforced inside `downloadPrivateFile`; the transfer-path check below keeps
 *  the per-file "missing or non-Slack url_private" failure honest before the
 *  download is even attempted. */
export declare function makeInboundFilePort(opts: {
    token: string;
    mediaDir: string;
    fetchImpl?: FetchImpl;
    mkdirp?: (dir: string) => void;
    writeFile?: (p: string, bytes: Uint8Array) => void;
    log?: (msg: string) => void;
    maxBytes?: number;
}): InboundFilePort;
/** Build the production Slack gateway wire from config + secrets. Never throws on a missing
 *  configuration — that is an honest inert wire, not a boot failure. */
export declare function buildSlackGatewayWire(opts: SlackWireOpts): GatewayWire;
export {};
//# sourceMappingURL=slack-subsystem.d.ts.map