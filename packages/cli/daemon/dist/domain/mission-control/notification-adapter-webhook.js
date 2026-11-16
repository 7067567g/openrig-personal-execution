// PL-005 Phase B: generic webhook adapter (operator-routable alternate).
//
// Documented stable JSON body shape so the operator can POST through
// Slack incoming webhooks, Discord, Telegram bots, or their own infra.
import { validateOutboundUrl, redactUrl, safeDecodeURIComponent } from "./outbound-url-validator.js";
export class WebhookNotificationAdapter {
    mechanism = "webhook";
    target;
    disabled;
    validationError;
    fetchImpl;
    extraHeaders;
    constructor(opts) {
        const validation = validateOutboundUrl(opts.endpointUrl);
        const extraHeaders = { ...(opts.extraHeaders ?? {}) };
        if (!validation.valid) {
            this.disabled = true;
            this.validationError = `Invalid webhook endpoint URL '${redactUrl(opts.endpointUrl)}': ${validation.reason}`;
            const warn = opts.warn ?? console.warn;
            warn(`[openrig] Notifications disabled: ${this.validationError}`);
            this.target = opts.endpointUrl;
        }
        else {
            const parsed = new URL(validation.parsedUrl.toString());
            if (parsed.username || parsed.password) {
                const user = safeDecodeURIComponent(parsed.username);
                const pass = safeDecodeURIComponent(parsed.password);
                const basicAuth = `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
                if (!extraHeaders["Authorization"] && !extraHeaders["authorization"]) {
                    extraHeaders["Authorization"] = basicAuth;
                }
                parsed.username = "";
                parsed.password = "";
            }
            this.target = parsed.toString();
        }
        this.fetchImpl = opts.fetchImpl ?? fetch;
        this.extraHeaders = extraHeaders;
    }
    async send(payload) {
        if (this.disabled) {
            return {
                ok: false,
                error: this.validationError ?? "notifications disabled: invalid webhook endpoint URL",
            };
        }
        const body = {
            source: "openrig.mission-control",
            schema_version: 1,
            title: payload.title,
            body: payload.body,
            qitem_ref: payload.qitemRef,
            tags: payload.tags,
            emitted_at: new Date().toISOString(),
        };
        try {
            const res = await this.fetchImpl(this.target, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...this.extraHeaders,
                },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                return { ok: false, error: `webhook POST ${res.status}` };
            }
            return { ok: true, ack: `webhook ${res.status}` };
        }
        catch (err) {
            return {
                ok: false,
                error: err instanceof Error ? err.message : String(err),
            };
        }
    }
}
//# sourceMappingURL=notification-adapter-webhook.js.map