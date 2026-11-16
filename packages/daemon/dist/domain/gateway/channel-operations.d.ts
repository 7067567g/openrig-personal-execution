/** Deliberately small, value-free snapshots: credentials, handles, message bodies,
 * and connector responses never enter the lifecycle ledger. */
export interface ChannelState {
    enabled?: boolean;
    active?: boolean;
    digest?: string;
    ready?: boolean | null;
}
export interface ChannelActor {
    actor: string;
    provenance: "transport:v1" | "claimed:v1" | "origin-unknown:v1";
    reason: string;
}
export interface ChannelOperation extends ChannelActor {
    id: string;
    at: string;
    action: "enable" | "disable" | "configure" | "verify" | "binding";
    subject: string;
    before: ChannelState;
    after: ChannelState | null;
    effect: "started" | "applied" | "no-op" | "observed" | "failed";
}
export declare function channelStateDigest(value: unknown): string;
/** A start receipt survives a crash between the effect and its completion receipt.
 * Failure to write the start refuses BEFORE the effect; incomplete is never success. */
export declare function runChannelOperation<T>(input: ChannelActor & {
    action: ChannelOperation["action"];
    subject: string;
    before: ChannelState;
    run: () => Promise<{
        value: T;
        after: ChannelState;
        effect: "applied" | "no-op" | "observed";
    }>;
}, home?: string): Promise<{
    value: T;
    receipt: ChannelOperation;
}>;
//# sourceMappingURL=channel-operations.d.ts.map