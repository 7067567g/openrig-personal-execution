// PL-005 Phase B: ntfy.sh adapter (default per planner brief).
//
// ntfy.sh contract: HTTP POST to https://ntfy.sh/<topic> with the body
// as the notification text. Headers like Title, Click, Tags shape the
// rendering. Free, self-hostable, simple HTTP POST → push notification
// on the operator's phone (ntfy mobile app subscribed to the topic).
import { validateOutboundUrl, redactUrl, safeDecodeURIComponent } from "./outbound-url-validator.js";
export class NtfyNotificationAdapter {
    mechanism = "ntfy";
    target;
    disabled;
    validationError;
    fetchImpl;
    authHeader;
    constructor(opts) {
        const validation = validateOutboundUrl(opts.topicUrl);
        if (!validation.valid) {
            this.disabled = true;
            this.validationError = `Invalid ntfy topic URL '${redactUrl(opts.topicUrl)}': ${validation.reason}`;
            const warn = opts.warn ?? console.warn;
            warn(`[openrig] Notifications disabled: ${this.validationError}`);
            this.target = opts.topicUrl;
        }
        else {
            const parsed = new URL(validation.parsedUrl.toString());
            if (parsed.username || parsed.password) {
                const user = safeDecodeURIComponent(parsed.username);
                const pass = safeDecodeURIComponent(parsed.password);
                this.authHeader = `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
                parsed.username = "";
                parsed.password = "";
            }
            this.target = parsed.toString();
        }
        this.fetchImpl = opts.fetchImpl ?? fetch;
    }
    async send(payload) {
        if (this.disabled) {
            return {
                ok: false,
                error: this.validationError ?? "notifications disabled: invalid topic URL",
            };
        }
        const headers = {
            Title: truncateHeader(payload.title, 250),
        };
        if (this.authHeader) {
            headers.Authorization = this.authHeader;
        }
        if (payload.qitemRef)
            headers.Click = payload.qitemRef;
        if (payload.tags && payload.tags.length > 0) {
            headers.Tags = payload.tags.join(",");
        }
        try {
            const res = await this.fetchImpl(this.target, {
                method: "POST",
                headers,
                body: payload.body,
            });
            if (!res.ok) {
                return { ok: false, error: `ntfy POST ${res.status}` };
            }
            return { ok: true, ack: `ntfy ${res.status}` };
        }
        catch (err) {
            return {
                ok: false,
                error: err instanceof Error ? err.message : String(err),
            };
        }
    }
}
/**
 * ntfy headers must be single-line, and fetch only accepts Latin-1 header values
 * (anything above U+00FF, such as an em dash or an emoji, makes the whole send
 * throw). Truncate and strip newlines, then send a non-ASCII value as an RFC 2047
 * encoded word, which ntfy decodes: `=?UTF-8?B?<base64>?=`.
 */
function truncateHeader(s, max) {
    const cleaned = s.replace(/[\r\n]+/g, " ").trim();
    // Count code points so truncation never splits a surrogate pair.
    const chars = Array.from(cleaned);
    const truncated = chars.length > max ? chars.slice(0, max - 3).join("") + "..." : cleaned;
    return /[^\x20-\x7e]/.test(truncated)
        ? `=?UTF-8?B?${Buffer.from(truncated, "utf-8").toString("base64")}?=`
        : truncated;
}
//# sourceMappingURL=notification-adapter-ntfy.js.map