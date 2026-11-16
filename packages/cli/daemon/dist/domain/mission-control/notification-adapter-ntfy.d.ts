import type { NotificationAdapter, NotificationDeliveryResult, NotificationPayload } from "./notification-adapter-types.js";
export interface NtfyAdapterOpts {
    /**
     * Full topic URL, e.g., `https://ntfy.sh/my-private-topic-abc123`
     * or self-hosted `https://ntfy.example.com/operator-phone`.
     */
    topicUrl: string;
    /** Optional fetch override for tests. */
    fetchImpl?: typeof fetch;
    /** Optional logger for startup warnings. Defaults to console.warn. */
    warn?: (msg: string) => void;
}
export declare class NtfyNotificationAdapter implements NotificationAdapter {
    readonly mechanism = "ntfy";
    readonly target: string;
    readonly disabled?: boolean;
    readonly validationError?: string;
    private readonly fetchImpl;
    private readonly authHeader?;
    constructor(opts: NtfyAdapterOpts);
    send(payload: NotificationPayload): Promise<NotificationDeliveryResult>;
}
//# sourceMappingURL=notification-adapter-ntfy.d.ts.map