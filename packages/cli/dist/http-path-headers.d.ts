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
export declare function pathHeaders(paths: Record<string, string | undefined>): Record<string, string>;
//# sourceMappingURL=http-path-headers.d.ts.map