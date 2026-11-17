import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolveBinEntry, resolveNodeReexecBinary, run } from "../src/bin-wrapper.js";

// Vite 6.4.4+ (the GHSA-rq7h-c2jc-7f22 hardening) only serves files under its project root to
// the test module runner. Keep the fixture install inside the package so the runtime dynamic
// import of `dist/lazy-program.js` follows the same path a real install does. Assertions and the
// cleanup below are unchanged; only the fixture location moved out of os.tmpdir().
const TMP_ROOT = fileURLToPath(new URL(".", import.meta.url));
function makeTempDir(): string {
  return fs.mkdtempSync(path.join(TMP_ROOT, ".tmp-bin-wrapper-"));
}

/** A minimal working sibling guard so tests can reach the entry/lazy loader. */
function writeWorkingGuard(dist: string): void {
  fs.writeFileSync(
    path.join(dist, "entry-guard.js"),
    [
      'export function stripAllowDirect(argv) { return { argv, allowDirect: false }; }',
      'export async function evaluateEntry() { return { allow: true, code: null, reason: "stub allow", verb: null, mode: "not_entry", homeKind: "other", warn: false, launchId: null }; }',
      'export function renderDenial() { return 2; }',
      'export function resolveGuardHome() { return "/tmp/openrig-stub-home"; }',
    ].join("\n"),
  );
}

