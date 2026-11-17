import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ACCEPTED_RISK_CLI_COMMANDS,
  CONTINUATION_VERBS,
  DEFAULT_LAUNCH_VERBS,
  ENTRY_VERBS,
  STARTUP_LAUNCH_VERBS,
  appendAudit,
  checkEntry,
  classifyEntryVerb,
  classifyHome,
  isContinuationVerb,
  readConsumedLedger,
  readLaunchRecord,
  redactArgv,
  type EntryVerb,
} from "../src/entry-guard.js";

// Managed fixtures default to the supervisor launch's complete authorization set:
// six single-use startup verbs + the repeatable workflow-continuation verbs.
const ALL_VERBS: EntryVerb[] = [...DEFAULT_LAUNCH_VERBS];

const NEW_VERB_CASES: Array<[EntryVerb, string[]]> = [
  ["snapshot-create", ["snapshot", "rig-a"]],
  ["archive", ["archive", "rig-a"]],
  ["unarchive", ["unarchive", "rig-a"]],
  ["compact", ["compact", "seat@rig-a"]],
  ["seat-launch", ["seat", "launch", "seat@rig-a", "--fresh", "--reason", "test"]],
  ["seat-restart", ["seat", "restart", "seat@rig-a", "--keep-conversation", "--reason", "test"]],
  ["seat-stop", ["seat", "stop", "seat@rig-a", "--reason", "test"]],
  ["seat-clean", ["seat", "clean", "seat@rig-a", "--reason", "test"]],
  ["seat-handover", ["seat", "handover", "seat@rig-a", "--reason", "test"]],
  ["seat-continue", ["seat", "continue", "seat@rig-a"]],
  ["workflow-route", ["workflow", "route", "wf-1", "--to", "other@rig-a", "--actor-session", "me@rig-a", "--reason", "test"]],
  ["workflow-resume", ["workflow", "resume", "wf-1"]],
  ["workflow-abort", ["workflow", "abort", "wf-1"]],
  ["workflow-revision", ["workflow", "revise", "wf-1", "--apply", "--expected-version", "1", "--expected-digest", "abc", "--operation-key", "op-1", "--actor-session", "me@rig-a", "--reason", "test"]],
  ["workflow-project", ["workflow", "project", "--instance", "wf-1", "--current-packet", "q-1", "--exit", "handoff", "--actor-session", "me@rig-a"]],
  ["release", ["release", "rig-a", "--json"]],
  ["attach", ["attach", "--self", "--rig", "rig-a", "--node", "node-1", "--json"]],
  ["add-member", ["add", "rig-a", "pod-1", "member.yaml"]],
  ["grow", ["grow", "rig-a", "seat-1"]],
  ["expand", ["expand", "rig-a", "pod.yaml"]],
  ["shrink", ["shrink", "rig-a", "pod-1"]],
  ["remove-node", ["remove", "rig-a", "node-1"]],
  ["launch-node", ["launch", "rig-a", "node-1"]],
  ["create", ["create", "rig-a"]],
  ["import-rig", ["import", "spec.yaml", "--instantiate"]],
  ["adopt", ["adopt", "pod.yaml"]],
  ["fork", ["fork", "seat@rig-a", "--rig", "rig-a", "--pod", "pod-1", "--member", "new-seat"]],
  ["bind", ["bind", "disc-1", "--rig", "rig-a", "--node", "node-1"]],
  ["bootstrap", ["bootstrap", "spec.yaml"]],
  ["bundle-install", ["bundle", "install", "bundle.rigbundle"]],
  ["reconcile-session", ["reconcile-session", "seat@rig-a"]],
  ["unclaim", ["unclaim", "seat@rig-a"]],
  ["seat-clear-attention", ["seat", "clear-attention", "seat@rig-a"]],
  ["seat-resume-token", ["seat", "set-resume-token", "seat@rig-a", "--token-stdin", "--reason", "test"]],
];

const NEW_VERB_NAMES: EntryVerb[] = NEW_VERB_CASES.map(([verb]) => verb);

// Values that Commander consumes as the following option's argument. The same
// tokens look like preview flags to a naive token scan, so these are the real
// pre-fix mutation bypasses.
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

// `--` ends option parsing but later tokens are still real positionals. This is
// root-level `--` (before the command) and command-level `--` (before a
// subcommand/positional).
const ROOT_DOUBLE_DASH_CASES: Array<[EntryVerb, string[]]> = [
  ["daemon-start", ["--", "daemon", "start"]],
  ["snapshot-create", ["--", "snapshot", "rig-a"]],
  ["seat-continue", ["--", "seat", "continue", "seat@rig-a"]],
  ["archive", ["--", "archive", "rig-a"]],
];

