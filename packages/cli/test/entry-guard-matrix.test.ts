import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  denialMessage,
  evaluateEntry,
  resetEntryGuardProcessState,
  stripAllowDirect,
  type GuardOptions,
} from "../src/entry-guard.js";
import {
  ACCEPTED_RISK_CLI_COMMANDS,
  ACCEPTED_RISK_HTTP_ROUTES,
  classifyEntryVerb,
  type AcceptedRiskHttpRoute,
  type EntryVerb,
} from "@openrig-local/daemon/entry-guard";
import { createProgram } from "../src/index.js";

// Mirror of the product's default launch authorization: six single-use startup
// verbs plus the repeatable managed workflow-continuation verbs (S10 r3 S1-2).
const ALL_VERBS: EntryVerb[] = [
  "daemon-start",
  "up",
  "restore-apply",
  "workflow-instantiate",
  "workflow-instantiate-lifecycle",
  "workflow-run",
  "workflow-route",
  "workflow-resume",
  "workflow-abort",
  "workflow-revision",
  "workflow-project",
];

const NEW_VERB_CASES: Array<[EntryVerb, string[], string]> = [
  ["snapshot-create", ["snapshot", "rig-a"], "rig snapshot"],
  ["archive", ["archive", "rig-a"], "rig archive"],
  ["unarchive", ["unarchive", "rig-a"], "rig unarchive"],
  ["compact", ["compact", "seat@rig-a"], "rig compact"],
  ["seat-launch", ["seat", "launch", "seat@rig-a", "--fresh", "--reason", "test"], "rig seat launch"],
  ["seat-restart", ["seat", "restart", "seat@rig-a", "--keep-conversation", "--reason", "test"], "rig seat restart"],
  ["seat-stop", ["seat", "stop", "seat@rig-a", "--reason", "test"], "rig seat stop"],
  ["seat-clean", ["seat", "clean", "seat@rig-a", "--reason", "test"], "rig seat clean"],
  ["seat-handover", ["seat", "handover", "seat@rig-a", "--reason", "test"], "rig seat handover"],
  ["seat-continue", ["seat", "continue", "seat@rig-a"], "rig seat continue"],
  ["workflow-route", ["workflow", "route", "wf-1", "--to", "other@rig-a", "--actor-session", "me@rig-a"], "rig workflow route"],
  ["workflow-resume", ["workflow", "resume", "wf-1"], "rig workflow resume"],
  ["workflow-abort", ["workflow", "abort", "wf-1"], "rig workflow abort"],
  ["workflow-revision", ["workflow", "revise", "wf-1", "--apply", "--expected-version", "1", "--expected-digest", "abc", "--operation-key", "op-1", "--actor-session", "me@rig-a", "--reason", "test"], "rig workflow revise"],
  ["workflow-project", ["workflow", "project", "--instance", "wf-1", "--current-packet", "q-1", "--exit", "handoff", "--actor-session", "me@rig-a"], "rig workflow project"],
  ["release", ["release", "rig-a", "--json"], "rig release"],
  ["attach", ["attach", "--self", "--rig", "rig-a", "--node", "node-1", "--json"], "rig attach"],
  ["add-member", ["add", "rig-a", "pod-1", "member.yaml"], "rig add"],
  ["grow", ["grow", "rig-a", "seat-1"], "rig grow"],
  ["expand", ["expand", "rig-a", "pod.yaml"], "rig expand"],
  ["shrink", ["shrink", "rig-a", "pod-1"], "rig shrink"],
  ["remove-node", ["remove", "rig-a", "node-1"], "rig remove"],
  ["launch-node", ["launch", "rig-a", "node-1"], "rig launch"],
  ["create", ["create", "rig-a"], "rig create"],
  ["import-rig", ["import", "spec.yaml", "--instantiate"], "rig import"],
  ["adopt", ["adopt", "pod.yaml"], "rig adopt"],
  ["fork", ["fork", "seat@rig-a", "--rig", "rig-a", "--pod", "pod-1", "--member", "new-seat"], "rig fork"],
  ["bind", ["bind", "disc-1", "--rig", "rig-a", "--node", "node-1"], "rig bind"],
  ["bootstrap", ["bootstrap", "spec.yaml"], "rig bootstrap"],
  ["bundle-install", ["bundle", "install", "bundle.rigbundle"], "rig bundle install"],
  ["reconcile-session", ["reconcile-session", "seat@rig-a"], "rig reconcile-session"],
  ["unclaim", ["unclaim", "seat@rig-a"], "rig unclaim"],
  ["seat-clear-attention", ["seat", "clear-attention", "seat@rig-a"], "rig seat clear-attention"],
  ["seat-resume-token", ["seat", "set-resume-token", "seat@rig-a", "--token-stdin", "--reason", "test"], "rig seat set-resume-token"],
];

