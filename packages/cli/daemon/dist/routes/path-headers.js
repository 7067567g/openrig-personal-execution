/**
 * Read a filesystem path from a request header.
 *
 * `X-Path-Encoding: uri` says the CLI percent-encoded a non-ASCII path because HTTP header
 * values must be ByteStrings (see packages/cli/src/http-path-headers.ts). ASCII paths arrive
 * verbatim with no marker, which is also what a CLI older than the marker sends, so both keep
 * working. A malformed value is returned as sent rather than escaped: the caller's own
 * existence checks then fail closed instead of using a half-decoded path.
 */
export function pathHeader(c, name) {
    const raw = c.req.header(name);
    if (raw === undefined || c.req.header("X-Path-Encoding") !== "uri")
        return raw;
    try {
        return decodeURIComponent(raw);
    }
    catch {
        return raw;
    }
}
//# sourceMappingURL=path-headers.js.map