import { afterEach, describe, expect, it } from "vitest";
import { Hono } from "hono";
import type { ExecutionContext } from "hono";
import { serve } from "@hono/node-server";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Database from "better-sqlite3";
import { createFullTestDb, createTestApp } from "./helpers/test-app.js";
import { makeGuardedFetch } from "../src/entry-guard-http.js";
import {
  isLoopbackAddress,
  mutationAuthMiddleware,
  type MutationAuthOptions,
} from "../src/middleware/auth-bearer-token.js";

function connEnv(remoteAddress: string | null): never {
  return { incoming: { socket: { remoteAddress } } } as never;
}

function buildApp(opts: Partial<MutationAuthOptions> = {}): Hono {
  const app = new Hono();
  app.use("/api/*", mutationAuthMiddleware({
    nonLoopbackBound: true,
    operatorBearerToken: null,
    terminalBearerToken: null,
    activityHookToken: null,
    ...opts,
  }));
  app.get("/api/read", (c) => c.json({ ok: true }));
  app.post("/api/rigs", (c) => c.json({ ok: true }));
  app.post("/api/startup/begin", (c) => c.json({ ok: true }));
  app.post("/api/activity/hook", (c) => c.json({ ok: true }));
  return app;
}

describe("mutation auth middleware", () => {
  it("recognizes loopback IPv4 and IPv6 forms", () => {
    expect(isLoopbackAddress("127.0.0.1")).toBe(true);
    expect(isLoopbackAddress("127.42.7.99")).toBe(true);
    expect(isLoopbackAddress("::1")).toBe(true);
    expect(isLoopbackAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isLoopbackAddress("100.64.0.5")).toBe(false);
    expect(isLoopbackAddress("192.168.1.10")).toBe(false);
    expect(isLoopbackAddress(null)).toBe(false);
  });

  it("leaves read-only requests alone even from a remote address", async () => {
    const res = await buildApp().request("/api/read", undefined, connEnv("100.64.0.5"));
    expect(res.status).toBe(200);
  });

  it("allows tokenless loopback mutations", async () => {
    const res = await buildApp().request("/api/rigs", { method: "POST" }, connEnv("127.0.0.1"));
    expect(res.status).toBe(200);
  });

  it("denies a tokenless non-loopback mutation with 403 when no operator token is configured", async () => {
    const res = await buildApp().request("/api/rigs", { method: "POST" }, connEnv("100.64.0.5"));
    expect(res.status).toBe(403);
    const body = await res.json() as { ok: boolean; error: { code: string; what_failed: string; what_to_do: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("non_loopback_mutation_denied");
    expect(body.error.what_failed).toContain("non-loopback");
    expect(body.error.what_to_do).toContain("OPENRIG_AUTH_BEARER_TOKEN");
  });

  it("fails closed when a non-loopback bind is declared but the socket address is unavailable", async () => {
    const res = await buildApp().request("/api/rigs", { method: "POST" }, connEnv(null));
    expect(res.status).toBe(403);
  });

  it("requires the operator bearer on a non-loopback mutation when one is configured", async () => {
    const app = buildApp({ operatorBearerToken: "operator-secret" });
    const missing = await app.request("/api/rigs", { method: "POST" }, connEnv("100.64.0.5"));
    expect(missing.status).toBe(401);
    expect(missing.headers.get("www-authenticate")).toContain("Bearer");

    const wrong = await app.request("/api/rigs", {
      method: "POST",
      headers: { Authorization: "Bearer wrong" },
    }, connEnv("100.64.0.5"));
    expect(wrong.status).toBe(401);

    const ok = await app.request("/api/rigs", {
      method: "POST",
      headers: { Authorization: "Bearer operator-secret" },
    }, connEnv("100.64.0.5"));
    expect(ok.status).toBe(200);
  });

  it("rejects a supplied-but-wrong bearer even from loopback", async () => {
    const app = buildApp({ operatorBearerToken: "operator-secret" });
    const res = await app.request("/api/rigs", {
      method: "POST",
      headers: { Authorization: "Bearer wrong" },
    }, connEnv("127.0.0.1"));
    expect(res.status).toBe(401);
  });

  it("does not let the terminal bearer authorize an ordinary core write", async () => {
    const app = buildApp({
      operatorBearerToken: "operator-secret",
      terminalBearerToken: "terminal-secret",
    });
    const res = await app.request("/api/rigs", {
      method: "POST",
      headers: { Authorization: "Bearer terminal-secret" },
    }, connEnv("100.64.0.5"));
    expect(res.status).toBe(401);
  });

  it("accepts the terminal bearer only on terminal/startup-scoped mutations", async () => {
    const app = buildApp({
      operatorBearerToken: "operator-secret",
      terminalBearerToken: "terminal-secret",
    });
    const res = await app.request("/api/startup/begin", {
      method: "POST",
      headers: { Authorization: "Bearer terminal-secret" },
    }, connEnv("100.64.0.5"));
    expect(res.status).toBe(200);
  });

  it("accepts the activity hook token only on activity routes", async () => {
    const app = buildApp({
      operatorBearerToken: "operator-secret",
      activityHookToken: "activity-secret",
    });
    const activity = await app.request("/api/activity/hook", {
      method: "POST",
      headers: { "x-openrig-activity-token": "activity-secret" },
    }, connEnv("100.64.0.5"));
    expect(activity.status).toBe(200);

    const core = await app.request("/api/rigs", {
      method: "POST",
      headers: { "x-openrig-activity-token": "activity-secret" },
    }, connEnv("100.64.0.5"));
    expect(core.status).toBe(401);
  });
});

describe("S1-1 — makeGuardedFetch forwards Hono's Node environment", () => {
  it("preserves env and executionCtx in the inner fetch call", async () => {
    const home = mkdtempSync(join(tmpdir(), "openrig-s1-1-forward-"));
    try {
      const seen: { env?: object; executionCtx?: ExecutionContext } = {};
      const env = { incoming: { socket: { remoteAddress: "127.0.0.1" } } };
      const executionCtx = {
        waitUntil: () => {},
        passThroughOnException: () => {},
      } as ExecutionContext;
      const guarded = makeGuardedFetch(
        async (_request, innerEnv, innerExecutionCtx) => {
          seen.env = innerEnv;
          seen.executionCtx = innerExecutionCtx;
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        },
        { home, env: {} },
      );

      const response = await guarded(
        new Request("http://127.0.0.1:7433/healthz"),
        env,
        executionCtx,
      );
      expect(response.status).toBe(200);
      expect(seen.env).toBe(env);
      expect(seen.executionCtx).toBe(executionCtx);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("keeps c.env available through a REAL @hono/node-server serve, so a loopback mutation is trusted", async () => {
    const home = mkdtempSync(join(tmpdir(), "openrig-s1-1-serve-"));
    // A live managed launch makes BOTH gates active on the real socket: L3 must
    // admit the request from the launch record, then mutationAuth must see the
    // real loopback peer from c.env.incoming.
    mkdirSync(join(home, "entry"), { recursive: true });
    writeFileSync(
      join(home, "entry", "managed-run.json"),
      JSON.stringify({ schemaVersion: 1, runId: "run-1" }),
    );
    writeFileSync(
      join(home, "entry", "launch.json"),
      JSON.stringify({
        schemaVersion: 1,
        launchId: "launch-http",
        home,
        runId: "run-1",
        phase: "active",
        expiresAt: "2999-01-01T00:00:00Z",
        verbs: ["up"],
        consumed: [],
      }),
    );
    const app = new Hono();
    app.use(
      "/api/*",
      mutationAuthMiddleware({
        nonLoopbackBound: true, // default daemon bind plan includes a Tailscale host
        operatorBearerToken: "operator-secret",
        terminalBearerToken: "terminal-secret",
        activityHookToken: null,
      }),
    );
    app.post("/api/rigs", (c) => {
      const bindings = c.env as {
        incoming?: {
          socket?: { remoteAddress?: string };
          rawHeaders?: string[];
        };
      };
      return c.json({
        ok: true,
        remoteAddress: bindings.incoming?.socket?.remoteAddress ?? null,
        rawHeadersPresent: Array.isArray(bindings.incoming?.rawHeaders),
      });
    });

    let server: ReturnType<typeof serve> | undefined;
    let port = 0;
    try {
      const guarded = makeGuardedFetch(app.fetch, {
        home,
        env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-http" },
      });
      await new Promise<void>((resolve) => {
        server = serve({ fetch: guarded, port: 0, hostname: "127.0.0.1" }, (info) => {
          port = info.port;
          resolve();
        });
      });
      expect(port).toBeGreaterThan(0);

      // No Authorization header: a real loopback peer must be trusted. If the
      // wrapper drops env, mutationAuthMiddleware sees no peer while
      // nonLoopbackBound=true and denies this request.
      const response = await fetch(`http://127.0.0.1:${port}/api/rigs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rigId: "rig-1" }),
      });
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        ok: boolean;
        remoteAddress: string | null;
        rawHeadersPresent: boolean;
      };
      expect(body.ok).toBe(true);
      expect(isLoopbackAddress(body.remoteAddress)).toBe(true);
      expect(body.rawHeadersPresent).toBe(true);
    } finally {
      if (server) {
        await new Promise<void>((resolve) => server!.close(() => resolve()));
      }
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("mutation auth on the composed daemon app", () => {
  let db: Database.Database | undefined;

  afterEach(() => {
    db?.close();
    db = undefined;
  });

  it("guards core write routes before their handlers run", async () => {
    db = createFullTestDb();
    const { app } = createTestApp(db, {
      appDeps: {
        bindPlan: {
          mode: "default",
          hosts: ["127.0.0.1", "100.64.0.5"],
          tailscaleDetected: true,
        },
        missionControlBearerToken: "operator-secret",
      },
    });

    const denied = await app.request("/api/down", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rigId: "missing" }),
    }, connEnv("100.64.0.5"));
    expect(denied.status).toBe(401); // operator token is configured, so missing bearer is 401

    // A configured operator token does not break the local loopback CLI.
    const local = await app.request("/api/down", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rigId: "missing" }),
    }, connEnv("127.0.0.1"));
    expect(local.status).toBe(404);

    const authorized = await app.request("/api/down", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer operator-secret",
      },
      body: JSON.stringify({ rigId: "missing" }),
    }, connEnv("100.64.0.5"));
    expect(authorized.status).toBe(404);
  });

  it("covers every core write route group before its handler runs", async () => {
    db = createFullTestDb();
    const { app } = createTestApp(db, {
      appDeps: {
        bindPlan: {
          mode: "default",
          hosts: ["127.0.0.1", "100.64.0.5"],
          tailscaleDetected: true,
        },
        missionControlBearerToken: "operator-secret",
      },
    });

    const cases: Array<{ method: "POST" | "DELETE"; path: string }> = [
      { method: "POST", path: "/api/up" },
      { method: "POST", path: "/api/down" },
      { method: "POST", path: "/api/rigs/rig-1/up" },
      { method: "POST", path: "/api/rigs/rig-1/archive" },
      { method: "DELETE", path: "/api/rigs/rig-1" },
      { method: "POST", path: "/api/config/init-workspace" },
      { method: "POST", path: "/api/workflow/validate" },
      { method: "POST", path: "/api/seat/launch/seat-1" },
    ];

    for (const entry of cases) {
      const res = await app.request(entry.path, {
        method: entry.method,
        headers: { "Content-Type": "application/json" },
        body: entry.method === "POST" ? "{}" : undefined,
      }, connEnv("100.64.0.5"));
      expect(res.status, `${entry.method} ${entry.path}`).toBe(401);
      expect((await res.json() as { error?: { code?: string } }).error?.code).toBe("mutation_auth_required");
    }
  });
});