const OPTION_VALUE_BYPASS_CASES: Array<[EntryVerb, string[]]> = [
  ["snapshot-create", ["snapshot", "--intended-seats", "list", "rig-a"]],
  ["restore-apply", ["restore", "--rig", "status", "snap-1"]],
  ["seat-launch", ["seat", "launch", "seat@rig-a", "--fresh", "--reason", "--plan"]],
  ["seat-launch", ["seat", "launch", "seat@rig-a", "--fresh", "--operator", "--plan"]],
  ["seat-restart", ["seat", "restart", "seat@rig-a", "--keep-conversation", "--reason", "--verify"]],
  ["seat-restart", ["seat", "restart", "seat@rig-a", "--keep-conversation", "--expect-account", "--verify"]],
  ["seat-handover", ["seat", "handover", "seat@rig-a", "--reason", "--dry-run"]],
  ["seat-handover", ["seat", "handover", "seat@rig-a", "--source", "--dry-run"]],
  ["seat-handover", ["handover", "seat@rig-a", "--reason", "--dry-run"]],
  ["seat-handover", ["handover", "seat@rig-a", "--operator", "--dry-run"]],
];

const DOUBLE_DASH_CASES: Array<[EntryVerb, string[]]> = [
  ["daemon-start", ["--", "daemon", "start"]],
  ["snapshot-create", ["--", "snapshot", "rig-a"]],
  ["seat-continue", ["--", "seat", "continue", "seat@rig-a"]],
  ["archive", ["--", "archive", "rig-a"]],
  ["daemon-start", ["daemon", "--", "start"]],
  ["snapshot-create", ["snapshot", "--", "rig-a"]],
  ["seat-continue", ["seat", "--", "continue", "seat@rig-a"]],
  ["archive", ["archive", "--", "rig-a"]],
];

const L0B_OPTION_VALUE_BYPASS_CASES: Array<[EntryVerb, string[]]> = [
  ["launch-node", ["launch", "rig-a", "--seats", "--plan"]],
  ["bootstrap", ["bootstrap", "spec.yaml", "--cwd", "--plan"]],
  ["bundle-install", ["bundle", "install", "bundle.rigbundle", "--target", "--plan"]],
  ["attach", ["attach", "--self", "--rig", "--help", "--node", "node-1"]],
  ["seat-clear-attention", ["seat", "clear-attention", "seat@rig-a", "--reason", "--json"]],
  ["seat-resume-token", ["seat", "set-resume-token", "seat@rig-a", "--token-stdin", "--reason", "--help"]],
];

const L0B_DOUBLE_DASH_CASES: Array<[EntryVerb, string[]]> = [
  ["release", ["--", "release", "rig-a"]],
  ["release", ["release", "--", "rig-a"]],
  ["launch-node", ["--", "launch", "rig-a", "node-1"]],
  ["launch-node", ["launch", "--", "rig-a", "node-1"]],
  ["import-rig", ["import", "--instantiate", "--", "spec.yaml"]],
];

