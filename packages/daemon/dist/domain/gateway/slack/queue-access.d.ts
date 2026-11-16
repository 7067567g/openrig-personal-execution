import type { QueueRepository } from "../../queue-repository.js";
import { type LoadResult } from "../human-registry.js";
import type { HumanQuestion } from "../../human-questions.js";
import { type OwnerNotificationLevel } from "../../queue-transition-log.js";
/** The narrow projection the slack path consumes (shape-compatible with the retired bridge's
 *  QueueItem so message construction and tests carry over). */
export interface QueueItem {
    qitemId: string;
    destinationSession?: string | null;
    sourceSession?: string | null;
    tags?: string[] | null;
    state?: string | null;
    tier?: string | null;
    humanIntent?: "decision" | "update" | null;
    humanDetail?: string | null;
    replyTo?: string | null;
    humanQuestions?: HumanQuestion[] | null;
    summary?: string | null;
    body?: string | null;
    evidenceRef?: string | null;
    notificationKey?: string | null;
    ownerNotificationKind?: string | null;
    ownerNotificationLevel?: OwnerNotificationLevel | null;
}
export interface AlertFilterOpts {
    minimumLevel?: OwnerNotificationLevel;
}
/** PURE: select active qitems whose transition carries a sufficient OWNER classification. */
export declare function filterHumanAlerts(items: QueueItem[], opts: AlertFilterOpts): QueueItem[];
export interface CreateQitemInput {
    qitemId?: string;
    source: string;
    destination: string;
    summary: string;
    body: string;
    priority?: string;
    tags?: string[];
    /** #822 — the ask whose OpenRig thread this message, answer, or reaction came from. */
    inReplyTo?: string;
}
/** What the inbound router needs: land a durable qitem, get its id (or throw). */
export interface InboundQueuePort {
    createQitem(input: CreateQitemInput): Promise<string>;
}
/** What the outbound driver needs: the current human-alert set, full items included. */
export interface OutboundQueuePort {
    listHumanAlerts(filter: AlertFilterOpts): Promise<QueueItem[]>;
}
/** Slice-11 item 9, carried over verbatim from the retired outbound.ts: on ENABLE, seed all
 *  currently-active human alerts as history/seen WITHOUT posting, so turning the connector on
 *  never replays the backlog. Returns the honest online-status line marking the transition. */
export declare function seedBacklogAsHistory(opts: {
    queue: OutboundQueuePort;
    seen: import("./state-store.js").SeenStore;
    filter: AlertFilterOpts;
    /** The durable dispatch buffer, read only to say what the restart will replay: earlier posts that
     *  failed or never finished. An alert whose row has since closed is dropped; the rest post. */
    buffer?: Pick<import("../dispatch-buffer.js").DispatchBuffer, "pending">;
    log?: (msg: string) => void;
}): Promise<{
    seeded: number;
    onlineStatus: string;
}>;
/** Build both ports over the daemon's own QueueRepository. In-process: no shell, no transport,
 *  no `-A` scope trap (list() here is repository-wide), no bounded-body N+1 (rows carry bodies). */
export declare function makeQueuePorts(queueRepo: QueueRepository, opts?: {
    loadHumanRegistry?: () => LoadResult;
}): InboundQueuePort & OutboundQueuePort;
//# sourceMappingURL=queue-access.d.ts.map