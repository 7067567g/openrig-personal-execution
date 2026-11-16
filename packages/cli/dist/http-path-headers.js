/**
 * Filesystem paths in request headers.
 *
 * HTTP header values are ByteStrings: Node's fetch rejects a value with any character above
 * U+00FF ("Cannot convert argument to a ByteString"). A checkout path is not ASCII everywhere
 * (this repository's own path contains 中文), so a raw absolute path in `X-Rig-Root` or
 * `X-Cwd-Override` used to fail before the request left the CLI.
 *
 * The CLI encodes only a path that needs it and marks the request with `X-Path-Encoding: uri`.
 * An ASCII path keeps the original wire shape and no marker, so an older daemon still reads it.
 */
export function pathHeaders(paths) {
    const headers = {};
    let encoded = false;
    for (const [name, value] of Object.entries(paths)) {
        if (value === undefined)
            continue;
        if (/[^\x20-\x7e]/.test(value)) {
            // encodeURIComponent also escapes "/" so the whole value stays one opaque token; put the
            // separators back for readability (and so the value still fails closed as a plain path
            // when a daemon that predates the marker reads it).
            headers[name] = encodeURIComponent(value).replace(/%2F/g, "/");
            encoded = true;
        }
        else {
            headers[name] = value;
        }
    }
    if (encoded)
        headers["X-Path-Encoding"] = "uri";
    return headers;
}
//# sourceMappingURL=http-path-headers.js.map