const COMMAND_DOUBLE_DASH_CASES: Array<[EntryVerb, string[]]> = [
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
const L0B_ROOT_DOUBLE_DASH_CASES: Array<[EntryVerb, string[]]> = [
  ["release", ["--", "release", "rig-a"]],
  ["launch-node", ["--", "launch", "rig-a", "node-1"]],
];
const L0B_COMMAND_DOUBLE_DASH_CASES: Array<[EntryVerb, string[]]> = [
  ["release", ["release", "--", "rig-a"]],
  ["launch-node", ["launch", "--", "rig-a", "node-1"]],
  ["import-rig", ["import", "--instantiate", "--", "spec.yaml"]],
];

const ALL_MUTATION_BYPASS_CASES: Array<[EntryVerb, string[]]> = [
  ...OPTION_VALUE_BYPASS_CASES,
  ...L0B_OPTION_VALUE_BYPASS_CASES,
  ...ROOT_DOUBLE_DASH_CASES,
  ...COMMAND_DOUBLE_DASH_CASES,
  ...L0B_ROOT_DOUBLE_DASH_CASES,
  ...L0B_COMMAND_DOUBLE_DASH_CASES,
];

const roots: string[] = [];

function tmpHome(prefix = "openrig-s8-core-"): string {
  const home = mkdtempSync(join(tmpdir(), prefix));
  roots.push(home);
  return home;
}

function managedHome(options: {
  marker?: boolean;
  launch?: Record<string, unknown> | null;
  rawLaunch?: string;
} = {}): string {
  const home = tmpHome();
  const entry = join(home, "entry");
  mkdirSync(entry, { recursive: true });
  if (options.marker !== false) {
    writeFileSync(
      join(entry, "managed-run.json"),
      JSON.stringify({ schemaVersion: 1, runId: "run-1" }),
    );
  }
  if (options.rawLaunch !== undefined) {
    writeFileSync(join(entry, "launch.json"), options.rawLaunch);
  } else if (options.launch !== null) {
    const base = options.launch ?? {
      schemaVersion: 1,
      launchId: "launch-1",
      runId: "run-1",
      phase: "starting",
      expiresAt: "2999-01-01T00:00:00Z",
      verbs: ALL_VERBS,
      consumed: [],
    };
    // Default the record home to the real temp home unless a test overrides it.
    const launch = { ...base, home: typeof base["home"] === "string" && base["home"] ? base["home"] : home };
    writeFileSync(join(entry, "launch.json"), JSON.stringify(launch));
  }
  return home;
}

function runHome(): string {
  const parent = tmpHome();
  const home = join(parent, "openrig-run-fixture");
  mkdirSync(home, { recursive: true });
  return home;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("classifyHome", () => {
  it("recognizes a fixture home by the sentinel marker", () => {
    const home = tmpHome();
    writeFileSync(join(home, ".openrig-fixture"), "");
    expect(classifyHome(home)).toBe("fixture");
  });

  it("recognizes the openrig-qa temp-path convention", () => {
    const parent = tmpHome();
    const home = join(parent, "openrig-qa-matrix");
    mkdirSync(home, { recursive: true });
    expect(classifyHome(home)).toBe("fixture");
  });

  it("treats a readable managed-run marker as managed", () => {
    expect(classifyHome(managedHome())).toBe("managed");
  });

  it("keeps a corrupt managed-run marker fail-closed as managed", () => {
    const home = tmpHome();
    mkdirSync(join(home, "entry"), { recursive: true });
    writeFileSync(join(home, "entry", "managed-run.json"), "{not json");
    expect(classifyHome(home)).toBe("managed");
  });

  it("recognizes an S2 run-shaped path without treating it as managed", () => {
    expect(classifyHome(runHome())).toBe("run-shaped");
  });

  it("classifies everything else as other", () => {
    expect(classifyHome(tmpHome())).toBe("other");
  });

  it("keeps fixture precedence over a managed marker", () => {
    const home = managedHome();
    writeFileSync(join(home, ".openrig-fixture"), "");
    expect(classifyHome(home)).toBe("fixture");
  });
});

describe("classifyEntryVerb", () => {
  it("retains the original six startup entry verbs", () => {
    expect(classifyEntryVerb(["daemon", "start"])).toEqual({ mode: "entry", verb: "daemon-start" });
    expect(classifyEntryVerb(["up", "spec.yaml"])).toEqual({ mode: "entry", verb: "up" });
    expect(classifyEntryVerb(["restore", "apply", "snap-1"])).toEqual({
      mode: "entry",
      verb: "restore-apply",
    });
    expect(classifyEntryVerb(["restore", "snap-1", "--rig", "rig-1"])).toEqual({
      mode: "entry",
      verb: "restore-apply",
    });
    expect(classifyEntryVerb(["workflow", "instantiate", "wf.yaml"])).toEqual({
      mode: "entry",
      verb: "workflow-instantiate",
    });
    expect(classifyEntryVerb(["workflow", "instantiate-lifecycle", "wf.yaml"])).toEqual({
      mode: "entry",
      verb: "workflow-instantiate-lifecycle",
    });
    expect(classifyEntryVerb(["workflow", "run", "wf.yaml"])).toEqual({
      mode: "entry",
      verb: "workflow-run",
    });
  });

  it("classifies every newly recognized lifecycle mutation shape", () => {
    for (const [verb, argv] of NEW_VERB_CASES) {
      expect(classifyEntryVerb(argv), argv.join(" ")).toEqual({ mode: "entry", verb });
    }
    expect(classifyEntryVerb(["compact", "seat@rig-a", "--cancel"])).toEqual({
      mode: "entry",
      verb: "compact",
    });
    expect(classifyEntryVerb(["handover", "seat@rig-a", "--reason", "test"])).toEqual({
      mode: "entry",
      verb: "seat-handover",
    });
    expect(classifyEntryVerb(["workflow", "project"])).toEqual({
      mode: "entry",
      verb: "workflow-project",
    });
  });

  it("classifies option-value collision shapes as mutations, not previews", () => {
    for (const [verb, argv] of OPTION_VALUE_BYPASS_CASES) {
      expect(classifyEntryVerb(argv), argv.join(" ")).toEqual({ mode: "entry", verb });
    }
  });

  it("keeps import read-only when mutation-looking tokens are option values", () => {
    const cases: string[][] = [
      ["import", "spec.yaml", "--target-rig", "--instantiate"],
      ["import", "spec.yaml", "--rig-root", "--materialize-only"],
      ["import", "spec.yaml", "--cwd", "--instantiate"],
    ];
    for (const argv of cases) {
      expect(classifyEntryVerb(argv), argv.join(" ")).toEqual({ mode: "not_entry", verb: null });
    }
    expect(classifyEntryVerb(["import", "spec.yaml", "--target-rig", "rig-a", "--instantiate"])).toEqual({
      mode: "entry",
      verb: "import-rig",
    });
    expect(classifyEntryVerb(["import", "spec.yaml", "--materialize-only"])).toEqual({
      mode: "entry",
      verb: "import-rig",
    });
    // S10 r3 S2-9 — workspace-only writes rigRepo.setRigWorkspace; only preflight
    // (and the no-flag validate-only default) is read-only.
    expect(
      classifyEntryVerb(["import", "spec.yaml", "--workspace-only", "--target-rig", "rig-a"]),
    ).toEqual({
      mode: "entry",
      verb: "import-rig",
    });
    expect(classifyEntryVerb(["import", "spec.yaml", "--preflight"])).toEqual({
      mode: "not_entry",
      verb: null,
    });

    const deniedWorkspaceOnly = checkEntry({
      argv: ["import", "spec.yaml", "--workspace-only", "--target-rig", "rig-a"],
      home: managedHome({ launch: null }),
      env: {},
    });
    expect(deniedWorkspaceOnly.allow).toBe(false);
    expect(deniedWorkspaceOnly.verb).toBe("import-rig");
    expect(deniedWorkspaceOnly.code).toBe("entry_guard_denied");

    const denied = checkEntry({
      argv: ["import", "spec.yaml", "--materialize-only"],
      home: managedHome({ launch: null }),
      env: {},
    });
    expect(denied.allow).toBe(false);
    expect(denied.verb).toBe("import-rig");
    expect(denied.code).toBe("entry_guard_denied");

    const allowed = checkEntry({
      argv: ["import", "spec.yaml", "--materialize-only"],
      home: managedHome({
        launch: {
          schemaVersion: 1,
          launchId: "launch-1",
          runId: "run-1",
          phase: "starting",
          expiresAt: "2999-01-01T00:00:00Z",
          verbs: ["import-rig"],
          consumed: [],
        },
      }),
      env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-1" },
    });
    expect(allowed.allow).toBe(true);
    expect(allowed.verb).toBe("import-rig");
  });

  it("treats option-position help/version as non-entry and value/positional help as data", () => {
    const helpCases: string[][] = [
      ["archive", "--help"],
      ["compact", "--help"],
      ["seat", "launch", "--help"],
      ["workflow", "project", "--help"],
      ["bundle", "install", "--help"],
      ["--help", "archive"],
      ["-h", "archive"],
      ["--version", "archive"],
      ["-V", "archive"],
      ["archive", "--version"],
      ["archive", "-h"],
      ["compact", "-V"],
      ["seat", "launch", "seat@rig-a", "--fresh", "--reason", "--version"],
      ["bundle", "install", "bundle.rigbundle", "--target", "-V"],
      ["workflow", "project", "--instance", "--version"],
      ["launch", "rig-a", "--seats", "-V"],
    ];
    for (const argv of helpCases) {
      expect(classifyEntryVerb(argv), argv.join(" ")).toEqual({ mode: "not_entry", verb: null });
    }

    expect(
      classifyEntryVerb(["seat", "launch", "seat@rig-a", "--fresh", "--reason", "--help"]),
    ).toEqual({
      mode: "entry",
      verb: "seat-launch",
    });
    expect(classifyEntryVerb(["launch", "rig-a", "--seats", "--help"])).toEqual({
      mode: "entry",
      verb: "launch-node",
    });
    expect(classifyEntryVerb(["bundle", "install", "bundle.rigbundle", "--target", "--help"])).toEqual({
      mode: "entry",
      verb: "bundle-install",
    });
    expect(classifyEntryVerb(["seat", "launch", "seat@rig-a", "--", "--help"])).toEqual({
      mode: "entry",
      verb: "seat-launch",
    });
    expect(classifyEntryVerb(["archive", "--", "--help"])).toEqual({
      mode: "entry",
      verb: "archive",
    });
    expect(classifyEntryVerb(["archive", "--", "--version"])).toEqual({
      mode: "entry",
      verb: "archive",
    });
  });

  it("keeps workflow revise read-only when --apply is an option value", () => {
    for (const argv of [
      ["workflow", "revise", "wf-1", "--reason", "--apply"],
      ["workflow", "revise", "wf-1", "--operation-key", "--apply"],
      ["workflow", "revise", "wf-1", "--actor-session", "--apply"],
      ["workflow", "revise", "wf-1", "--expected-digest", "--apply"],
    ]) {
      expect(classifyEntryVerb(argv), argv.join(" ")).toEqual({ mode: "not_entry", verb: null });
    }
  });

  it("does not consume a positional after an unknown/boolean option", () => {
    expect(classifyEntryVerb(["snapshot", "--json", "rig-a"])).toEqual({
      mode: "entry",
      verb: "snapshot-create",
    });
    expect(classifyEntryVerb(["seat", "--json", "continue", "seat@rig-a"])).toEqual({
      mode: "entry",
      verb: "seat-continue",
    });
    expect(classifyEntryVerb(["workflow", "--json", "project"])).toEqual({
      mode: "entry",
      verb: "workflow-project",
    });
  });

  it("supports --opt=value without consuming the following positional", () => {
    expect(classifyEntryVerb(["snapshot", "--intended-seats=list", "rig-a"])).toEqual({
      mode: "entry",
      verb: "snapshot-create",
    });
    expect(classifyEntryVerb(["restore", "--rig=status", "snap-1"])).toEqual({
      mode: "entry",
      verb: "restore-apply",
    });
    expect(classifyEntryVerb(["seat", "launch", "seat@rig-a", "--reason=--plan"])).toEqual({
      mode: "entry",
      verb: "seat-launch",
    });
    expect(classifyEntryVerb(["workflow", "revise", "wf-1", "--reason=--apply"])).toEqual({
      mode: "not_entry",
      verb: null,
    });
  });

  it("continues command and subcommand discovery after root-level or command-level --", () => {
    for (const [verb, argv] of [...ROOT_DOUBLE_DASH_CASES, ...COMMAND_DOUBLE_DASH_CASES]) {
      expect(classifyEntryVerb(argv), argv.join(" ")).toEqual({ mode: "entry", verb });
    }
    expect(classifyEntryVerb(["snapshot", "--", "list", "rig-a"])).toEqual({
      mode: "not_entry",
      verb: null,
    });
    expect(classifyEntryVerb(["restore", "--", "status", "snap-1"])).toEqual({
      mode: "not_entry",
      verb: null,
    });
    // After `--`, `--plan` is positional data; it is not a preview flag.
    expect(classifyEntryVerb(["seat", "launch", "seat@rig-a", "--", "--plan"])).toEqual({
      mode: "entry",
      verb: "seat-launch",
    });
  });

  it("keeps root-level and command-level -- variants of import read-only", () => {
    const cases: string[][] = [
      ["--", "import", "spec.yaml"],
      ["import", "--", "spec.yaml"],
      ["--", "import", "spec.yaml", "--instantiate"],
      ["import", "--", "spec.yaml", "--instantiate"],
    ];
    for (const argv of cases) {
      expect(classifyEntryVerb(argv), argv.join(" ")).toEqual({ mode: "not_entry", verb: null });
    }
  });

  it("records down, daemon stop and destroy as named accepted risk, not lifecycle entries", () => {
    expect(ACCEPTED_RISK_CLI_COMMANDS).toEqual(["down", "daemon stop", "destroy"]);
    const cases: string[][] = [
      ["down", "rig-a"],
      ["daemon", "stop"],
      ["destroy", "--yes", "--confirm", "destroy-rig-a"],
    ];
    for (const argv of cases) {
      expect(classifyEntryVerb(argv), argv.join(" ")).toEqual({ mode: "not_entry", verb: null });
    }
    const home = managedHome({ launch: null });
    for (const argv of cases) {
      const decision = checkEntry({ argv, home, env: {} });
      expect(decision.allow, argv.join(" ")).toBe(true);
      expect(decision.mode, argv.join(" ")).toBe("not_entry");
    }
  });

  it("keeps read-only and preview shapes out of the entry table", () => {
    const cases: string[][] = [
      ["snapshot", "list", "rig-a"],
      ["restore", "status", "attempt-1", "--rig", "rig-a"],
      ["compact", "seat@rig-a", "--state"],
      ["compact", "--state", "seat@rig-a"],
      ["seat", "launch", "seat@rig-a", "--fresh", "--plan"],
      ["seat", "restart", "seat@rig-a", "--keep-conversation", "--plan"],
      ["seat", "restart", "seat@rig-a", "--keep-conversation", "--verify"],
      ["seat", "handover", "seat@rig-a", "--dry-run"],
      ["handover", "seat@rig-a", "--dry-run"],
      ["workflow", "revise", "wf-1"],
      ["workflow", "continue", "wf-1"],
      ["workflow", "validate", "spec.yaml"],
      ["workflow", "compile", "mission.yaml"],
      ["workflow", "list"],
      ["workflow", "specs"],
      ["workflow", "guidance", "wf-1"],
      ["workflow", "show", "wf-1"],
      ["workflow", "trace", "wf-1"],
      ["workflow", "status"],
      ["workflow", "watch", "wf-1"],
      ["workflow", "operation", "op-1"],
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
      ["snapshot"],
      ["restore"],
    ];
    for (const argv of cases) {
      expect(classifyEntryVerb(argv), argv.join(" ")).toEqual({ mode: "not_entry", verb: null });
    }
  });

  it("finds --existing before or after the source", () => {
    expect(classifyEntryVerb(["up", "--existing", "rig-a"])).toEqual({
      mode: "recovery",
      verb: null,
    });
    expect(classifyEntryVerb(["up", "rig-a", "--existing"])).toEqual({
      mode: "recovery",
      verb: null,
    });
  });

  it("classifies --host and --host=<id> as remote", () => {
    expect(classifyEntryVerb(["up", "spec.yaml", "--host", "remote1"])).toEqual({
      mode: "remote",
      verb: null,
    });
    expect(classifyEntryVerb(["up", "spec.yaml", "--host=remote1"])).toEqual({
      mode: "remote",
      verb: null,
    });
  });

  it("stops flag scanning at --", () => {
    expect(classifyEntryVerb(["up", "spec.yaml", "--", "--existing"])).toEqual({
      mode: "entry",
      verb: "up",
    });
    expect(classifyEntryVerb(["compact", "seat@rig-a", "--", "--state"])).toEqual({
      mode: "entry",
      verb: "compact",
    });
    expect(classifyEntryVerb(["seat", "launch", "seat@rig-a", "--", "--plan"])).toEqual({
      mode: "entry",
      verb: "seat-launch",
    });
    expect(classifyEntryVerb(["workflow", "revise", "wf-1", "--", "--apply"])).toEqual({
      mode: "not_entry",
      verb: null,
    });
  });

  it("treats read/stop/other commands as not_entry", () => {
    for (const argv of [
      ["down", "rig-a"],
      ["daemon", "stop"],
      ["daemon", "status"],
      ["ps", "--nodes"],
      ["queue", "list"],
      ["context", "list"],
      ["start"],
    ]) {
      expect(classifyEntryVerb(argv)).toEqual({ mode: "not_entry", verb: null });
    }
  });

  it("skips leading global output flags before the command", () => {
    expect(classifyEntryVerb(["-o", "json", "daemon", "start"])).toEqual({
      mode: "entry",
      verb: "daemon-start",
    });
    expect(classifyEntryVerb(["--format", "json", "snapshot", "rig-a"])).toEqual({
      mode: "entry",
      verb: "snapshot-create",
    });
  });
});

describe("recognized lifecycle verbs and launch defaults", () => {
  it("recognizes every lifecycle verb and separates single-use startup from repeatable continuation", () => {
    expect(STARTUP_LAUNCH_VERBS).toEqual([
      "daemon-start",
      "up",
      "restore-apply",
      "workflow-instantiate",
      "workflow-instantiate-lifecycle",
      "workflow-run",
    ]);
    expect(CONTINUATION_VERBS).toEqual([
      "workflow-route",
      "workflow-resume",
      "workflow-abort",
      "workflow-revision",
      "workflow-project",
    ]);
    expect(DEFAULT_LAUNCH_VERBS).toEqual([...STARTUP_LAUNCH_VERBS, ...CONTINUATION_VERBS]);
    expect(new Set(ENTRY_VERBS)).toEqual(new Set([...STARTUP_LAUNCH_VERBS, ...NEW_VERB_NAMES]));
    for (const verb of CONTINUATION_VERBS) expect(isContinuationVerb(verb), verb).toBe(true);
    for (const verb of STARTUP_LAUNCH_VERBS) expect(isContinuationVerb(verb), verb).toBe(false);
    // Recognition is not a blanket grant: non-continuation lifecycle verbs still
    // need an explicit launch-record entry.
    for (const verb of NEW_VERB_NAMES.filter((name) => !CONTINUATION_VERBS.includes(name))) {
      expect(DEFAULT_LAUNCH_VERBS, verb).not.toContain(verb);
    }
  });

  it("does not let the default launch authorize a non-continuation lifecycle verb", () => {
    const home = managedHome({
      launch: {
        schemaVersion: 1,
        launchId: "launch-1",
        runId: "run-1",
        phase: "starting",
        expiresAt: "2999-01-01T00:00:00Z",
        verbs: [...DEFAULT_LAUNCH_VERBS],
        consumed: [],
      },
    });
    const decision = checkEntry({
      argv: ["snapshot", "rig-a"],
      home,
      env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-1" },
    });
    expect(decision.allow).toBe(false);
    expect(decision.verb).toBe("snapshot-create");
    expect(decision.code).toBe("entry_guard_verb_consumed");
  });

  it("allows workflow continuation repeatedly within one launch without spending the startup ledger", () => {
    const continuationCases = NEW_VERB_CASES.filter(([verb]) => CONTINUATION_VERBS.includes(verb));
    expect(continuationCases.map(([verb]) => verb).sort()).toEqual([...CONTINUATION_VERBS].sort());
    for (const [verb, argv] of continuationCases) {
      const home = managedHome({
        launch: {
          schemaVersion: 1,
          launchId: "launch-1",
          runId: "run-1",
          phase: "active",
          expiresAt: "2999-01-01T00:00:00Z",
          verbs: [verb],
          consumed: [],
        },
      });
      const env = { OPENRIG_ENTRY_LAUNCH_ID: "launch-1" };
      const first = checkEntry({ argv, home, env });
      const second = checkEntry({ argv, home, env });
      const third = checkEntry({ argv, home, env });
      expect(first.allow, argv.join(" ")).toBe(true);
      expect(second.allow, argv.join(" ")).toBe(true);
      expect(third.allow, argv.join(" ")).toBe(true);
      expect(readConsumedLedger(home, "launch-1").size, argv.join(" ")).toBe(0);
      expect(readLaunchRecord(home).record?.consumed, argv.join(" ")).toEqual([]);
    }
  });

  it("still single-consumes a startup verb even when the launch also authorizes continuation", () => {
    const home = managedHome(); // default verbs now include continuation
    const env = { OPENRIG_ENTRY_LAUNCH_ID: "launch-1" };
    expect(checkEntry({ argv: ["workflow", "project"], home, env }).allow).toBe(true);
    expect(checkEntry({ argv: ["workflow", "project"], home, env }).allow).toBe(true);
    expect(checkEntry({ argv: ["daemon", "start"], home, env }).allow).toBe(true);
    const replay = checkEntry({ argv: ["daemon", "start"], home, env });
    expect(replay.allow).toBe(false);
    expect(replay.code).toBe("entry_guard_verb_consumed");
    expect(readConsumedLedger(home, "launch-1").has("workflow-project")).toBe(false);
    expect(readConsumedLedger(home, "launch-1").has("daemon-start")).toBe(true);
  });
});

describe("readLaunchRecord", () => {
  it("reports a missing record as entry_guard_denied", () => {
    const result = readLaunchRecord(managedHome({ launch: null }));
    expect(result.ok).toBe(false);
    expect(result.code).toBe("entry_guard_denied");
  });

  it("reports unreadable JSON as entry_guard_denied", () => {
    const result = readLaunchRecord(managedHome({ rawLaunch: "{oops" }));
    expect(result.ok).toBe(false);
    expect(result.code).toBe("entry_guard_denied");
  });

  it("reports an unsupported schema before anything else", () => {
    const result = readLaunchRecord(managedHome({ launch: { schemaVersion: 2 } }));
    expect(result.ok).toBe(false);
    expect(result.code).toBe("entry_guard_schema_unsupported");
  });

  it("accepts a valid v1 record", () => {
    const home = managedHome();
    const result = readLaunchRecord(home);
    expect(result.ok).toBe(true);
    expect(result.record?.launchId).toBe("launch-1");
    expect(result.record?.verbs).toEqual(ALL_VERBS);
  });

  it("accepts newly recognized lifecycle verbs in the record", () => {
    const home = managedHome({
      launch: {
        schemaVersion: 1,
        launchId: "launch-1",
        runId: "run-1",
        phase: "starting",
        expiresAt: "2999-01-01T00:00:00Z",
        verbs: [...NEW_VERB_NAMES],
        consumed: [],
      },
    });
    const result = readLaunchRecord(home);
    expect(result.ok).toBe(true);
    expect(result.record?.verbs).toEqual(NEW_VERB_NAMES);
  });

  it("rejects an unknown verb in the record", () => {
    const home = managedHome({
      launch: {
        schemaVersion: 1,
        launchId: "launch-1",
        home: "",
        runId: "run-1",
        phase: "starting",
        expiresAt: "2999-01-01T00:00:00Z",
        verbs: ["rm-rf"],
        consumed: [],
      },
    });
    expect(readLaunchRecord(home).ok).toBe(false);
  });
});

describe("checkEntry — early returns", () => {
  const managedNoRecord = () => managedHome({ launch: null });

  it("never reads a home for a not_entry command", () => {
    const decision = checkEntry({
      argv: ["ps", "--nodes"],
      home: "/nonexistent",
      env: {},
    });
    expect(decision.allow).toBe(true);
    expect(decision.mode).toBe("not_entry");
  });

  it("passes when OPENRIG_ENTRY_GUARD=off", () => {
    const decision = checkEntry({
      argv: ["daemon", "start"],
      home: managedNoRecord(),
      env: { OPENRIG_ENTRY_GUARD: "off" },
    });
    expect(decision.allow).toBe(true);
    expect(decision.mode).toBe("entry");
  });

  it("warns but passes a remote up", () => {
    const decision = checkEntry({
      argv: ["up", "spec.yaml", "--host", "remote1"],
      home: managedNoRecord(),
      env: {},
    });
    expect(decision.allow).toBe(true);
    expect(decision.warn).toBe(true);
    expect(decision.mode).toBe("remote");
  });

  it("passes recovery up --existing without reading the record", () => {
    const decision = checkEntry({
      argv: ["up", "rig-a", "--existing"],
      home: managedHome({ launch: null }),
      env: {},
    });
    expect(decision.allow).toBe(true);
    expect(decision.mode).toBe("recovery");
  });

  it("passes a fixture home", () => {
    const home = managedHome();
    writeFileSync(join(home, ".openrig-fixture"), "");
    expect(checkEntry({ argv: ["daemon", "start"], home, env: {} }).allow).toBe(true);
  });

  it("passes a non-run home", () => {
    const home = tmpHome();
    const decision = checkEntry({ argv: ["daemon", "start"], home, env: {} });
    expect(decision.allow).toBe(true);
    expect(decision.homeKind).toBe("other");
  });

  it("warns but passes a run-shaped home without a marker", () => {
    const decision = checkEntry({ argv: ["up", "spec.yaml"], home: runHome(), env: {} });
    expect(decision.allow).toBe(true);
    expect(decision.warn).toBe(true);
    expect(decision.homeKind).toBe("run-shaped");
  });
});

describe("checkEntry — managed authorization order", () => {
  it("denies a managed home without a launch record", () => {
    const decision = checkEntry({
      argv: ["daemon", "start"],
      home: managedHome({ launch: null }),
      env: {},
    });
    expect(decision.allow).toBe(false);
    expect(decision.code).toBe("entry_guard_denied");
    expect(decision.reason).toContain("launch record");
  });

  it("denies every newly recognized lifecycle verb on a managed home without a launch record", () => {
    const home = managedHome({ launch: null });
    for (const [verb, argv] of NEW_VERB_CASES) {
      const decision = checkEntry({ argv, home, env: {} });
      expect(decision.allow, argv.join(" ")).toBe(false);
      expect(decision.verb, argv.join(" ")).toBe(verb);
      expect(decision.code, argv.join(" ")).toBe("entry_guard_denied");
    }
  });

  it("denies option-value and double-dash mutation bypasses on a managed home without a record", () => {
    const home = managedHome({ launch: null });
    for (const [verb, argv] of ALL_MUTATION_BYPASS_CASES) {
      const decision = checkEntry({ argv, home, env: {} });
      expect(decision.allow, argv.join(" ")).toBe(false);
      expect(decision.verb, argv.join(" ")).toBe(verb);
      expect(decision.code, argv.join(" ")).toBe("entry_guard_denied");
    }
  });

  it("keeps option-value workflow revise read-only on a managed home without a record", () => {
    const decision = checkEntry({
      argv: ["workflow", "revise", "wf-1", "--reason", "--apply"],
      home: managedHome({ launch: null }),
      env: {},
    });
    expect(decision.allow).toBe(true);
    expect(decision.mode).toBe("not_entry");
    expect(decision.verb).toBeNull();
  });

  it("allows option-value and double-dash mutations only with explicit launch-record verbs", () => {
    for (const [verb, argv] of ALL_MUTATION_BYPASS_CASES) {
      const home = managedHome({
        launch: {
          schemaVersion: 1,
          launchId: "launch-1",
          runId: "run-1",
          phase: "starting",
          expiresAt: "2999-01-01T00:00:00Z",
          verbs: [verb],
          consumed: [],
        },
      });
      const decision = checkEntry({
        argv,
        home,
        env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-1" },
      });
      expect(decision.allow, argv.join(" ")).toBe(true);
      expect(decision.verb, argv.join(" ")).toBe(verb);
      expect(readLaunchRecord(home).record?.consumed.map((c) => c.verb), argv.join(" ")).toContain(verb);
    }
  });

  it("allows each new lifecycle verb when the launch record explicitly authorizes it", () => {
    for (const [verb, argv] of NEW_VERB_CASES) {
      const home = managedHome({
        launch: {
          schemaVersion: 1,
          launchId: "launch-1",
          runId: "run-1",
          phase: "starting",
          expiresAt: "2999-01-01T00:00:00Z",
          verbs: [verb],
          consumed: [],
        },
      });
      const decision = checkEntry({
        argv,
        home,
        env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-1" },
      });
      expect(decision.allow, argv.join(" ")).toBe(true);
      expect(decision.verb, argv.join(" ")).toBe(verb);
      if (isContinuationVerb(verb)) {
        expect(
          readLaunchRecord(home).record?.consumed.map((c) => c.verb),
          argv.join(" "),
        ).not.toContain(verb);
        expect(readConsumedLedger(home, "launch-1").has(verb), argv.join(" ")).toBe(false);
      } else {
        expect(
          readLaunchRecord(home).record?.consumed.map((c) => c.verb),
          argv.join(" "),
        ).toContain(verb);
      }
    }
  });

  it("denies a home mismatch", () => {
    const home = managedHome({ launch: { schemaVersion: 1, launchId: "launch-1", home: "/tmp/elsewhere", runId: "r", phase: "starting", expiresAt: "2999-01-01T00:00:00Z", verbs: ALL_VERBS, consumed: [] } });
    expect(checkEntry({ argv: ["daemon", "start"], home, env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-1" }, }).code).toBe("entry_guard_home_mismatch");
  });

  it("denies an expired record", () => {
    const home = managedHome({
      launch: {
        schemaVersion: 1,
        launchId: "launch-1",
        runId: "r",
        phase: "starting",
        expiresAt: "2020-01-01T00:00:00Z",
        verbs: ALL_VERBS,
        consumed: [],
      },
    });
    const decision = checkEntry({
      argv: ["daemon", "start"],
      home,
      env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-1" },
    });
    expect(decision.code).toBe("entry_guard_expired");
  });

  it("denies a closed launch", () => {
    const home = managedHome();
    const record = readLaunchRecord(home).record!;
    writeFileSync(join(home, "entry", "launch.json"), JSON.stringify({ ...record, phase: "closed" }));
    const decision = checkEntry({
      argv: ["daemon", "start"],
      home,
      env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-1" },
    });
    expect(decision.code).toBe("entry_guard_closed");
  });

  it("denies a token mismatch", () => {
    const home = managedHome();
    const decision = checkEntry({
      argv: ["daemon", "start"],
      home,
      env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-other" },
    });
    expect(decision.code).toBe("entry_guard_token_mismatch");
  });

  it("denies a verb outside the launch's verbs", () => {
    const home = managedHome();
    const record = readLaunchRecord(home).record!;
    writeFileSync(join(home, "entry", "launch.json"), JSON.stringify({ ...record, verbs: ["up"] }));
    const decision = checkEntry({
      argv: ["daemon", "start"],
      home,
      env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-1" },
    });
    expect(decision.code).toBe("entry_guard_verb_consumed");
  });

  it("denies a verb already consumed on disk", () => {
    const home = managedHome();
    const record = readLaunchRecord(home).record!;
    record.consumed = [{ verb: "daemon-start", at: "2026-01-01T00:00:00Z", pid: 1 }];
    writeFileSync(join(home, "entry", "launch.json"), JSON.stringify(record));
    const decision = checkEntry({
      argv: ["daemon", "start"],
      home,
      env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-1" },
    });
    expect(decision.code).toBe("entry_guard_verb_consumed");
  });

  it("allows and records the verb, then denies a second use without an in-process pass", () => {
    const home = managedHome();
    const env = { OPENRIG_ENTRY_LAUNCH_ID: "launch-1" };
    const first = checkEntry({ argv: ["daemon", "start"], home, env });
    expect(first.allow).toBe(true);
    expect(first.launchId).toBe("launch-1");
    const after = readLaunchRecord(home).record!;
    expect(after.consumed.map((c) => c.verb)).toContain("daemon-start");

    const second = checkEntry({ argv: ["daemon", "start"], home, env });
    expect(second.code).toBe("entry_guard_verb_consumed");

    const inProcess = checkEntry({
      argv: ["daemon", "start"],
      home,
      env,
      alreadyConsumed: ["daemon-start"],
    });
    expect(inProcess.allow).toBe(true);
  });

  it("denies a record missing runId only after the authorization predicates", () => {
    const home = managedHome({
      launch: {
        schemaVersion: 1,
        launchId: "launch-1",
        phase: "starting",
        expiresAt: "2999-01-01T00:00:00Z",
        verbs: ALL_VERBS,
        consumed: [],
      },
    });
    const decision = checkEntry({
      argv: ["daemon", "start"],
      home,
      env: { OPENRIG_ENTRY_LAUNCH_ID: "launch-1" },
    });
    expect(decision.code).toBe("entry_guard_denied");
    expect(decision.reason).toContain("runId");
  });
});

describe("appendAudit", () => {
  it("writes one JSON line when entry/ exists", () => {
    const home = managedHome();
    appendAudit(home, {
      decision: "allow_override",
      code: null,
      verb: "up",
      argv: ["up", "x"],
      runId: null,
      launchId: null,
      home,
    });
    const path = join(home, "entry", "audit.jsonl");
    expect(existsSync(path)).toBe(true);
    const lines = readFileSync(path, "utf8").trim().split("\n");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!).decision).toBe("allow_override");
  });

  it("never creates the entry directory", () => {
    const home = tmpHome();
    appendAudit(home, {
      decision: "deny",
      code: "entry_guard_denied",
      verb: "up",
      argv: ["up", "x"],
      runId: null,
      launchId: null,
      home,
    });
    expect(existsSync(join(home, "entry"))).toBe(false);
  });

  it("redacts --env values and keeps eight argv items", () => {
    expect(redactArgv(["up", "x", "--env", "SECRET=1", "a", "b", "c", "d", "e"])).toEqual([
      "up",
      "x",
      "--env",
      "<redacted>",
      "a",
      "b",
      "c",
      "d",
    ]);
    expect(redactArgv(["up", "--env=SECRET=1"])).toEqual(["up", "--env=<redacted>"]);
  });
});
