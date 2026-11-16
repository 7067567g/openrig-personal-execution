/** The local host's id literal in every P3/P4 payload (arch pin: defined
 *  ONCE here, imported everywhere, never retyped). Matches slice 11's
 *  topology aggregate literal. */
export declare const LOCAL_HOST_ID = "local";
/** Publish the boot-resolved self-host id (startup, once). null resets (tests). */
export declare function setSelfHostId(id: string | null): void;
/** The boot-resolved self-host id, or null before boot has reconciled it. */
export declare function getSelfHostId(): string | null;
/** Publish the boot-derived self-host id source (startup, once). null resets (tests). */
export declare function setSelfHostIdSource(source: string | null): void;
/** The boot-derived self-host id source, or null before boot has reconciled it. */
export declare function getSelfHostIdSource(): string | null;
/**
 * The shared self-resolution convention: does a host token route to THIS host?
 * True for an absent/empty token, the `LOCAL_HOST_ID` positional sentinel, and
 * the daemon's own resolved self-id. The self-id comparison is CASE-SENSITIVE —
 * the same convention as increment 1's candidate-vs-stored check, so the two
 * identity layers agree on case (a case-only divergence is a distinct token).
 * `selfId` is passed explicitly (defaults to the boot-resolved id) so the
 * predicate is pure + unit-testable.
 */
export declare function resolvesToLocalHost(hostToken: string | undefined | null, selfId?: string | null): boolean;
/** CLOSED enum (arch pin A). `unsupported-transport` is R15-2's explicit
 *  class (an SSH-declared host is never a silently thinner payload);
 *  `auth-failed` is distinct from `unreachable` because the operator fix
 *  differs (rotate/set the bearer vs check the host). Extending this set =
 *  a cross-PRD contract change (slices 15 AND 21 re-review). */
export type PerHostStatusKind = "ok" | "unreachable" | "unsupported-transport" | "auth-failed";
export interface PerHostStatus {
    hostId: string;
    status: PerHostStatusKind;
    /** Honest failure detail, rendered muted next to the host chip/row. */
    error?: string;
    /** ADDITIVE OPTIONAL detail (arch adjudication): the shipped CLI
     *  FailedStep vocabulary when a transport-level step classified the
     *  failure. Never load-bearing — `status` is the contract. */
    failedStep?: string;
}
/** items + per-host status: EVERY subscribed host appears in `hosts` on
 *  EVERY payload — ok, unreachable, auth-failed, or unsupported-transport.
 *  Absence is a contract violation (omission-proof; never all-or-nothing,
 *  never silent thinning). */
export interface AggregatedPayload<T> {
    items: T[];
    hosts: PerHostStatus[];
}
/** Contract-level completeness predicate (arch pin B: asserted as near to
 *  the contract as tests allow): true iff every expected host id appears
 *  exactly once in the payload's hosts array. */
export declare function hostsCovered(payload: AggregatedPayload<unknown>, expectedHostIds: string[]): boolean;
//# sourceMappingURL=fanout-contract.d.ts.map