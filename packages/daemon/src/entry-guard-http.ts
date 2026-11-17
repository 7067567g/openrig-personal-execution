/**
 * S9 W-S8-05 — L3 HTTP admission (NARROW, per D-006).
 *
 * L0 (argv, in the CLI wrapper), L1 (`startDaemon`) and L2 (daemon boot) all decide
 * before a lifecycle mutation starts. A direct HTTP client bypassed all three: the
 * daemon is already listening, so nothing re-checked the launch that authorized it.
 *
 * This module closes exactly that hole and nothing else:
 *  - only a LIFECYCLE-MUTATION request on an S1 managed home is judged;
 *  - a read-only request, a non-managed home (S2 path shape included), and an explicit
 *    `OPENRIG_ENTRY_GUARD=off` / `OPENRIG_ALLOW_DIRECT=1` pass through untouched;
 *  - a deny is decided BEFORE the inner fetch runs, so the request mutates nothing.
 *
 * The decision reuses the frozen S8 single-home predicates (`readLaunchRecord` and the
 * same home/expiry/phase/token/runId order) so L3 cannot drift from L0–L2. The deny
 * code is always `entry_guard_http_denied`; the underlying cause rides `reason`/`cause`
 * so an operator can tell an expired launch from a foreign token.
 *
 * Deliberately NOT in scope (documented S9 residue): a caller that runs as the same
 * user (or root) can still read the launch record and set `OPENRIG_ALLOW_DIRECT`.
 * L3 raises the cost of a blind HTTP bypass; it is not an authentication boundary.
 */
import { join } from "node:path";
import type { ExecutionContext } from "hono";
import { getPath } from "hono/utils/url";
import {
  appendAudit,
  classifyHome,
  LAUNCH_RECORD_PATH,
  readLaunchRecord,
  safeRealpath,
} from "./entry-guard.js";
import type { HomeKind } from "./entry-guard.js";

/** The one deny code the HTTP boundary produces (AT-S9-ENT-06). */
export const HTTP_DENIED_CODE = "entry_guard_http_denied";

export type HttpRouteClass = "lifecycle-mutation" | "read-only";

interface LifecycleMutationRule {
  method: string;
  pattern: RegExp;
  label: string;
}

interface BodyAwareReadOnlyRule {
  method: string;
  pattern: RegExp;
  /** The body flag must be the JSON boolean `true`; no truthiness coercion. */
  flag: "plan" | "dryRun";
}

/**
 * The five routes whose mutation is suppressed only by an explicit, parsed JSON
 * boolean preview flag. The same routes remain lifecycle mutations when the body is
 * absent, malformed, false, or contains any non-boolean value.
 */
const BODY_AWARE_READ_ONLY_RULES: readonly BodyAwareReadOnlyRule[] = [
  { method: "POST", pattern: /^\/api\/up$/, flag: "plan" },
  { method: "POST", pattern: /^\/api\/rigs\/[^/]+\/up$/, flag: "plan" },
  { method: "POST", pattern: /^\/api\/rigs\/[^/]+\/nodes\/launch-subset$/, flag: "plan" },
  { method: "POST", pattern: /^\/api\/seat\/handover\/[^/]+$/, flag: "dryRun" },
  { method: "POST", pattern: /^\/api\/bundles\/install$/, flag: "plan" },
];

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
export const ACCEPTED_RISK_HTTP_ROUTES = [
  {
    method: "POST",
    path: "/api/startup/terminal",
    reason: "starts a tmux server; a third-party terminal resource, not a rig/seat/workflow declaration mutation",
  },
  {
    method: "POST",
    path: "/api/rigs/:rigId/cmux/launch",
    reason: "starts an external cmux workspace; UI/terminal-resource side effect, not a run-lifecycle transition",
  },
  {
    method: "POST",
    path: "/api/crash-cart/restore-fleet/:fleetAttemptId/cancel",
    reason: "recovery control; emergency stop of subsequent fleet restores must remain available",
  },
  {
    method: "POST",
    path: "/api/agent-images/prune",
    reason: "artifact GC, not run lifecycle; dry-run is default but force can destroy artifacts",
  },
  {
    method: "DELETE",
    path: "/api/agent-images/library/:id",
    reason: "destructive artifact write, not run lifecycle",
  },
  {
    method: "POST",
    path: "/api/agent-images/library/sync",
    reason: "artifact-library metadata write, not run lifecycle",
  },
] as const satisfies readonly AcceptedRiskHttpRoute[];

/**
 * The frozen lifecycle-mutation route set. Narrow on purpose (D-006): this is the set
 * of routes that starts, stops, creates, destroys or rewires a run, rig, seat or
 * workflow. Adding a route here is a deliberate admission decision, not an accident of
 * naming. PUT/PATCH are additionally mutations by method even when their path is not
 * listed (S10 r3 S2-9), because neither method has a preview contract on this daemon.
 */