describe("bin-wrapper", () => {
  let tempDir: string | null = null;

  afterEach(() => {
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it("resolves the real dist entry from a symlinked wrapper path", () => {
    tempDir = makeTempDir();
    const wrapperSource = fileURLToPath(new URL("../src/bin-wrapper.ts", import.meta.url));
    const symlinkPath = path.join(tempDir, "rig");
    fs.symlinkSync(wrapperSource, symlinkPath);

    const entry = resolveBinEntry(symlinkPath, pathToFileURL(wrapperSource).href);
    expect(entry).toBe(path.resolve(path.dirname(wrapperSource), "../dist/index.js"));
  });

  it("prefers the sibling node next to the invoked rig binary when current node comes from elsewhere", () => {
    tempDir = makeTempDir();
    const prefixDir = path.join(tempDir, "prefix");
    const binDir = path.join(prefixDir, "bin");
    fs.mkdirSync(binDir, { recursive: true });

    const wrapperSource = fileURLToPath(new URL("../src/bin-wrapper.ts", import.meta.url));
    const rigPath = path.join(binDir, "rig");
    const siblingNodePath = path.join(binDir, "node");
    fs.symlinkSync(wrapperSource, rigPath);
    fs.writeFileSync(siblingNodePath, "");

    const reexecNode = resolveNodeReexecBinary(
      "/opt/homebrew/bin/node",
      rigPath,
      {},
      (candidate) => candidate === siblingNodePath,
      (candidate) => candidate,
    );

    expect(reexecNode).toBe(siblingNodePath);
  });

  it("a command whose module cannot be loaded fails with the CLI's error shape, as JSON under --json", async () => {
    tempDir = makeTempDir();
    const dist = path.join(tempDir, "dist");
    fs.mkdirSync(dist);
    const wrapper = path.join(dist, "bin-wrapper.js");
    fs.writeFileSync(wrapper, "");
    // Its own module type, as the package declares it: Node before 22.7 would read the fixture as CommonJS.
    fs.writeFileSync(path.join(dist, "package.json"), '{ "type": "module" }\n');
    writeWorkingGuard(dist);
    // An install missing one command's module: the lazy program loads, the command's import fails.
    fs.writeFileSync(path.join(dist, "lazy-program.js"),
      "export async function createLazyProgram() { return (await import('./commands/queue.js')).queueCommand(); }\nexport async function runProgram() { return 0; }\n");
    const run1 = async (...args: string[]) => {
      const out: string[] = [];
      const err: string[] = [];
      const codes: number[] = [];
      await run(["node", wrapper, ...args], { out: (l) => out.push(l), err: (l) => err.push(l), exit: (c) => { codes.push(c); } });
      return { out, err, codes };
    };

    const json = await run1("queue", "list", "--json");
    expect(json.codes).toEqual([1]);
    expect(json.err).toEqual([]);
    expect(json.out).toHaveLength(1);
    const parsed = JSON.parse(json.out[0]!);
    expect(parsed).toEqual({ ok: false, error: { code: "ERR_MODULE_NOT_FOUND", message: expect.stringContaining("commands/queue.js") } });

    const human = await run1("queue", "list");
    expect(human.codes).toEqual([1]);
    expect(human.out).toEqual([]);
    expect(human.err).toHaveLength(2);
    expect(human.err[0]).toBe(`error: ${parsed.error.message}`);
    expect(human.err[1]).toContain("commands/queue.js");
    expect(human.err[1]).toMatch(/\n\s+at /);
  });

  it("fails closed with the CLI error shape when the sibling entry guard is missing", async () => {
    tempDir = makeTempDir();
    const dist = path.join(tempDir, "dist");
    fs.mkdirSync(dist);
    const wrapper = path.join(dist, "bin-wrapper.js");
    fs.writeFileSync(wrapper, "");
    fs.writeFileSync(path.join(dist, "package.json"), '{ "type": "module" }\n');
    // No entry-guard.js — a mixed/older install. An index.js with a command module
    // must not be reached: silence here is a security regression, not compatibility.
    fs.writeFileSync(path.join(dist, "index.js"), "throw new Error('unguarded entry ran');\n");

    const out: string[] = [];
    const err: string[] = [];
    const codes: number[] = [];
    await run(["node", wrapper, "daemon", "start", "--json"], {
      out: (line) => out.push(line),
      err: (line) => err.push(line),
      exit: (code) => codes.push(code),
    });

    expect(codes).toEqual([1]);
    expect(err).toEqual([]);
    expect(out).toHaveLength(1);
    expect(JSON.parse(out[0]!)).toEqual({
      ok: false,
      error: {
        code: "entry_guard_unavailable",
        message: expect.stringContaining("entry-guard.js"),
      },
    });
  });

  it("fails closed for a broken or incomplete sibling entry guard", async () => {
    const cases: Array<{ name: string; source: string }> = [
      { name: "syntax error", source: "export const = ;\n" },
      {
        name: "missing exports",
        source:
          'export function stripAllowDirect(argv) { return { argv, allowDirect: false }; }\n' +
          'export async function evaluateEntry() { return { allow: true }; }\n',
      },
    ];
    for (const fixture of cases) {
      tempDir = makeTempDir();
      const dist = path.join(tempDir, "dist");
      fs.mkdirSync(dist);
      const wrapper = path.join(dist, "bin-wrapper.js");
      fs.writeFileSync(wrapper, "");
      fs.writeFileSync(path.join(dist, "package.json"), '{ "type": "module" }\n');
      fs.writeFileSync(path.join(dist, "entry-guard.js"), fixture.source);

      const out: string[] = [];
      const err: string[] = [];
      const codes: number[] = [];
      await run(["node", wrapper, "daemon", "start", "--json"], {
        out: (line) => out.push(line),
        err: (line) => err.push(line),
        exit: (code) => codes.push(code),
      });

      expect(codes, fixture.name).toEqual([1]);
      expect(err, fixture.name).toEqual([]);
      expect(out, fixture.name).toHaveLength(1);
      const parsed = JSON.parse(out[0]!) as {
        ok: boolean;
        error: { code: string; message: string };
      };
      expect(parsed.ok, fixture.name).toBe(false);
      expect(parsed.error.code, fixture.name).toBe("entry_guard_unavailable");
      expect(parsed.error.message, fixture.name).toContain("entry-guard.js");

      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it("does not re-exec when already running under the sibling node", () => {
    tempDir = makeTempDir();
    const prefixDir = path.join(tempDir, "prefix");
    const binDir = path.join(prefixDir, "bin");
    fs.mkdirSync(binDir, { recursive: true });

    const wrapperSource = fileURLToPath(new URL("../src/bin-wrapper.ts", import.meta.url));
    const rigPath = path.join(binDir, "rig");
    const siblingNodePath = path.join(binDir, "node");
    fs.symlinkSync(wrapperSource, rigPath);
    fs.writeFileSync(siblingNodePath, "");

    const reexecNode = resolveNodeReexecBinary(
      siblingNodePath,
      rigPath,
      {},
      (candidate) => candidate === siblingNodePath,
      (candidate) => candidate,
    );

    expect(reexecNode).toBeNull();
  });
});
