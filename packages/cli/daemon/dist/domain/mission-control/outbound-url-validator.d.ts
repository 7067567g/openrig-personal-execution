export interface OutboundUrlValidationResult {
    valid: boolean;
    reason?: string;
    parsedUrl?: URL;
}
/**
 * Validates notification target URLs (webhook and ntfy endpoints).
 *
 * Refuses:
 * - Non-HTTP/HTTPS protocols (e.g. file:, ftp:, gopher:, data:, javascript:)
 * - Malformed URLs or URLs without a hostname
 *
 * URLs with embedded credentials (e.g. https://user:pass@host) are permitted;
 * adapters strip credentials from the URL and transmit them via Authorization headers.
 * Self-hosted notifiers on localhost or the local network are standard OpenRig
 * configurations and are explicitly permitted without restriction.
 */
export declare function validateOutboundUrl(rawUrl: string): OutboundUrlValidationResult;
/**
 * Safely redacts credentials from a raw URL string for safe inclusion in logs and error messages.
 */
export declare function redactUrl(rawUrl: string): string;
/**
 * Safely decodes a URI component, falling back to the raw string if decoding throws a URIError (e.g. unescaped % characters).
 */
export declare function safeDecodeURIComponent(str: string): string;
//# sourceMappingURL=outbound-url-validator.d.ts.map