const LIFECYCLE_MUTATION_RULES: readonly LifecycleMutationRule[] = [
  { method: "POST", pattern: /^\/api\/down$/, label: "daemon down" },
  { method: "POST", pattern: /^\/api\/up$/, label: "rig up" },
  { method: "POST", pattern: /^\/api\/rigs$/, label: "rig create" },
  { method: "DELETE", pattern: /^\/api\/rigs\/[^/]+$/, label: "rig destroy" },
  {
    method: "POST",
    pattern: /^\/api\/rigs\/[^/]+\/(up|archive|unarchive|release|attach-self|expand)$/,
    label: "rig lifecycle",
  },
  {
    method: "POST",
    pattern: /^\/api\/rigs\/[^/]+\/env\/down$/,
    label: "rig env down",
  },
  {
    method: "POST",
    pattern: /^\/api\/rigs\/[^/]+\/pods\/[^/]+\/members$/,
    label: "pod member add",
  },
  { method: "DELETE", pattern: /^\/api\/rigs\/[^/]+\/pods\/[^/]+$/, label: "pod remove" },
  {
    method: "POST",
    pattern: /^\/api\/seat\/(launch|restart|stop|clean|handover|continue)\/[^/]+$/,
    label: "seat lifecycle",
  },
  {
    // S10 r3 S2-9 — seat declaration/metadata writes that the old inventory missed.
    method: "POST",
    pattern:
      /^\/api\/seat\/(set-model|set-permissions|set-policy|set-effort|set-typing-guard|switch-client)\/[^/]+$/,
    label: "seat metadata mutation",
  },
  {
    method: "POST",
    pattern: /^\/api\/seat\/retire-held-message\/[^/]+\/[^/]+$/,
    label: "seat held-message retirement",
  },
  {
    method: "POST",
    pattern: /^\/api\/workflow\/(instantiate|instantiate-lifecycle|project)$/,
    label: "workflow instantiate",
  },
  { method: "POST", pattern: /^\/api\/rigs\/import$/, label: "rig import" },
  { method: "POST", pattern: /^\/api\/rigs\/import\/materialize$/, label: "rig import materialize" },
  {
    // S10 r3 S2-9 — workspace-only import calls rigRepo.setRigWorkspace (a write).
    method: "POST",
    pattern: /^\/api\/rigs\/import\/workspace$/,
    label: "rig workspace apply",
  },
  { method: "POST", pattern: /^\/api\/rigs\/[^/]+\/snapshots$/, label: "rig snapshot capture" },
  {
    method: "POST",
    pattern: /^\/api\/rigs\/[^/]+\/restore\/[^/]+$/,
    label: "rig snapshot restore",
  },
  {
    method: "POST",
    pattern: /^\/api\/rigs\/[^/]+\/nodes\/[^/]+\/launch$/,
    label: "node launch",
  },
  {
    method: "POST",
    pattern: /^\/api\/rigs\/[^/]+\/nodes\/launch-subset$/,
    label: "node launch subset",
  },
  {
    method: "DELETE",
    pattern: /^\/api\/rigs\/[^/]+\/nodes\/[^/]+$/,
    label: "node delete",
  },
  {
    method: "POST",
    pattern: /^\/api\/sessions\/[^/]+\/(reconcile|resume-token|unclaim|clear-attention)$/,
    label: "session mutation",
  },
  {
    method: "POST",
    pattern: /^\/api\/compaction\/(trigger|cancel)$/,
    label: "compaction mutation",
  },
  {
    method: "POST",
    pattern: /^\/api\/workflow\/[^/]+\/revision$/,
    label: "workflow revision",
  },
  { method: "POST", pattern: /^\/api\/agent-images\/fork$/, label: "agent image fork" },
  {
    method: "POST",
    pattern: /^\/api\/discovery\/[^/]+\/(bind|adopt)$/,
    label: "discovery mutation",
  },
  { method: "POST", pattern: /^\/api\/bootstrap\/apply$/, label: "bootstrap apply" },
  { method: "POST", pattern: /^\/api\/bundles\/install$/, label: "bundle install" },
  { method: "POST", pattern: /^\/api\/startup\/kernel$/, label: "startup kernel" },
  {
    method: "POST",
    pattern: /^\/api\/startup\/[^/]+\/[^/]+$/,
    label: "startup node",
  },
  {
    method: "POST",
    pattern: /^\/api\/crash-cart\/restore-fleet$/,
    label: "crash-cart restore fleet",
  },
  {
    method: "POST",
    pattern: /^\/api\/workflow\/[^/]+\/(resume|abort|route)$/,
    label: "workflow mutation",
  },
];

