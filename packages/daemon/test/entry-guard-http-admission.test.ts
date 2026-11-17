/**
 * S9 W-S8-05 — L3 HTTP admission on an S1 managed home (narrow scope, D-006).
 *
 * The bypass this closes: a direct HTTP client reaches the daemon, which is already
 * listening, so L0 (argv), L1 (`startDaemon`) and L2 (boot) never see the request. The
 * gate is placed at the one boundary every route crosses and must be inert everywhere
 * else — a read-only route, an S2 path-shaped home, a fixture home, and the documented
 * escape hatches all pass untouched.
 */
import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ACCEPTED_RISK_HTTP_ROUTES,
  HTTP_DENIED_CODE,
  checkHttpAdmission,
  classifyHttpRoute,
  makeGuardedFetch,
} from "../src/entry-guard-http.js";
import { readLaunchRecord, type EntryVerb } from "../src/entry-guard.js";

const ALL_VERBS: EntryVerb[] = [
  "daemon-start",
  "up",
  "restore-apply",
  "workflow-instantiate",
  "workflow-instantiate-lifecycle",
  "workflow-run",
];

const LIFECYCLE_MUTATION_CASES: Array<[string, string]> = [
  ["POST", "/api/down"],
  ["POST", "/api/up"],
  ["POST", "/api/rigs"],
  ["DELETE", "/api/rigs/rig-1"],
  ["POST", "/api/rigs/rig-1/up"],
  ["POST", "/api/rigs/rig-1/archive"],
  ["POST", "/api/rigs/rig-1/unarchive"],
  ["POST", "/api/rigs/rig-1/release"],
  ["POST", "/api/rigs/rig-1/attach-self"],
  ["POST", "/api/rigs/rig-1/expand"],
  ["POST", "/api/rigs/rig-1/env/down"],
  ["POST", "/api/rigs/rig-1/pods/pod-1/members"],
  ["DELETE", "/api/rigs/rig-1/pods/pod-1"],
  ["POST", "/api/seat/launch/main"],
  ["POST", "/api/seat/restart/main"],
  ["POST", "/api/seat/stop/main"],
  ["POST", "/api/seat/clean/main"],
  ["POST", "/api/seat/handover/main"],
  ["POST", "/api/seat/continue/main"],
  ["POST", "/api/seat/set-model/main"],
  ["POST", "/api/seat/set-permissions/main"],
  ["POST", "/api/seat/set-policy/main"],
  ["POST", "/api/seat/set-effort/main"],
  ["POST", "/api/seat/set-typing-guard/main"],
  ["POST", "/api/seat/switch-client/main"],
  ["POST", "/api/seat/retire-held-message/main/held-1"],
  ["POST", "/api/workflow/instantiate"],
  ["POST", "/api/workflow/instantiate-lifecycle"],
  ["POST", "/api/workflow/project"],
  ["POST", "/api/workflow/wf-1/resume"],
  ["POST", "/api/workflow/wf-1/abort"],
  ["POST", "/api/workflow/wf-1/route"],
  ["POST", "/api/rigs/import"],
  ["POST", "/api/rigs/import/materialize"],
  ["POST", "/api/rigs/import/workspace"],
  ["POST", "/api/rigs/rig-1/snapshots"],
  ["POST", "/api/rigs/rig-1/restore/snap-1"],
  ["POST", "/api/rigs/rig-1/nodes/node-1/launch"],
  ["POST", "/api/rigs/rig-1/nodes/launch-subset"],
  ["DELETE", "/api/rigs/rig-1/nodes/node-1"],
  ["POST", "/api/sessions/session-1/reconcile"],
  ["POST", "/api/sessions/session-1/resume-token"],
  ["POST", "/api/sessions/session-1/unclaim"],
  ["POST", "/api/sessions/session-1/clear-attention"],
  ["POST", "/api/compaction/trigger"],
  ["POST", "/api/compaction/cancel"],
  ["POST", "/api/workflow/wf-1/revision"],
  ["POST", "/api/agent-images/fork"],
  ["POST", "/api/discovery/disc-1/bind"],
  ["POST", "/api/discovery/disc-1/adopt"],
  ["POST", "/api/bootstrap/apply"],
  ["POST", "/api/bundles/install"],
  ["POST", "/api/startup/kernel"],
  ["POST", "/api/startup/rig-1/node-1"],
  ["POST", "/api/crash-cart/restore-fleet"],
  // S10 r3 S2-9 — PUT/PATCH default to mutation; the one known PUT route plus
  // unknown future write paths must all be classified before handler execution.
  ["PUT", "/api/rig-mode/bindings/rig-1/user"],
  ["PATCH", "/api/rig-mode/bindings/rig-1/user"],
  ["PATCH", "/api/future-write-route"],
];

