import type Database from "better-sqlite3";
import type { EventBus } from "./event-bus.js";
import { QueueRepository } from "./queue-repository.js";
export declare const INBOX_STATES: readonly ["pending", "absorbed", "denied"];
export type InboxState = (typeof INBOX_STATES)[number];
export interface InboxEntry {
    inboxId: string;
    destinationSession: string;
    senderSession: string;
    body: string;
    tags: string[] | null;
    urgency: string;
    tsDropped: string;
    state: InboxState;
    absorbedAt: string | null;
    absorbedQitemId: string | null;
    deniedAt: string | null;
    deniedReason: string | null;
    auditPointer: string | null;
}
export interface InboxDropInput {
    inboxId?: string;
    destinationSession: string;
    senderSession: string;
    body: string;
    tags?: string[];
    urgency?: string;
    auditPointer?: string;
    /** P21 §4 era-stamp: the route passes `transport:v1` (senderSession derived from the transport
     *  header chokepoint). Written onto the channel-of-record row; absence = claimed-era. */
    identityProvenance?: string | null;
}
export declare class InboxHandlerError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
/**
 * Inbox mailbox handler. Drop-and-go path; the receiver chooses absorb (promote to queue_item) or
 * deny (record reason).
 *
 * P18 sender-provenance: `input.senderSession` is authoritative and MUST be a transport-derived
 * identity supplied by the caller route (the /inbox/drop route derives it from the X-OpenRig-Session
 * header, refusing when absent). This handler no longer carries a pluggable `authenticate` predicate
 * or an `authenticatedSender` parameter — the prior allow-all default + body-forwarded principal were
 * the fabricated-authority surface (P18); identity verification now lives at the ONE transport
 * chokepoint, not behind a re-introducible body-claim fallback here.
 */
export declare class InboxHandler {
    readonly db: Database.Database;
    private readonly eventBus;
    private readonly queueRepo;
    /** P21 §4: detected once — a curated-migration test DB (or a pre-067 daemon) may lack the
     *  era-stamp column, so the writer degrades (omits it) instead of throwing. */
    private readonly hasIdentityProvenanceColumn;
    constructor(db: Database.Database, eventBus: EventBus, queueRepo: QueueRepository);
    drop(input: InboxDropInput): InboxEntry;
    /**
     * Receiver absorbs a pending inbox entry into their main queue.
     * Idempotent on inbox_id: if already absorbed, returns the existing
     * `absorbed_qitem_id` rather than creating a duplicate.
     */
    absorb(inboxId: string, receiverSession: string, identityProvenance?: string | null): Promise<{
        entry: InboxEntry;
        qitemId: string;
    }>;
    deny(inboxId: string, receiverSession: string, reason: string): InboxEntry;
    getById(inboxId: string): InboxEntry | null;
    listPending(destinationSession: string): InboxEntry[];
    listForDestination(destinationSession: string, limit?: number): InboxEntry[];
    private getByIdRaw;
    private getByIdOrThrow;
    private rowToEntry;
}
//# sourceMappingURL=inbox-handler.d.ts.map