const ALL_MUTATION_BYPASS_CASES: Array<[EntryVerb, string[]]> = [
  ...OPTION_VALUE_BYPASS_CASES,
  ...L0B_OPTION_VALUE_BYPASS_CASES,
  ...DOUBLE_DASH_CASES,
  ...L0B_DOUBLE_DASH_CASES,
];

const roots: string[] = [];

function tmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "openrig-s8-matrix-"));
  roots.push(dir);
  return dir;
}

function managedNoRecord(): string {
  const home = tmpDir();
  mkdirSync(join(home, "entry"), { recursive: true });
  writeFileSync(
    join(home, "entry", "managed-run.json"),
    JSON.stringify({ schemaVersion: 1, runId: "run-1" }),
  );
  return home;
}

function managedWithRecord(overrides: Record<string, unknown> = {}): string {
  const home = tmpDir();
  mkdirSync(join(home, "entry"), { recursive: true });
  writeFileSync(
    join(home, "entry", "managed-run.json"),
    JSON.stringify({ schemaVersion: 1, runId: "run-1" }),
  );
  writeFileSync(
    join(home, "entry", "launch.json"),
    JSON.stringify({
      schemaVersion: 1,
      launchId: "launch-1",
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

afterEach(() => {
  for (const root of roots.splice(0)) {
    resetEntryGuardProcessState(root);
    rmSync(root, { recursive: true, force: true });
  }
});

describe("entry guard matrix (CLI adapter)", () => {
  it("exports the accepted-risk constants from the public entry-guard surface", () => {
    expect(ACCEPTED_RISK_CLI_COMMANDS).toEqual(["down", "daemon stop", "destroy"]);
    const httpRoutes: readonly AcceptedRiskHttpRoute[] = ACCEPTED_RISK_HTTP_ROUTES;
    expect(httpRoutes.map(({ method, path }) => ({ method, path }))).toEqual([
      { method: "POST", path: "/api/startup/terminal" },
      { method: "POST", path: "/api/rigs/:rigId/cmux/launch" },
      { method: "POST", path: "/api/crash-cart/restore-fleet/:fleetAttemptId/cancel" },
      { method: "POST", path: "/api/agent-images/prune" },
      { method: "DELETE", path: "/api/agent-images/library/:id" },
      { method: "POST", path: "/api/agent-images/library/sync" },
    ]);
  });

  it("matches actual Commander's global version behavior in value positions", async () => {
    const shapes: string[][] = [
      ["seat", "launch", "seat@rig-a", "--fresh", "--reason", "--version"],
      ["bundle", "install", "bundle.rigbundle", "--target", "-V"],
      ["workflow", "project", "--instance", "--version"],
      ["launch", "rig-a", "--seats", "-V"],
    ];

    for (const argv of shapes) {
      const program = createProgram();
      program.exitOverride();
      program.configureOutput({ writeOut: () => {}, writeErr: () => {} });
      let code: string | undefined;
      try {
        await program.parseAsync(["node", "rig", ...argv]);
      } catch (error) {
        code = (error as { code?: string }).code;
      }
      expect(code, argv.join(" ")).toBe("commander.version");
      expect(classifyEntryVerb(argv), argv.join(" ")).toEqual({ mode: "not_entry", verb: null });
    }
  });

  it("denies each of the six entry verbs on a managed home without a record", async () => {
    const cases: Array<[EntryVerb, string[]]> = [
      ["daemon-start", ["daemon", "start"]],
      ["up", ["up", "spec.yaml"]],
      ["restore-apply", ["restore", "apply", "snap-1"]],
      ["workflow-instantiate", ["workflow", "instantiate", "wf.yaml"]],
      ["workflow-instantiate-lifecycle", ["workflow", "instantiate-lifecycle", "wf.yaml"]],
      ["workflow-run", ["workflow", "run", "wf.yaml"]],
    ];
    for (const [verb, argv] of cases) {
      const home = managedNoRecord();
      const decision = await evaluateEntry(argv, { home, env: {} });
      expect(decision.allow, verb).toBe(false);
      expect(decision.code, verb).toBe("entry_guard_denied");
      expect(decision.verb, verb).toBe(verb);
    }
  });

  it("denies each newly recognized lifecycle verb on a managed home without a record", async () => {
    for (const [verb, argv, label] of NEW_VERB_CASES) {
      const home = managedNoRecord();
      const decision = await evaluateEntry(argv, { home, env: {} });
      expect(decision.allow, verb).toBe(false);
      expect(decision.code, verb).toBe("entry_guard_denied");
      expect(decision.verb, verb).toBe(verb);
      expect(denialMessage(decision, home), verb).toContain(label);
    }
  });

  it("denies option-value and double-dash mutation bypasses without a launch record", async () => {
    for (const [verb, argv] of ALL_MUTATION_BYPASS_CASES) {
      const home = managedNoRecord();
      const decision = await evaluateEntry(argv, { home, env: {} });
      expect(decision.allow, argv.join(" ")).toBe(false);
      expect(decision.code, argv.join(" ")).toBe("entry_guard_denied");
      expect(decision.verb, argv.join(" ")).toBe(verb);
    }
  });

  it("keeps workflow revise read-only when --apply is an option value", async () => {
    const decision = await evaluateEntry(["workflow", "revise", "wf-1", "--reason", "--apply"], {
      home: managedNoRecord(),
      env: {},
    });
    expect(decision.allow).toBe(true);
    expect(decision.mode).toBe("not_entry");
    expect(decision.verb).toBeNull();
  });

  it("allows option-value and double-dash mutations only with explicit launch-record verbs", async () => {
    for (const [verb, argv] of ALL_MUTATION_BYPASS_CASES) {
      const home = managedWithRecord({ verbs: [verb] });
      const decision = await evaluateEntry(argv, {
        home,
        env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-1" },
      });
      expect(decision.allow, argv.join(" ")).toBe(true);
      expect(decision.verb, argv.join(" ")).toBe(verb);
    }
  });

  it("keeps import read-only when mutation-looking tokens are option values", async () => {
    for (const argv of [
      ["import", "spec.yaml", "--target-rig", "--instantiate"],
      ["import", "spec.yaml", "--rig-root", "--materialize-only"],
      ["import", "spec.yaml", "--cwd", "--instantiate"],
      ["--", "import", "spec.yaml", "--instantiate"],
      ["import", "--", "spec.yaml", "--instantiate"],
    ]) {
      const decision = await evaluateEntry(argv, { home: managedNoRecord(), env: {} });
      expect(decision.allow, argv.join(" ")).toBe(true);
      expect(decision.mode, argv.join(" ")).toBe("not_entry");
    }
  });

  it("classifies import --workspace-only as a lifecycle mutation (only --preflight is read-only)", async () => {
    const argv = ["import", "spec.yaml", "--workspace-only", "--target-rig", "rig-a"];
    expect(classifyEntryVerb(argv)).toEqual({ mode: "entry", verb: "import-rig" });

    const denied = await evaluateEntry(argv, { home: managedNoRecord(), env: {} });
    expect(denied.allow).toBe(false);
    expect(denied.verb).toBe("import-rig");
    expect(denied.code).toBe("entry_guard_denied");

    const allowed = await evaluateEntry(argv, {
      home: managedWithRecord({ verbs: ["import-rig"] }),
      env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-1" },
    });
    expect(allowed.allow).toBe(true);
    expect(allowed.verb).toBe("import-rig");

    const preflight = await evaluateEntry(["import", "spec.yaml", "--preflight"], {
      home: managedNoRecord(),
      env: {},
    });
    expect(preflight.allow).toBe(true);
    expect(preflight.mode).toBe("not_entry");
  });

  it("allows default workflow-continuation verbs repeatedly while startup verbs still single-consume", async () => {
    const env = { OPENRIG_ENTRY_LAUNCH_ID: "launch-1" };
    const home = managedWithRecord();
    const project = ["workflow", "project", "--instance", "wf-1", "--current-packet", "q-1"];

    expect((await evaluateEntry(project, { home, env })).allow).toBe(true);
    expect((await evaluateEntry(project, { home, env })).allow).toBe(true);

    const start = ["daemon", "start"];
    expect((await evaluateEntry(start, { home, env })).allow).toBe(true);
    resetEntryGuardProcessState(home);
    const replay = await evaluateEntry(start, { home, env });
    expect(replay.allow).toBe(false);
    expect(replay.code).toBe("entry_guard_verb_consumed");
  });

  it("does not let the default launch authorize a non-continuation lifecycle verb", async () => {
    const home = managedWithRecord();
    const decision = await evaluateEntry(["archive", "rig-a"], {
      home,
      env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-1" },
    });
    expect(decision.allow).toBe(false);
    expect(decision.verb).toBe("archive");
    expect(decision.code).toBe("entry_guard_verb_consumed");
  });

  it("treats option-position help/version as read-only and value/positional help as data", async () => {
    for (const argv of [
      ["archive", "--help"],
      ["compact", "--help"],
      ["seat", "launch", "--help"],
      ["workflow", "project", "--help"],
      ["bundle", "install", "--help"],
      ["--help", "archive"],
      ["--version", "archive"],
      ["archive", "--version"],
      ["seat", "launch", "seat@rig-a", "--fresh", "--reason", "--version"],
      ["bundle", "install", "bundle.rigbundle", "--target", "-V"],
      ["workflow", "project", "--instance", "--version"],
      ["launch", "rig-a", "--seats", "-V"],
    ]) {
      const decision = await evaluateEntry(argv, { home: managedNoRecord(), env: {} });
      expect(decision.allow, argv.join(" ")).toBe(true);
      expect(decision.mode, argv.join(" ")).toBe("not_entry");
    }

    const afterDoubleDash = await evaluateEntry(["archive", "--", "--version"], {
      home: managedNoRecord(),
      env: {},
    });
    expect(afterDoubleDash.allow).toBe(false);
    expect(afterDoubleDash.verb).toBe("archive");

    for (const [verb, argv] of [
      ["seat-launch", ["seat", "launch", "seat@rig-a", "--fresh", "--reason", "--help"]],
      ["launch-node", ["launch", "rig-a", "--seats", "--help"]],
      ["bundle-install", ["bundle", "install", "bundle.rigbundle", "--target", "--help"]],
      ["seat-launch", ["seat", "launch", "seat@rig-a", "--", "--help"]],
    ] as Array<[EntryVerb, string[]]>) {
      const home = managedNoRecord();
      const decision = await evaluateEntry(argv, { home, env: {} });
      expect(decision.allow, argv.join(" ")).toBe(false);
      expect(decision.verb, argv.join(" ")).toBe(verb);
    }
  });

  it("keeps down, daemon stop and destroy on the accepted-risk not_entry path", async () => {
    for (const argv of [
      ["down", "rig-a"],
      ["daemon", "stop"],
      ["destroy", "--yes", "--confirm", "destroy-rig-a"],
    ]) {
      const decision = await evaluateEntry(argv, { home: managedNoRecord(), env: {} });
      expect(decision.allow, argv.join(" ")).toBe(true);
      expect(decision.mode, argv.join(" ")).toBe("not_entry");
    }
  });

  it("does not deny read-only and preview shapes", async () => {
    const cases: string[][] = [
      ["snapshot", "list", "rig-a"],
      ["restore", "status", "attempt-1", "--rig", "rig-a"],
      ["compact", "seat@rig-a", "--state"],
      ["seat", "launch", "seat@rig-a", "--fresh", "--plan"],
      ["seat", "restart", "seat@rig-a", "--keep-conversation", "--plan"],
      ["seat", "restart", "seat@rig-a", "--keep-conversation", "--verify"],
      ["seat", "handover", "seat@rig-a", "--dry-run"],
      ["handover", "seat@rig-a", "--dry-run"],
      ["workflow", "revise", "wf-1"],
      ["workflow", "continue", "wf-1"],
      ["workflow", "validate", "spec.yaml"],
      ["workflow", "compile", "mission.yaml"],
      ["launch", "rig-a", "node-1", "--plan"],
      ["bootstrap", "spec.yaml", "--plan"],
      ["bundle", "install", "bundle.rigbundle", "--plan"],
      ["bundle", "create", "spec.yaml"],
      ["bundle", "inspect", "bundle.rigbundle"],
      ["bundle", "check", "folder"],
      ["bundle", "configurations", "spec.yaml"],
      ["bundle", "history"],
      ["import", "spec.yaml"],
      ["import", "spec.yaml", "--preflight"],
    ];
    const home = managedNoRecord();
    for (const argv of cases) {
      const decision = await evaluateEntry(argv, { home, env: {} });
      expect(decision.allow, argv.join(" ")).toBe(true);
      expect(decision.mode, argv.join(" ")).toBe("not_entry");
      expect(decision.verb, argv.join(" ")).toBeNull();
    }
  });

  it("allows a new lifecycle verb only when the launch record explicitly includes it", async () => {
    const home = managedWithRecord({ verbs: ["snapshot-create"] });
    const decision = await evaluateEntry(["snapshot", "rig-a"], {
      home,
      env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-1" },
    });
    expect(decision.allow).toBe(true);
    expect(decision.verb).toBe("snapshot-create");
  });

  it("does not let the default launch authorize an arbitrary lifecycle verb", async () => {
    const home = managedWithRecord();
    const decision = await evaluateEntry(["archive", "rig-a"], {
      home,
      env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-1" },
    });
    expect(decision.allow).toBe(false);
    expect(decision.verb).toBe("archive");
    expect(decision.code).toBe("entry_guard_verb_consumed");
  });

  it("denies daemon start without a launch record", async () => {
    const home = managedNoRecord();
    const decision = await evaluateEntry(["daemon", "start"], { home, env: {} });
    expect(decision.allow).toBe(false);
    expect(decision.code).toBe("entry_guard_denied");
    expect(decision.reason).toContain("launch record");
  });

  it("does not deny a read verb", async () => {
    const decision = await evaluateEntry(["ps", "--nodes", "--json"], {
      home: managedNoRecord(),
      env: {},
    });
    expect(decision.allow).toBe(true);
    expect(decision.mode).toBe("not_entry");
  });

  it("honors OPENRIG_ENTRY_GUARD=off", async () => {
    const decision = await evaluateEntry(["daemon", "start"], {
      home: managedNoRecord(),
      env: { OPENRIG_ENTRY_GUARD: "off" },
    });
    expect(decision.allow).toBe(true);
  });

  it("passes recovery up --existing and audits it", async () => {
    const home = managedNoRecord();
    const decision = await evaluateEntry(["up", "rig-a", "--existing"], { home, env: {} });
    expect(decision.allow).toBe(true);
    expect(decision.mode).toBe("recovery");
    expect(readFileSync(join(home, "entry", "audit.jsonl"), "utf8")).toContain("allow_recovery");
  });

  it("passes remote up with the warning bit set", async () => {
    const decision = await evaluateEntry(["up", "spec.yaml", "--host", "remote1"], {
      home: managedNoRecord(),
      env: {},
    });
    expect(decision.allow).toBe(true);
    expect(decision.warn).toBe(true);
  });

  it("passes a fixture home", async () => {
    const home = managedNoRecord();
    writeFileSync(join(home, ".openrig-fixture"), "");
    expect((await evaluateEntry(["daemon", "start"], { home, env: {} })).allow).toBe(true);
  });

  it("warns but passes a run-shaped home", async () => {
    const parent = tmpDir();
    const home = join(parent, "openrig-workflow-matrix");
    mkdirSync(home, { recursive: true });
    const decision = await evaluateEntry(["up", "spec.yaml"], { home, env: {} });
    expect(decision.allow).toBe(true);
    expect(decision.warn).toBe(true);
  });

  it("returns entry_guard_token_mismatch for a foreign token", async () => {
    const home = managedWithRecord();
    const decision = await evaluateEntry(["daemon", "start"], {
      home,
      env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-other" },
    });
    expect(decision.code).toBe("entry_guard_token_mismatch");
  });

  it("returns entry_guard_expired past the TTL", async () => {
    const home = managedWithRecord({ expiresAt: "2020-01-01T00:00:00Z" });
    const decision = await evaluateEntry(["daemon", "start"], {
      home,
      env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-1" },
    });
    expect(decision.code).toBe("entry_guard_expired");
  });

  it("allows one use and denies a replayed verb after the in-process pass is cleared", async () => {
    const home = managedWithRecord();
    const env = { OPENRIG_ENTRY_LAUNCH_ID: "launch-1" };
    const first = await evaluateEntry(["daemon", "start"], { home, env });
    expect(first.allow).toBe(true);

    // The same process may repeat L0→L1 for the same launch; a NEW process may not.
    const sameProcess = await evaluateEntry(["daemon", "start"], { home, env });
    expect(sameProcess.allow).toBe(true);
    resetEntryGuardProcessState(home);

    const replay = await evaluateEntry(["daemon", "start"], { home, env });
    expect(replay.allow).toBe(false);
    expect(replay.code).toBe("entry_guard_verb_consumed");
  });

  it("writes an allow_override audit record for the env escape hatch", async () => {
    const home = managedNoRecord();
    const decision = await evaluateEntry(["up", "spec.yaml"], {
      home,
      env: { OPENRIG_ALLOW_DIRECT: "1" },
    });
    expect(decision.allow).toBe(true);
    expect(readFileSync(join(home, "entry", "audit.jsonl"), "utf8")).toContain("allow_override");
  });

  // The four `-t 'allow-direct'` acceptance cases live below; keep the exact count at 4.
  it("strips --allow-direct before the subcommand", async () => {
    const home = managedNoRecord();
    const stripped = stripAllowDirect(["node", "/rig", "--allow-direct", "up", "spec.yaml"]);
    expect(stripped.argv[2]).toBe("up");
    const decision = await evaluateEntry(stripped.argv.slice(2), {
      home,
      env: {},
      allowDirect: stripped.allowDirect,
    });
    expect(decision.allow).toBe(true);
  });

  it("strips --allow-direct after the subcommand", async () => {
    const home = managedNoRecord();
    const stripped = stripAllowDirect(["node", "/rig", "up", "spec.yaml", "--allow-direct"]);
    expect(stripped.argv).toEqual(["node", "/rig", "up", "spec.yaml"]);
    const decision = await evaluateEntry(stripped.argv.slice(2), {
      home,
      env: {},
      allowDirect: stripped.allowDirect,
    });
    expect(decision.allow).toBe(true);
  });

  it("does not strip --allow-direct after --", async () => {
    const home = managedNoRecord();
    const stripped = stripAllowDirect(["node", "/rig", "up", "spec.yaml", "--", "--allow-direct"]);
    expect(stripped.allowDirect).toBe(false);
    expect(stripped.argv).toContain("--allow-direct");
    const decision = await evaluateEntry(stripped.argv.slice(2), {
      home,
      env: {},
      allowDirect: stripped.allowDirect,
    });
    expect(decision.allow).toBe(false);
    expect(decision.code).toBe("entry_guard_denied");
  });

  it("writes an allow_override audit record for --allow-direct", async () => {
    const home = managedNoRecord();
    const decision = await evaluateEntry(["up", "spec.yaml"], {
      home,
      env: {},
      allowDirect: true,
    });
    expect(decision.allow).toBe(true);
    expect(readFileSync(join(home, "entry", "audit.jsonl"), "utf8")).toContain("allow_override");
  });

  it("carries the option shape the CLI passes", async () => {
    const options: GuardOptions = {
      home: managedNoRecord(),
      env: {},
      allowDirect: false,
      pid: 123,
    };
    expect(options.pid).toBe(123);
  });
});