/** Path part of a request URL, without a query string or a trailing slash. */
function requestPath(pathOrUrl: string): string {
  const withoutQuery = pathOrUrl.split("?")[0] ?? "";
  const withoutFragment = withoutQuery.split("#")[0] ?? "";
  if (withoutFragment.length > 1 && withoutFragment.endsWith("/")) {
    return withoutFragment.slice(0, -1);
  }
  return withoutFragment;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** True only for an own, exact JSON boolean `true`; never for truthy stand-ins. */
function hasBooleanTrueFlag(body: unknown, flag: BodyAwareReadOnlyRule["flag"]): boolean {
  return (
    isRecord(body) &&
    Object.prototype.hasOwnProperty.call(body, flag) &&
    body[flag] === true
  );
}

function bodyAwareRuleFor(method: string, pathOrUrl: string): BodyAwareReadOnlyRule | null {
  const path = requestPath(pathOrUrl);
  const upper = method.toUpperCase();
  for (const rule of BODY_AWARE_READ_ONLY_RULES) {
    if (rule.method === upper && rule.pattern.test(path)) return rule;
  }
  return null;
}

function isBodyAwareReadOnly(method: string, pathOrUrl: string, body: unknown): boolean {
  const rule = bodyAwareRuleFor(method, pathOrUrl);
  return rule !== null && hasBooleanTrueFlag(body, rule.flag);
}

/** Used by the wrapper to decide whether it may parse a cloned request body. */
function isBodySensitiveRoute(method: string, pathOrUrl: string): boolean {
  return bodyAwareRuleFor(method, pathOrUrl) !== null;
}

/**
 * Classify a request. `body` is the already-parsed JSON body, when the caller has one.
 * A body-aware preview route is read-only only when its exact flag is JSON `true`.
 * Other POST/DELETE paths not named in the mutation table remain read-only for
 * compatibility with the existing preview/read surfaces; PUT and PATCH always default
 * to a lifecycle mutation.
 */
export function classifyHttpRoute(method: string, pathOrUrl: string, body?: unknown): HttpRouteClass {
  if (isBodyAwareReadOnly(method, pathOrUrl, body)) return "read-only";
  const path = requestPath(pathOrUrl);
  const upper = method.toUpperCase();
  // S10 r3 S2-9 — PUT/PATCH are write methods with no preview contract on this
  // daemon. Unknown routes default to a lifecycle mutation (fail closed) instead of
  // riding the denylist's read-only default. There is deliberately no generic
  // read-only escape for these methods; a genuine preview must be named explicitly.
  if (upper === "PUT" || upper === "PATCH") return "lifecycle-mutation";
  for (const rule of LIFECYCLE_MUTATION_RULES) {
    if (rule.method === upper && rule.pattern.test(path)) return "lifecycle-mutation";
  }
  return "read-only";
}

/** Labels are for audit lines only; they never change the decision. */
export function describeHttpRoute(method: string, pathOrUrl: string, body?: unknown): string | null {
  if (isBodyAwareReadOnly(method, pathOrUrl, body)) return null;
  const path = requestPath(pathOrUrl);
  const upper = method.toUpperCase();
  if (upper === "PUT" || upper === "PATCH") return "http write mutation";
  for (const rule of LIFECYCLE_MUTATION_RULES) {
    if (rule.method === upper && rule.pattern.test(path)) return rule.label;
  }
  return null;
}

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
export function checkHttpAdmission(input: HttpAdmissionInput): HttpAdmissionDecision {
  const route = classifyHttpRoute(input.method, input.path, input.body);
  const homeKind = classifyHome(input.home);

  if (route === "read-only") {
    return {
      allow: true,
      route,
      code: null,
      reason: "not a lifecycle-mutation route",
      homeKind,
      launchId: null,
    };
  }

  if (input.env["OPENRIG_ENTRY_GUARD"] === "off" || input.env["OPENRIG_ALLOW_DIRECT"] === "1") {
    return {
      allow: true,
      route,
      code: null,
      reason:
        input.env["OPENRIG_ENTRY_GUARD"] === "off"
          ? "entry guard disabled by OPENRIG_ENTRY_GUARD=off"
          : "OPENRIG_ALLOW_DIRECT=1",
      homeKind,
      launchId: null,
    };
  }

  // S2 path shape and every other home stay untouched: this is an S1-only gate.
  if (homeKind !== "managed") {
    return {
      allow: true,
      route,
      code: null,
      reason: `not a managed run home (${homeKind})`,
      homeKind,
      launchId: null,
    };
  }

  const label = describeHttpRoute(input.method, input.path, input.body) ?? "lifecycle mutation";
  const deny = (cause: string, launchId: string | null = null): HttpAdmissionDecision => {
    appendAudit(input.home, {
      code: HTTP_DENIED_CODE,
      verb: null,
      argv: [`${input.method.toUpperCase()} ${requestPath(input.path)}`],
      runId: input.env["OPENRIG_ENTRY_RUN_ID"] ?? null,
      launchId,
      home: input.home,
      ...(input.pid !== undefined ? { pid: input.pid } : {}),
      decision: "deny",
    });
    return {
      allow: false,
      route,
      code: HTTP_DENIED_CODE,
      reason: `${label} on managed run home ${input.home} denied: ${cause}`,
      homeKind,
      launchId,
    };
  };

  const read = readLaunchRecord(input.home);
  if (!read.ok || !read.record) {
    return deny(read.reason ?? `no valid launch record at ${join(input.home, LAUNCH_RECORD_PATH)}`);
  }
  const record = read.record;
  const launchId = record.launchId;

  // Same order as checkEntry steps 10–13b, so L3 cannot drift from L0–L2.
  if (safeRealpath(record.home) !== safeRealpath(input.home)) {
    return deny(`launch record home ${record.home} != ${input.home}`, launchId);
  }
  const now = input.now ?? new Date();
  if (now.getTime() > Date.parse(record.expiresAt)) {
    return deny(`launch record expired at ${record.expiresAt}`, launchId);
  }
  if (record.phase === "closed") {
    return deny("launch record phase is closed", launchId);
  }
  if (record.dryRun === true) {
    return deny("launch record was a dry run (dryRun: true)", launchId);
  }
  if (input.env["OPENRIG_ENTRY_LAUNCH_ID"] !== record.launchId) {
    return deny(`OPENRIG_ENTRY_LAUNCH_ID does not match launchId ${record.launchId}`, launchId);
  }
  if (!record.runId) {
    return deny("launch record invalid: runId", launchId);
  }

  return {
    allow: true,
    route,
    code: null,
    reason: `managed launch record ${launchId} is live`,
    homeKind,
    launchId,
  };
}

/** The JSON body of a deny. Same 3-part shape as the CLI error object, plus a hint. */
export function httpDenialBody(decision: HttpAdmissionDecision): {
  ok: false;
  error: { code: string; message: string; hint: string; cause: string };
} {
  return {
    ok: false,
    error: {
      code: HTTP_DENIED_CODE,
      message: decision.reason,
      hint: "openrig-run start --run-dir <run-dir>",
      cause: decision.reason,
    },
  };
}

/**
 * Hono's app.fetch signature materialized as a local type: request plus the Node
 * bindings (`env`) and optional execution context. S1-1: the wrapper must preserve
 * all three arguments; dropping `env` makes `c.env.incoming` unavailable and breaks
 * the daemon's loopback/browser-boundary middlewares on a real `@hono/node-server`.
 */
export type GuardedFetchHandler = (
  request: Request,
  env?: object,
  executionCtx?: ExecutionContext,
) => Response | Promise<Response>;

/**
 * Wrap a fetch handler with the L3 admission check. The inner handler is NOT called on
 * a deny, which is what makes "zero mutation" a property of the code path rather than a
 * promise. The wrapper is transparent for every allowed request, including Hono's
 * `(request, env, executionCtx)` calling convention.
 */
export function makeGuardedFetch(
  inner: GuardedFetchHandler,
  options: GuardedFetchOptions,
): GuardedFetchHandler {
  return async (
    request: Request,
    env?: object,
    executionCtx?: ExecutionContext,
  ): Promise<Response> => {
    let path: string;
    let method: string;
    try {
      // Hono routes on getPath(), which tryDecodeURI()s the request path. Classifying
      // new URL(...).pathname instead leaves percent-encoded spellings of the same
      // route unrecognized (e.g. /api/%64own) and lets them bypass this guard.
      path = getPath(request);
      method = request.method;
    } catch {
      // A path we cannot read cannot be classified. Do not fall through as if it were
      // read-only; deny so an unexpected decoding failure cannot become a bypass.
      return new Response(
        JSON.stringify({
          ok: false,
          error: {
            code: HTTP_DENIED_CODE,
            message: "request path could not be normalized for Hono routing",
            hint: "openrig-run start --run-dir <run-dir>",
            cause: "request path could not be normalized for Hono routing",
          },
        }),
        {
          status: 403,
          headers: { "content-type": "application/json" },
        },
      );
    }
    let body: unknown;
    if (isBodySensitiveRoute(method, path)) {
      try {
        // Parse a clone so the inner handler still receives an unread original body.
        body = await request.clone().json();
      } catch {
        // Missing or malformed JSON remains on the lifecycle-mutation path.
        body = undefined;
      }
    }

    const decision = checkHttpAdmission({
      method,
      path,
      home: options.home,
      env: options.env,
      ...(body !== undefined ? { body } : {}),
      ...(options.now ? { now: options.now() } : {}),
    });
    if (!decision.allow) {
      return new Response(JSON.stringify(httpDenialBody(decision)), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }
    return await inner(request, env, executionCtx);
  };
}
