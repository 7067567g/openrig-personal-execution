import type { ErrorHandler, MiddlewareHandler } from "hono";
/**
 * Records the error when `c.req.json()` fails to parse the request body, and
 * treats a body that parses to `null` the same way, so a route that catches a
 * bad body treats `null` like any other. The error is rethrown unchanged, so
 * routes that catch a bad body keep their own responses.
 */
export declare const trackJsonBodyParseErrors: MiddlewareHandler;
/**
 * App-level error handler. Routes that read their body with a bare
 * `await c.req.json()` let a malformed body escape, which Hono's default
 * handler turns into a 500. That is a caller error, so answer 400.
 *
 * Every other error is handled exactly as Hono's default handler does,
 * including typed refusals that carry their own `getResponse()`.
 */
export declare const jsonBodyErrorHandler: ErrorHandler;
//# sourceMappingURL=json-body-error.d.ts.map