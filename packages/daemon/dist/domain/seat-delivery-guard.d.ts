import type Database from "better-sqlite3";
/** A binding is captured before waiting. Never rebind an old operation to a new occupant. */
export interface GuardTarget {
    nodeId: string;
    session: string;
    occupant: string | null;
    pane: string | null;
}
export declare class DeliveryGuardError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
    getResponse(): Response;
}
export interface GuardPreference {
    nodeId: string;
    desired: boolean;
    effective: boolean;
    pending: boolean;
}
/** One serialization domain for preference activation, delivery and writing lifecycle.
 * No timer drains held messages. Async context carries a lease through nested adapters;
 * active=false prevents a detached task from retaining permission after its operation ends.
 */
export declare class SeatDeliveryGuard {
    readonly db: Database.Database;
    private readonly resolve;
    private readonly tails;
    private readonly scope;
    private readonly humanLeases;
    constructor(db: Database.Database, resolve: (target: string) => GuardTarget | null);
    /** Startup-only, before exposing routes or starting writers. A stopped operation cannot
     * retain an in-memory lease. Persisted desired protection applies at the new boundary. */
    recoverActivation(): void;
    preference(nodeId: string): GuardPreference;
    maybeTarget(name: string): GuardTarget | null;
    target(name: string): GuardTarget;
    private same;
    private serial;
    set(nodeId: string, enabled: boolean, actor: string, reason: string, timeoutMs?: number): Promise<GuardPreference>;
    /** fn must include lifecycle preflight, effects and last write. Retention callbacks
     * execute under this same lease, before any pane capture/paste/submit branch. */
    operation<T>(name: string, fn: () => Promise<T>, held?: (target: GuardTarget) => Promise<T>): Promise<T>;
    ownsLifecycle(nodeId: string): boolean;
    /** Custody cleanup can join a writing lifecycle lease without granting input permission. */
    ownsCustody(nodeId: string): boolean;
    /** Serialize metadata/custody cleanup even when typing is paused. Capture every
     * target before waiting, then validate all of them before the first effect. */
    custody<T>(nodeIds: string[], fn: () => Promise<T>, onTargetChanged?: (nodeId: string, error: DeliveryGuardError) => void): Promise<T>;
    /** Multi-seat restore takes leases in stable order before any rig mutation.
     * Nested per-seat launch joins these leases; it must not reacquire them. */
    lifecycle<T>(nodeIds: string[], fn: () => Promise<T>): Promise<T>;
    /** Called only after an intentional lifecycle binding change, under its lease.
     * Ordinary sends cannot adopt a replacement occupant or recycled pane. */
    rebindLifecycle(nodeId: string): void;
    private assertCurrent;
    /** Synchronous final-effect check: no await between this and issuing the write. */
    checkInput(name: string): void;
    /** Reconciliation is a synchronous DB transaction, not a nested input operation.
     * Refuse rather than waiting on a sender that could itself be awaiting this call.
     * Pending activation and explicit human input protect the same occupant boundary. */
    reconcileBinding<T>(expected: GuardTarget, commit: () => T): T;
    input<T>(name: string, fn: () => Promise<T>): Promise<T>;
    /** Internal broker path only; never an option accepted by the send HTTP route. */
    humanInput<T>(name: string, fn: () => Promise<T>): Promise<T>;
}
/** Current binding, never a latest historical session-name guess. Unbound seats
 * resolve by node/canonical address for preferences and lifecycle preflight.
 * #174: an archived rig can keep a binding to the same session name as a live
 * seat, so unarchived matches win; archived ones count only when nothing else
 * matches. Exactly one match is still required. */
export declare function resolveGuardTarget(db: Database.Database, name: string): GuardTarget | null;
//# sourceMappingURL=seat-delivery-guard.d.ts.map