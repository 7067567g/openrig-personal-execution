import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const serveMock = vi.fn();
const createDaemonMock = vi.fn();
const serverMock = { prependListener: vi.fn() };
let signalListenersBefore: { SIGINT: Function[]; SIGTERM: Function[] };

vi.mock("@hono/node-server", () => ({
  serve: serveMock,
}));

vi.mock("../src/startup.js", () => ({
  createDaemon: createDaemonMock,
}));

describe("daemon startServer", () => {
  beforeEach(() => {
    signalListenersBefore = {
      SIGINT: process.listeners("SIGINT"),
      SIGTERM: process.listeners("SIGTERM"),
    };
    serveMock.mockReset();
    serverMock.prependListener.mockReset();
    serveMock.mockReturnValue(serverMock);
    createDaemonMock.mockReset();
    createDaemonMock.mockResolvedValue({
      app: { fetch: vi.fn() },
      contextMonitor: { start: vi.fn(), stop: vi.fn() },
      deps: {},
      injectWebSocket: vi.fn(),
    });
    delete process.env.OPENRIG_HOST;
    delete process.env.RIGGED_HOST;
    delete process.env.OPENRIG_BIND_HOST;
    delete process.env.OPENRIG_AUTH_BEARER_TOKEN;
    delete process.env.OPENRIG_TERMINAL_BEARER_TOKEN;
  });

  afterEach(() => {
    // startServer installs shutdown handlers; keep this mock-only fixture isolated.
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
      for (const listener of process.listeners(signal)) {
        if (!signalListenersBefore[signal].includes(listener)) {
          process.removeListener(signal, listener as () => void);
        }
      }
    }
    delete process.env.OPENRIG_HOST;
    delete process.env.RIGGED_HOST;
    delete process.env.OPENRIG_BIND_HOST;
    delete process.env.OPENRIG_AUTH_BEARER_TOKEN;
    delete process.env.OPENRIG_TERMINAL_BEARER_TOKEN;
  });

  it("binds the daemon to loopback", async () => {
    const { startServer } = await import("../src/index.js");

    const server = await startServer(7441);

    expect(serveMock).toHaveBeenCalledWith(
      expect.objectContaining({ port: 7441, hostname: "127.0.0.1" }),
      expect.any(Function)
    );
    expect(server).toBe(serverMock);
    expect(serverMock.prependListener).toHaveBeenCalledWith(
      "request", expect.any(Function),
    );
  });

  it("does not require a terminal bearer token for the default loopback bind", async () => {
    const { startServer } = await import("../src/index.js");

    await startServer(7441);

    expect(createDaemonMock).toHaveBeenCalledWith(
      expect.objectContaining({ terminalBearerToken: null }),
    );
  });

  it("uses the daemon bearer token for terminal routes on explicit public binds", async () => {
    process.env.OPENRIG_BIND_HOST = "0.0.0.0";
    process.env.OPENRIG_AUTH_BEARER_TOKEN = "daemon-token";
    const { startServer } = await import("../src/index.js");

    await startServer(7441);

    expect(createDaemonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bearerToken: "daemon-token",
        terminalBearerToken: "daemon-token",
      }),
    );
  });

  // S9-R-02 / S10 AT-S10-L3-01 — the WIRING, not the wrapper.
  //
  // `entry-guard-http-admission.test.ts` proves `makeGuardedFetch` decides correctly; the
  // S9 driver proves the same wrapper around a counting handler. Neither proved that the
  // fetch `serve()` actually receives IS that wrapper: deleting the `guardedFetch` line in
  // `startServer` would have kept every one of those green. These cases capture the fetch
  // handed to `serve` and drive real Requests through it, so the wiring itself is what
  // fails when it is removed.
  //
  // `OPENRIG_HOME` is read once at module load, so the managed home is created BEFORE the
  // import and the module registry is reset per case (the mocks above are registry-level).
  describe("L3 HTTP admission wiring", () => {
    const ALL_VERBS = [
      "daemon-start",
      "up",
      "restore-apply",
      "workflow-instantiate",
      "workflow-instantiate-lifecycle",
      "workflow-run",
    ];
    const innerFetch = vi.fn(
      async (): Promise<Response> =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    let home: string;
    let savedHome: string | undefined;

    function writeLaunchRecord(dir: string, phase: string): void {
      mkdirSync(join(dir, "entry"), { recursive: true });
      writeFileSync(
        join(dir, "entry", "managed-run.json"),
        JSON.stringify({ schemaVersion: 1, runId: "s10-wiring" }),
      );
      writeFileSync(
        join(dir, "entry", "launch.json"),
        JSON.stringify({
          schemaVersion: 1,
          launchId: "launch-s10-wiring",
          home: dir,
          runId: "s10-wiring",
          phase,
          expiresAt: "2999-01-01T00:00:00Z",
          verbs: ALL_VERBS,
          consumed: [],
        }),
      );
    }

    /** The fetch `serve()` was handed by the real `startServer`. */
    function servedFetch(): (request: Request) => Promise<Response> {
      const calls = serveMock.mock.calls;
      const options = calls[calls.length - 1]?.[0] as
        | { fetch?: (request: Request) => Promise<Response> }
        | undefined;
      expect(options?.fetch).toBeTypeOf("function");
      return options!.fetch!;
    }

    beforeEach(() => {
      savedHome = process.env.OPENRIG_HOME;
      delete process.env.OPENRIG_ENTRY_GUARD;
      delete process.env.OPENRIG_ALLOW_DIRECT;
      delete process.env.OPENRIG_ENTRY_LAUNCH_ID;
      home = mkdtempSync(join(tmpdir(), "openrig-s10-wiring-"));
      // A managed (S1) home whose launch ticket is already closed: the state a
      // long-running daemon still holds after its authorization ends.
      writeLaunchRecord(home, "closed");
      process.env.OPENRIG_HOME = home;
      innerFetch.mockClear();
      createDaemonMock.mockResolvedValue({
        app: { fetch: innerFetch },
        contextMonitor: { start: vi.fn(), stop: vi.fn() },
        deps: {},
        injectWebSocket: vi.fn(),
      });
      vi.resetModules();
    });

    afterEach(() => {
      vi.resetModules();
      if (savedHome === undefined) delete process.env.OPENRIG_HOME;
      else process.env.OPENRIG_HOME = savedHome;
      rmSync(home, { recursive: true, force: true });
    });

    it("wraps the composed app fetch rather than serving it raw", async () => {
      const { startServer } = await import("../src/index.js");

      await startServer(7441);

      expect(servedFetch()).not.toBe(innerFetch);
    });

    it("denies a lifecycle mutation before the app handler runs", async () => {
      const { startServer } = await import("../src/index.js");
      await startServer(7441);

      const response = await servedFetch()(
        new Request("http://127.0.0.1:7441/api/seat/launch/s1", { method: "POST" }),
      );

      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: { code?: string } };
      expect(body.error?.code).toBe("entry_guard_http_denied");
      expect(innerFetch).not.toHaveBeenCalled();
    });

    it("passes a read-only route through to the app handler", async () => {
      const { startServer } = await import("../src/index.js");
      await startServer(7441);
      const request = new Request("http://127.0.0.1:7441/api/ps", { method: "GET" });

      const response = await servedFetch()(request);

      expect(response.status).toBe(200);
      expect(innerFetch).toHaveBeenCalledTimes(1);
      // S1-1: the guard must preserve Hono's full calling convention. When this
      // test invokes the served fetch with only a request, the wrapper still
      // forwards the optional env/executionCtx slots explicitly.
      expect(innerFetch).toHaveBeenCalledWith(request, undefined, undefined);
    });

    it("leaves a non-managed home's mutation alone (the gate is S1-only)", async () => {
      const other = mkdtempSync(join(tmpdir(), "openrig-s10-wiring-other-"));
      try {
        process.env.OPENRIG_HOME = other; // no entry/managed-run.json, no fixture marker
        const { startServer } = await import("../src/index.js");
        await startServer(7441);

        const response = await servedFetch()(
          new Request("http://127.0.0.1:7441/api/seat/launch/s1", { method: "POST" }),
        );

        expect(response.status).toBe(200);
        expect(innerFetch).toHaveBeenCalledTimes(1);
      } finally {
        rmSync(other, { recursive: true, force: true });
        process.env.OPENRIG_HOME = home;
      }
    });
  });
});
