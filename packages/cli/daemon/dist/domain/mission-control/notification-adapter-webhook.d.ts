import type { NotificationAdapter, NotificationDeliveryResult, NotificationPayload } from "./notification-adapter-types.js";
export interface WebhookAdapterOpts {
    /** Full webhook endpoint URL. */
    endpointUrl: string;
    /** Optional fetch override for tests. */
    fetchImpl?: typeof fetch;
    /** Optional extra headers (e.g., `X-Webhook-Signature`). */
    extraHeaders?: Record<string, string>;
    /** Optional logger for startup warnings. Defaults to console.warn. */
    warn?: (msg: string) => void;
}
export interface WebhookBodyShape {
    source: "openrig.mission-control";
    schema_version: 1;
    title: string;
    body: string;
    qitem_ref?: string;
    tags?: string[];
    emitted_at: string;
}
export declare class WebhookNotificationAdapter implements NotificationAdapter {
    readonly mechanism = "webhook";
    readonly target: string;
    readonly disabled?: boolean;
    readonly validationError?: string;
    private readonly fetchImpl;
    private readonly extraHeaders;
    constructor(opts: WebhookAdapterOpts);
    send(payload: NotificationPayload): Promise<NotificationDeliveryResult>;
}
//# sourceMappingURL=notification-adapter-webhook.d.ts.map