const BODY_AWARE_READ_ONLY_CASES: Array<{
  method: string;
  path: string;
  body: Record<string, true>;
}> = [
  { method: "POST", path: "/api/up", body: { plan: true } },
  { method: "POST", path: "/api/rigs/rig-1/up", body: { plan: true } },
  { method: "POST", path: "/api/rigs/rig-1/nodes/launch-subset", body: { plan: true } },
  { method: "POST", path: "/api/seat/handover/main", body: { dryRun: true } },
  { method: "POST", path: "/api/bundles/install", body: { plan: true } },
];

const ENCODED_BODY_AWARE_CASES: Array<{
  method: string;
  path: string;
  body: Record<string, true>;
}> = [
  { method: "POST", path: "/api/%75p", body: { plan: true } },
  { method: "POST", path: "/api/rigs/rig-1/%75p", body: { plan: true } },
  { method: "POST", path: "/api/rigs/rig-1/nodes/launch-subse%74", body: { plan: true } },
  { method: "POST", path: "/api/seat/handover/se%61t-1", body: { dryRun: true } },
  { method: "POST", path: "/api/bundles/%69nstall", body: { plan: true } },
];

const roots: string[] = [];

function tmpHome(prefix = "openrig-s9-http-"): string {
  const home = mkdtempSync(join(tmpdir(), prefix));
  roots.push(home);
  return home;
}

function managedHome(overrides: Record<string, unknown> = {}): string {
  const home = tmpHome();
  mkdirSync(join(home, "entry"), { recursive: true });
  writeFileSync(join(home, "entry", "managed-run.json"), JSON.stringify({ schemaVersion: 1, runId: "run-1" }));
  writeFileSync(
    join(home, "entry", "launch.json"),
    JSON.stringify({
      schemaVersion: 1,
      launchId: "launch-http",
      home,
      runId: "run-1",
      phase: "starting",
      expiresAt: "2999-01-01T00:00:00Z",
      verbs: ALL_VERBS,
      consumed: [],
      ...overrides,
    }),
  );
  return home;
}

