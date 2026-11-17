import type { ExecutionContext } from "hono";
import type { HomeKind } from "./entry-guard.js";
/** The one deny code the HTTP boundary produces (AT-S9-ENT-06). */
export declare const HTTP_DENIED_CODE = "entry_guard_http_denied";
export type HttpRouteClass = "lifecycle-mutation" | "read-only";
export interface AcceptedRiskHttpRoute {
    readonly method: string;
    /** URL path template; `:name` segments are concrete IDs at request time. */
    readonly path: string;
    readonly reason: string;
}
/**
 * Deliberately NOT gated as lifecycle mutations. "Accepted risk" is not a safety
 * guarantee: these routes can still start terminal/UI resources, cancel recovery,
 * or damage artifact state. They stay read-only at this L3 boundary because they
 * do not directly mutate rig/seat/workflow declarations, and some are emergency
 * control or artifact-maintenance paths. Tests pin both the exact set and each
 * route's classification so this carve-out cannot drift accidentally.
 */
export declare const ACCEPTED_RISK_HTTP_ROUTES: readonly [{
    readonly method: "POST";
    readonly path: "/api/startup/terminal";
    readonly reason: "starts a tmux server; a third-party terminal resource, not a rig/seat/workflow declaration mutation";
}, {
    readonly method: "POST";
    readonly path: "/api/rigs/:rigId/cmux/launch";
    readonly reason: "starts an external cmux workspace; UI/terminal-resource side effect, not a run-lifecycle transition";
}, {
    readonly method: "POST";
    readonly path: "/api/crash-cart/restore-fleet/:fleetAttemptId/cancel";
    readonly reason: "recovery control; emergency stop of subsequent fleet restores must remain available";
}, {
    readonly method: "POST";
    readonly path: "/api/agent-images/prune";
    readonly reason: "artifact GC, not run lifecycle; dry-run is default but force can destroy artifacts";
}, {
    readonly method: "DELETE";
    readonly path: "/api/agent-images/library/:id";
    readonly reason: "destructive artifact write, not run lifecycle";
}, {
    readonly method: "POST";
    readonly path: "/api/agent-images/library/sync";
    readonly reason: "artifact-library metadata write, not run lifecycle";
}];
/**
 * Classify a request. `body` is the already-parsed JSON body, when the caller has one.
 * A body-aware preview route is read-only only when its exact flag is JSON `true`.
 * Other POST/DELETE paths not named in the mutation table remain read-only for
 * compatibility with the existing preview/read surfaces; PUT and PATCH always default
 * to a lifecycle mutation.
 */
export declare function classifyHttpRoute(method: string, pathOrUrl: string, body?: unknown): HttpRouteClass;
/** Labels are for audit lines only; they never change the decision. */
export declare function describeHttpRoute(method: string, pathOrUrl: string, body?: unknown): string | null;
export interface HttpAdmissionInput {
    method: string;
    path: string;
    home: string;
    env: Record<string, string | undefined>;
    /** Parsed JSON request body, if the route is body-sensitive. Never logged. */
    body?: unknown;
    now?: Date;
    pid?: number;
}
export interface HttpAdmissionDecision {
    allow: boolean;
    route: HttpRouteClass;
    code: string | null;
    reason: string;
    homeKind: HomeKind;
    launchId: string | null;
}
export interface GuardedFetchOptions {
    home: string;
    env: Record<string, string | undefined>;
    now?: () => Date;
}
/**
 * Decide one request. Pure except for the deny audit line, which is best-effort and
 * never creates a directory — so a deny provably mutates nothing else.
 */
export declare function checkHttpAdmission(input: HttpAdmissionInput): HttpAdmissionDecision;
/** The JSON body of a deny. Same 3-part shape as the CLI error object, plus a hint. */
export declare function httpDenialBody(decision: HttpAdmissionDecision): {
    ok: false;
    error: {
        code: string;
        message: string;
        hint: string;
        cause: string;
    };
};
/**
 * Hono's app.fetch signature materialized as a local type: request plus the Node
 * bindings (`env`) and optional execution context. S1-1: the wrapper must preserve
 * all three arguments; dropping `env` makes `c.env.incoming` unavailable and breaks
 * the daemon's loopback/browser-boundary middlewares on a real `@hono/node-server`.
 */
export type GuardedFetchHandler = (request: Request, env?: object, executionCtx?: ExecutionContext) => Response | Promise<Response>;
/**
 * Wrap a fetch handler with the L3 admission check. The inner handler is NOT called on
 * a deny, which is what makes "zero mutation" a property of the code path rather than a
 * promise. The wrapper is transparent for every allowed request, including Hono's
 * `(request, env, executionCtx)` calling convention.
 */
export declare function makeGuardedFetch(inner: GuardedFetchHandler, options: GuardedFetchOptions): GuardedFetchHandler;
//# sourceMappingURL=entry-guard-http.d.ts.map