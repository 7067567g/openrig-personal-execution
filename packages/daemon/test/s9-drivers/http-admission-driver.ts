/**
 * S9 W-S8-05 driver — L3 HTTP admission on an S1 managed home.
 *
 *   npx tsx packages/daemon/test/s9-drivers/http-admission-driver.ts \
 *     --fixture FI-03 --route lifecycle-mutation --json   # AT-S9-ENT-06, expects rc 2
 *   npx tsx packages/daemon/test/s9-drivers/http-admission-driver.ts \
 *     --fixture FI-03 --route read-only --json            # AT-S9-ENT-07, expects rc 0
 *
 * The driver drives the REAL wrapper (`makeGuardedFetch`) around a counting inner fetch
 * handler. AT-ENT-06 asserts both halves of "decided before execution": the response is
 * 403 with `entry_guard_http_denied`, AND the inner handler was never called, so no
 * lifecycle mutation ran. AT-ENT-07 asserts a read-only route is transparent.
 *
 * FI-03 is a managed (S1) home whose ticket is no longer live (closed/expired). As a
 * second control the same run also fires a read-only request at the DENYING home: if the
 * read-only route were swept up in the gate, AT-ENT-07 would be green for the wrong
 * reason.
 */
import { fileURLToPath } from "node:url";
import { checkHttpAdmission, classifyHttpRoute, makeGuardedFetch, HTTP_DENIED_CODE } from "../../src/entry-guard-http.js";
import { managedHome } from "./fixtures.js";

type RouteCase = "lifecycle-mutation" | "read-only";

const CASES: Record<RouteCase, { method: string; path: string }> = {
  "lifecycle-mutation": { method: "POST", path: "/api/seat/launch/s1" },
  "read-only": { method: "GET", path: "/api/ps" },
};

interface Args {
  fixture: string;
  route: RouteCase;
}

function parseArgs(argv: readonly string[]): Args {
  const args: Args = { fixture: "FI-03", route: "lifecycle-mutation" };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    if (token === "--fixture") args.fixture = argv[++i] ?? args.fixture;
    else if (token === "--route") args.route = (argv[++i] as RouteCase) ?? args.route;
  }
  return args;
}

function emit(payload: Record<string, unknown>, rc: number): number {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
  return rc;
}

async function run(args: Args): Promise<number> {
  const routeCase = CASES[args.route];
  if (!routeCase) return emit({ error: `unknown route '${args.route}'`, rc: 2 }, 1);

  // A managed home whose launch is no longer live: the ticket a long-running daemon
  // would still be holding after it expired or was closed.
  const { home, launchId } = managedHome({
    launchId: `launch-${args.fixture.toLowerCase()}`,
    phase: "closed",
  });

  let innerCalls = 0;
  const guarded = makeGuardedFetch(
    async () => {
      innerCalls += 1;
      return new Response(JSON.stringify({ ok: true, mutated: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
    { home, env: { OPENRIG_ENTRY_LAUNCH_ID: launchId } },
  );

  const response = await guarded(new Request(`http://127.0.0.1:7433${routeCase.path}`, { method: routeCase.method }));
  const body = (await response.json().catch(() => null)) as
    | { ok?: boolean; error?: { code?: string; hint?: string; cause?: string } }
    | null;

  // Second control: the same (denying) home must stay transparent for a read-only route.
  const controlRoute = CASES["read-only"];
  let controlInnerCalls = 0;
  const controlFetch = makeGuardedFetch(
    async () => {
      controlInnerCalls += 1;
      return new Response("{}", { status: 200 });
    },
    { home, env: { OPENRIG_ENTRY_LAUNCH_ID: launchId } },
  );
  const controlResponse = await controlFetch(
    new Request(`http://127.0.0.1:7433${controlRoute.path}`, { method: controlRoute.method }),
  );

  const classified = classifyHttpRoute(routeCase.method, routeCase.path);
  const direct = checkHttpAdmission({
    method: routeCase.method,
    path: routeCase.path,
    home,
    env: { OPENRIG_ENTRY_LAUNCH_ID: launchId },
  });

  const payload: Record<string, unknown> = {
    fixture: args.fixture,
    home,
    route: args.route,
    // Top-level `code` mirrors body.error.code so any generic matrix runner can assert
    // the frozen `expect_code` without knowing this driver's body shape.
    code: body?.error?.code ?? null,
    request: `${routeCase.method} ${routeCase.path}`,
    classified,
    status: response.status,
    body,
    innerCalls,
    readOnlyControl: {
      status: controlResponse.status,
      innerCalls: controlInnerCalls,
    },
    admission: { allow: direct.allow, code: direct.code, reason: direct.reason },
  };

  if (args.route === "lifecycle-mutation") {
    const pass =
      classified === "lifecycle-mutation" &&
      response.status === 403 &&
      body?.ok === false &&
      body?.error?.code === HTTP_DENIED_CODE &&
      typeof body?.error?.hint === "string" &&
      innerCalls === 0 &&
      direct.allow === false &&
      controlInnerCalls === 1 &&
      controlResponse.status === 200;
    payload["expected"] = `403 + ${HTTP_DENIED_CODE} + inner handler never called`;
    payload["pass"] = pass;
    payload["rc"] = 2;
    return emit(payload, pass ? 2 : 1);
  }

  const pass =
    classified === "read-only" &&
    response.status === 200 &&
    innerCalls === 1 &&
    direct.allow === true &&
    direct.code === null;
  payload["expected"] = "read-only routes pass through untouched";
  payload["pass"] = pass;
  payload["rc"] = 0;
  return emit(payload, pass ? 0 : 1);
}

async function main(argv: readonly string[]): Promise<number> {
  return await run(parseArgs(argv));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      process.stdout.write(
        `${JSON.stringify({ error: error instanceof Error ? error.message : String(error), rc: 1 })}\n`,
      );
      process.exitCode = 1;
    });
}

export { main };