function countingFetch() {
  const calls: string[] = [];
  const handler = async (request: Request): Promise<Response> => {
    let path = "<unparseable>";
    try {
      path = new URL(request.url).pathname;
    } catch {
      path = request.url;
    }
    calls.push(`${request.method} ${path}`);
    return new Response(JSON.stringify({ ok: true, mutated: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  return { handler, calls };
}

function request(method: string, path: string): Request {
  return new Request(`http://127.0.0.1:7433${path}`, { method });
}

function jsonRequest(method: string, path: string, body: unknown): Request {
  return new Request(`http://127.0.0.1:7433${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function rawRequest(method: string, path: string, body: string): Request {
  return new Request(`http://127.0.0.1:7433${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body,
  });
}

function concreteRiskPath(path: string): string {
  return path
    .replace(":rigId", "rig-1")
    .replace(":fleetAttemptId", "attempt-1")
    .replace(":id", "image-1");
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("classifyHttpRoute", () => {
  it("names every lifecycle-mutation route", () => {
    for (const [method, path] of LIFECYCLE_MUTATION_CASES) {
      expect(classifyHttpRoute(method, path), `${method} ${path}`).toBe("lifecycle-mutation");
    }
  });

  it("defaults every PUT and PATCH to a lifecycle mutation, including unknown paths", () => {
    for (const method of ["PUT", "PATCH", "put", "patch"]) {
      expect(classifyHttpRoute(method, "/api/rig-mode/bindings/rig-1/user"), method).toBe(
        "lifecycle-mutation",
      );
      expect(classifyHttpRoute(method, "/api/not-yet-named-writer/thing"), method).toBe(
        "lifecycle-mutation",
      );
    }
  });

  it("keeps every GET read-only, including paths shaped like mutations", () => {
    for (const [, path] of LIFECYCLE_MUTATION_CASES) {
      expect(classifyHttpRoute("GET", path), `GET ${path}`).toBe("read-only");
    }
    expect(classifyHttpRoute("GET", "/api/does-not-exist")).toBe("read-only");
  });

  it("pins the exact HTTP accepted-risk set and keeps every entry read-only", () => {
    expect(
      ACCEPTED_RISK_HTTP_ROUTES.map(({ method, path }) => ({ method, path })),
    ).toEqual([
      { method: "POST", path: "/api/startup/terminal" },
      { method: "POST", path: "/api/rigs/:rigId/cmux/launch" },
      { method: "POST", path: "/api/crash-cart/restore-fleet/:fleetAttemptId/cancel" },
      { method: "POST", path: "/api/agent-images/prune" },
      { method: "DELETE", path: "/api/agent-images/library/:id" },
      { method: "POST", path: "/api/agent-images/library/sync" },
    ]);

    for (const route of ACCEPTED_RISK_HTTP_ROUTES) {
      const concrete = concreteRiskPath(route.path);
      expect(classifyHttpRoute(route.method, concrete), `${route.method} ${concrete}`).toBe(
        "read-only",
      );
      expect(route.reason.trim().length, `${route.method} ${route.path}`).toBeGreaterThan(0);
    }
  });

  it("leaves reads, plans, validation and workflow continue alone", () => {
    const cases: Array<[string, string]> = [
      ["GET", "/api/ps"],
      ["GET", "/api/rigs"],
      ["GET", "/api/rigs/rig-1/nodes"],
      ["GET", "/api/workflow/wf-1/status"],
      ["GET", "/api/workflow/wf-1/revision"],
      ["POST", "/api/queue"],
      ["POST", "/api/rigs/rig-1/launch-plan"],
      ["POST", "/api/seat/launch-plan/main"],
      ["POST", "/api/seat/restart-plan/main"],
      ["POST", "/api/seat/restart-verify/main"],
      ["POST", "/api/workflow/validate"],
      ["POST", "/api/workflow/compile"],
      ["POST", "/api/workflow/wf-1/continue"],
      ["POST", "/api/rigs/import/validate"],
      ["POST", "/api/rigs/import/preflight"],
      ["POST", "/api/discovery/scan"],
      ["POST", "/api/discovery/draft-rig"],
      ["POST", "/api/bootstrap/plan"],
      ["POST", "/api/bundles/inspect"],
      ["GET", "/healthz"],
      ["POST", "/api/seat/launch"], // no seat ref: not a route
    ];
    for (const [method, path] of cases) {
      expect(classifyHttpRoute(method, path), `${method} ${path}`).toBe("read-only");
    }
  });

  it("treats the five body-aware exceptions as read-only only for JSON boolean true", () => {
    for (const { method, path, body } of BODY_AWARE_READ_ONLY_CASES) {
      expect(classifyHttpRoute(method, path, body), `${method} ${path} true`).toBe("read-only");

      const property = Object.keys(body)[0]!;
      const nonOptInBodies: unknown[] = [
        undefined,
        {},
        { [property]: false },
        { [property]: "true" },
        { [property]: "TRUE" },
        { [property]: 1 },
        { [property]: "1" },
        { [property]: {} },
        { [property]: [] },
        { [property]: null },
        [true],
      ];
      for (const nonOptInBody of nonOptInBodies) {
        expect(
          classifyHttpRoute(method, path, nonOptInBody),
          `${method} ${path} body=${JSON.stringify(nonOptInBody) ?? "undefined"}`,
        ).toBe("lifecycle-mutation");
      }
    }

    // A body flag is not an escape hatch for an unrelated mutation route.
    expect(classifyHttpRoute("POST", "/api/down", { plan: true })).toBe("lifecycle-mutation");
  });

  it("ignores the query string and a trailing slash", () => {
    expect(classifyHttpRoute("POST", "/api/down/?x=1")).toBe("lifecycle-mutation");
    expect(classifyHttpRoute("POST", "/api/rigs/rig-1/nodes/launch-subset/?x=1", { plan: true })).toBe(
      "read-only",
    );
    expect(classifyHttpRoute("POST", "/api/startup/kernel?x=1")).toBe("lifecycle-mutation");
    expect(classifyHttpRoute("POST", "/api/rigs/rig-1/env/down/?x=1")).toBe(
      "lifecycle-mutation",
    );
  });
});

describe("checkHttpAdmission", () => {
  const live = { OPENRIG_ENTRY_LAUNCH_ID: "launch-http" };

  it("allows a live managed launch", () => {
    const home = managedHome();
    const decision = checkHttpAdmission({ method: "POST", path: "/api/down", home, env: live });
    expect(decision.allow).toBe(true);
    expect(decision.homeKind).toBe("managed");
    expect(decision.launchId).toBe("launch-http");
  });

  it("allows and denies the env/down mutation on the same launch predicates", () => {
    const liveHome = managedHome();
    expect(
      checkHttpAdmission({
        method: "POST",
        path: "/api/rigs/rig-1/env/down",
        home: liveHome,
        env: live,
      }).allow,
    ).toBe(true);

    const closedHome = managedHome({ phase: "closed" });
    const closed = checkHttpAdmission({
      method: "POST",
      path: "/api/rigs/rig-1/env/down",
      home: closedHome,
      env: live,
    });
    expect(closed.allow).toBe(false);
    expect(closed.code).toBe(HTTP_DENIED_CODE);
    expect(closed.route).toBe("lifecycle-mutation");
  });

  it("denies a closed ticket with entry_guard_http_denied", () => {
    const home = managedHome({ phase: "closed" });
    const decision = checkHttpAdmission({ method: "POST", path: "/api/down", home, env: live });
    expect(decision.allow).toBe(false);
    expect(decision.code).toBe(HTTP_DENIED_CODE);
    expect(decision.reason).toContain("closed");
  });

  it("denies an expired ticket", () => {
    const home = managedHome({ expiresAt: "2020-01-01T00:00:00Z" });
    const decision = checkHttpAdmission({ method: "POST", path: "/api/down", home, env: live });
    expect(decision.code).toBe(HTTP_DENIED_CODE);
    expect(decision.reason).toContain("expired");
  });

  it("denies a dry-run ticket", () => {
    const home = managedHome({ dryRun: true });
    const decision = checkHttpAdmission({ method: "POST", path: "/api/down", home, env: live });
    expect(decision.code).toBe(HTTP_DENIED_CODE);
    expect(decision.reason).toContain("dry run");
  });

  it("denies a foreign token", () => {
    const home = managedHome();
    const decision = checkHttpAdmission({
      method: "POST",
      path: "/api/down",
      home,
      env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-other" },
    });
    expect(decision.code).toBe(HTTP_DENIED_CODE);
    expect(decision.reason).toContain("does not match");
  });

  it("denies a managed home with no launch record", () => {
    const home = tmpHome();
    mkdirSync(join(home, "entry"), { recursive: true });
    writeFileSync(join(home, "entry", "managed-run.json"), JSON.stringify({ schemaVersion: 1, runId: "run-1" }));
    const decision = checkHttpAdmission({ method: "POST", path: "/api/down", home, env: live });
    expect(decision.code).toBe(HTTP_DENIED_CODE);
    expect(decision.reason).toContain("launch record");
  });

  it("never denies a read-only route, even on a denying home", () => {
    const home = managedHome({ phase: "closed" });
    const decision = checkHttpAdmission({ method: "GET", path: "/api/ps", home, env: live });
    expect(decision.allow).toBe(true);
    expect(decision.code).toBeNull();
  });

  it("leaves an S2 path-shaped home alone (no upgrade to deny)", () => {
    const parent = tmpHome();
    const home = join(parent, "openrig-run-s2-fixture");
    mkdirSync(home, { recursive: true });
    const decision = checkHttpAdmission({ method: "POST", path: "/api/down", home, env: live });
    expect(decision.allow).toBe(true);
    expect(decision.homeKind).toBe("run-shaped");
  });

  it("leaves a non-run home alone", () => {
    const decision = checkHttpAdmission({
      method: "POST",
      path: "/api/down",
      home: tmpHome("openrig-s9-plain-"),
      env: live,
    });
    expect(decision.allow).toBe(true);
  });

  it("honors the documented escape hatches", () => {
    const home = managedHome({ phase: "closed" });
    expect(
      checkHttpAdmission({ method: "POST", path: "/api/down", home, env: { OPENRIG_ENTRY_GUARD: "off" } }).allow,
    ).toBe(true);
    expect(
      checkHttpAdmission({ method: "POST", path: "/api/down", home, env: { OPENRIG_ALLOW_DIRECT: "1" } }).allow,
    ).toBe(true);
  });

  it("allows every boolean-true preview on an otherwise denying managed home", () => {
    const home = managedHome({ phase: "closed" });
    for (const routeCase of BODY_AWARE_READ_ONLY_CASES) {
      const decision = checkHttpAdmission({
        method: routeCase.method,
        path: routeCase.path,
        home,
        env: live,
        body: routeCase.body,
      });
      expect(decision.allow, `${routeCase.method} ${routeCase.path}`).toBe(true);
      expect(decision.route).toBe("read-only");
      expect(decision.code).toBeNull();
    }
  });

  it("keeps body-sensitive routes on the mutation path without a boolean true", () => {
    const home = managedHome({ phase: "closed" });
    for (const routeCase of BODY_AWARE_READ_ONLY_CASES) {
      const decision = checkHttpAdmission({
        method: routeCase.method,
        path: routeCase.path,
        home,
        env: live,
        body: { plan: false, dryRun: false },
      });
      expect(decision.allow, `${routeCase.method} ${routeCase.path}`).toBe(false);
      expect(decision.route).toBe("lifecycle-mutation");
      expect(decision.code).toBe(HTTP_DENIED_CODE);
    }
  });
});

describe("makeGuardedFetch — decided before execution", () => {
  it("denies a lifecycle mutation without ever calling the inner handler", async () => {
    const home = managedHome({ phase: "closed" });
    const { handler, calls } = countingFetch();
    const guarded = makeGuardedFetch(handler, {
      home,
      env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-http" },
    });

    const response = await guarded(request("POST", "/api/seat/launch/main"));
    expect(response.status).toBe(403);
    const body = (await response.json()) as {
      ok: boolean;
      error: { code: string; hint: string; message: string };
    };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe(HTTP_DENIED_CODE);
    expect(body.error.hint).toContain("openrig-run start");
    expect(calls).toEqual([]);
  });

  it("passes a read-only request straight through", async () => {
    const home = managedHome({ phase: "closed" });
    const { handler, calls } = countingFetch();
    const guarded = makeGuardedFetch(handler, {
      home,
      env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-http" },
    });

    const response = await guarded(request("GET", "/api/ps"));
    expect(response.status).toBe(200);
    expect(calls).toEqual(["GET /api/ps"]);
  });

  it("passes a live managed launch through to the real handler", async () => {
    const home = managedHome();
    const { handler, calls } = countingFetch();
    const guarded = makeGuardedFetch(handler, {
      home,
      env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-http" },
    });

    for (const path of ["/api/down", "/api/rigs/rig-1/env/down"]) {
      const response = await guarded(request("POST", path));
      expect(response.status, path).toBe(200);
    }
    expect(calls).toEqual(["POST /api/down", "POST /api/rigs/rig-1/env/down"]);
  });

  it("does not consume the verb token on the HTTP path", async () => {
    const home = managedHome();
    const { handler } = countingFetch();
    const guarded = makeGuardedFetch(handler, {
      home,
      env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-http" },
    });

    await guarded(request("POST", "/api/down"));
    expect(readLaunchRecord(home).record?.consumed).toEqual([]);
  });

  it("passes the request through untouched when the URL cannot be parsed", async () => {
    const home = managedHome({ phase: "closed" });
    const { handler, calls } = countingFetch();
    const guarded = makeGuardedFetch(handler, {
      home,
      env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-http" },
    });

    const response = await guarded({ method: "POST", url: "not a url" } as Request);
    expect(response.status).toBe(200);
    expect(calls).toHaveLength(1);
  });

  it("denies representative newly covered mutations before the inner handler", async () => {
    const home = managedHome({ phase: "closed" });
    const { handler, calls } = countingFetch();
    const guarded = makeGuardedFetch(handler, {
      home,
      env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-http" },
    });
    const routes: Array<[string, string]> = [
      ["POST", "/api/rigs/import"],
      ["POST", "/api/rigs/import/materialize"],
      ["POST", "/api/rigs/rig-1/snapshots"],
      ["POST", "/api/rigs/rig-1/restore/snap-1"],
      ["POST", "/api/rigs/rig-1/nodes/node-1/launch"],
      ["POST", "/api/rigs/rig-1/env/down"],
      ["DELETE", "/api/rigs/rig-1/nodes/node-1"],
      ["POST", "/api/sessions/session-1/reconcile"],
      ["POST", "/api/compaction/trigger"],
      ["POST", "/api/workflow/wf-1/revision"],
      ["POST", "/api/agent-images/fork"],
      ["POST", "/api/discovery/disc-1/adopt"],
      ["POST", "/api/bootstrap/apply"],
      ["POST", "/api/startup/kernel"],
      ["POST", "/api/startup/rig-1/node-1"],
      ["POST", "/api/crash-cart/restore-fleet"],
      ["POST", "/api/seat/set-model/main"],
      ["POST", "/api/seat/set-permissions/main"],
      ["POST", "/api/seat/set-policy/main"],
      ["POST", "/api/seat/set-effort/main"],
      ["POST", "/api/seat/set-typing-guard/main"],
      ["POST", "/api/seat/retire-held-message/main/held-1"],
      ["POST", "/api/rigs/import/workspace"],
      ["PUT", "/api/rig-mode/bindings/rig-1/user"],
      ["PATCH", "/api/not-yet-named-writer/thing"],
    ];

    for (const [method, path] of routes) {
      const response = await guarded(request(method, path));
      expect(response.status, `${method} ${path}`).toBe(403);
    }
    expect(calls).toEqual([]);
  });

  it("denies percent-encoded lifecycle mutations before the inner handler", async () => {
    const home = managedHome({ phase: "closed" });
    const { handler, calls } = countingFetch();
    const guarded = makeGuardedFetch(handler, {
      home,
      env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-http" },
    });
    const routes: Array<[string, string]> = [
      ["POST", "/api/down"], // plain-path regression
      ["POST", "/api/%64own"], // /api/down
      ["POST", "/api/d%6Fwn"], // /api/down
      ["POST", "/api/rig%73/import"], // /api/rigs/import
      ["POST", "/api/rigs/x/snapshot%73"], // /api/rigs/x/snapshots
      ["POST", "/api/rigs/rig-1/%65nv/d%6Fwn"], // /api/rigs/rig-1/env/down
      // getPath leaves %2F encoded; decoding it to a slash would change Hono routing.
      ["DELETE", "/api/rigs/x%2Fy"],
    ];

    for (const [method, path] of routes) {
      const response = await guarded(request(method, path));
      expect(response.status, `${method} ${path}`).toBe(403);
    }
    expect(calls).toEqual([]);
  });

  it("fails closed if Hono path normalization throws", async () => {
    const home = managedHome({ phase: "closed" });
    const { handler, calls } = countingFetch();
    const guarded = makeGuardedFetch(handler, {
      home,
      env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-http" },
    });
    const unreadableRequest = {
      method: "POST",
      get url(): string {
        throw new Error("unreadable URL");
      },
    } as unknown as Request;

    const response = await guarded(unreadableRequest);
    expect(response.status).toBe(403);
    const body = (await response.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe(HTTP_DENIED_CODE);
    expect(calls).toEqual([]);
  });

  it("recognizes percent-encoded body-aware previews and preserves their original body", async () => {
    for (const routeCase of ENCODED_BODY_AWARE_CASES) {
      const home = managedHome({ phase: "closed" });
      const bodies: unknown[] = [];
      const guarded = makeGuardedFetch(
        async (request) => {
          bodies.push(await request.json());
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        },
        { home, env: {} },
      );

      const response = await guarded(jsonRequest(routeCase.method, routeCase.path, routeCase.body));
      expect(response.status, `${routeCase.method} ${routeCase.path}`).toBe(200);
      expect(bodies, `${routeCase.method} ${routeCase.path}`).toEqual([routeCase.body]);
    }
  });

  it("keeps percent-encoded body-aware routes closed without an exact boolean true", async () => {
    const home = managedHome({ phase: "closed" });
    const cases: Array<{ method: string; path: string; body?: unknown }> = [
      { method: "POST", path: "/api/%75p" }, // no plan body
      { method: "POST", path: "/api/%75p", body: {} },
      { method: "POST", path: "/api/rigs/rig-1/%75p", body: { plan: false } },
      { method: "POST", path: "/api/rigs/rig-1/nodes/launch-subse%74", body: { plan: 1 } },
      { method: "POST", path: "/api/seat/handover/se%61t-1", body: { dryRun: "true" } },
      { method: "POST", path: "/api/bundles/%69nstall", body: { plan: false } },
    ];

    for (const routeCase of cases) {
      const { handler, calls } = countingFetch();
      const guarded = makeGuardedFetch(handler, {
        home,
        env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-http" },
      });
      const response =
        routeCase.body === undefined
          ? await guarded(request(routeCase.method, routeCase.path))
          : await guarded(jsonRequest(routeCase.method, routeCase.path, routeCase.body));
      expect(response.status, `${routeCase.method} ${routeCase.path}`).toBe(403);
      expect(calls, `${routeCase.method} ${routeCase.path}`).toEqual([]);
    }
  });

  it("denies new mutations on a marker-only managed home before the inner handler", async () => {
    const home = tmpHome();
    mkdirSync(join(home, "entry"), { recursive: true });
    writeFileSync(join(home, "entry", "managed-run.json"), JSON.stringify({ schemaVersion: 1, runId: "run-1" }));
    const { handler, calls } = countingFetch();
    const guarded = makeGuardedFetch(handler, {
      home,
      env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-http" },
    });

    for (const path of ["/api/rigs/import", "/api/rigs/rig-1/env/down"]) {
      const response = await guarded(request("POST", path));
      expect(response.status, path).toBe(403);
    }
    expect(calls).toEqual([]);
  });

  it("fails closed when a body-sensitive route has malformed or missing JSON", async () => {
    const home = managedHome({ phase: "closed" });
    for (const { method, path } of BODY_AWARE_READ_ONLY_CASES) {
      const { handler: malformedHandler, calls: malformedCalls } = countingFetch();
      const malformed = makeGuardedFetch(malformedHandler, {
        home,
        env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-http" },
      });
      const malformedResponse = await malformed(rawRequest(method, path, "{not-json"));
      expect(malformedResponse.status, `${method} ${path} malformed`).toBe(403);
      expect(malformedCalls, `${method} ${path} malformed`).toEqual([]);

      const { handler, calls } = countingFetch();
      const missing = makeGuardedFetch(handler, {
        home,
        env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-http" },
      });
      const missingResponse = await missing(request(method, path));
      expect(missingResponse.status, `${method} ${path} missing body`).toBe(403);
      expect(calls, `${method} ${path} missing body`).toEqual([]);
    }
  });

  it("passes every boolean-true preview through without consuming the original body", async () => {
    for (const routeCase of BODY_AWARE_READ_ONLY_CASES) {
      const home = managedHome({ phase: "closed" });
      const bodies: unknown[] = [];
      const guarded = makeGuardedFetch(
        async (request) => {
          bodies.push(await request.json());
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        },
        { home, env: {} },
      );

      const response = await guarded(jsonRequest(routeCase.method, routeCase.path, routeCase.body));
      expect(response.status, `${routeCase.method} ${routeCase.path}`).toBe(200);
      expect(bodies).toEqual([routeCase.body]);
    }
  });

  it("does not consume the original body on an admitted mutation gated by its body", async () => {
    const home = managedHome();
    const bodies: unknown[] = [];
    const guarded = makeGuardedFetch(
      async (request) => {
        bodies.push(await request.json());
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
      { home, env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-http" } },
    );
    const body = { plan: false, sourceRef: "rig.yaml", token: "must-stay-only-in-the-request" };

    const response = await guarded(jsonRequest("POST", "/api/up", body));
    expect(response.status).toBe(200);
    expect(bodies).toEqual([body]);
  });

  it("passes every accepted-risk HTTP route through on a denying managed home", async () => {
    const home = managedHome({ phase: "closed" });
    const { handler, calls } = countingFetch();
    const guarded = makeGuardedFetch(handler, {
      home,
      env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-http" },
    });

    for (const route of ACCEPTED_RISK_HTTP_ROUTES) {
      const path = concreteRiskPath(route.path);
      const response = await guarded(request(route.method, path));
      expect(response.status, `${route.method} ${path}`).toBe(200);
    }
    expect(calls).toEqual(
      ACCEPTED_RISK_HTTP_ROUTES.map((route) => `${route.method} ${concreteRiskPath(route.path)}`),
    );
  });

  it("passes POST workflow continue through a denying managed home", async () => {
    const home = managedHome({ phase: "closed" });
    const { handler, calls } = countingFetch();
    const guarded = makeGuardedFetch(handler, {
      home,
      env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-http" },
    });

    const response = await guarded(request("POST", "/api/workflow/wf-1/continue"));
    expect(response.status).toBe(200);
    expect(calls).toEqual(["POST /api/workflow/wf-1/continue"]);
  });
});
