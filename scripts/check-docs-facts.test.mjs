import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkDocLinks,
  checkDocsIndexes,
  checkCountFacts,
  runChecks,
} from "./check-docs-facts.mjs";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

function write(root, rel, text) {
  const path = join(root, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, "utf-8");
}

function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), "check-docs-facts-"));
  write(
    root,
    "packages/daemon/src/domain/workflow-types.ts",
    'export const WORKFLOW_EXIT_KINDS = ["handoff", "waiting", "done", "failed"] as const;\n' +
      'export const WORKFLOW_AGENT_HARNESSES = ["claude-code", "codex", "opencode", "dsh"] as const;\n',
  );
  write(
    root,
    "packages/daemon/src/domain/built-in-runtimes.ts",
    'export const BUILT_IN_RUNTIMES: ReadonlySet<string> = new Set(["claude-code", "codex", "pi", "omp", "opencode", "dsh", "terminal", "stub"]);\n',
  );
  write(
    root,
    "packages/daemon/src/domain/queue-repository.ts",
    'export const QUEUE_STATES = ["pending", "in-progress", "done", "blocked", "failed", "denied", "canceled", "handed-off"] as const;\n',
  );
  write(
    root,
    "packages/daemon/src/domain/hot-potato-enforcer.ts",
    'export const CLOSURE_REASONS = ["handed_off_to", "blocked_on", "denied", "canceled", "no-follow-on", "escalation", "superseded"] as const;\n',
  );
  write(
    root,
    "packages/daemon/src/adapters/one.ts",
    "export class OneAdapter implements RuntimeAdapter {}\n",
  );
  write(
    root,
    "packages/daemon/src/adapters/two.ts",
    "export class TwoAdapter implements RuntimeAdapter {}\n",
  );

  write(
    root,
    "docs/as-built/architecture/workflow-runtime.md",
    "The exits are `handoff`, `waiting`, `done`, and `failed`. An exit-specific mapping takes precedence.\n\n" +
      "`WORKFLOW_AGENT_HARNESSES` contains `claude-code`, `codex`, `opencode`, and `dsh`. `terminal` stays excluded. Nonlocal pins are separate.\n",
  );
  write(
    root,
    "docs/reference/rig-spec.md",
    "Current supported values: `claude-code`, `codex`, `pi`, `omp`, `opencode`, `dsh`, `terminal`, `stub`. `stub` is a deterministic test harness.\n",
  );
  write(
    root,
    "docs/as-built/architecture/daemon-core.md",
    "Wires **8** runtime keys — `claude-code`, `codex`, `pi`, `omp`, `opencode`, `dsh`, `stub`, `terminal` (`startup.ts:1`).\n" +
      "The\nadapter-class and runtime-key rows are refreshed.\n\n" +
      "| Runtime adapter classes | **2**: Two | `git grep` |\n" +
      "| MCP tools | 18 | `grep` |\n",
  );
  write(
    root,
    "docs/as-built/architecture/adapters-and-runtimes.md",
    "**2** classes implement `RuntimeAdapter` (command). All live under `packages/daemon/src/adapters/`.\n\n" +
      "`OmpRuntimeAdapter` extends `PiRuntimeAdapter`, so the daemon wires\n" +
      "**8** runtime keys — `claude-code`, `codex`, `pi`, `omp`, `opencode`, `dsh`,\n" +
      "`stub`, `terminal` (`startup.ts:1157`).\n\n" +
      "### Launch posture\n",
  );
  write(
    root,
    "docs/as-built/architecture/coordination-primitive.md",
    "State enum (**8** values, `QUEUE_STATES` at `queue-repository.ts:33`;\n" +
      "`sed -n '/^export const QUEUE_STATES/,/] as const/p' file | grep -c '^  \"'`):\n" +
      "`pending | in-progress | done | blocked | failed | denied | canceled |\n" +
      "handed-off`. Carries `closure_reason`.\n\n" +
      "`state=done` requires `closure_reason ∈ {handed_off_to, blocked_on, denied,\n" +
      "canceled, no-follow-on, escalation, superseded}`. The reasons\n" +
      "`handed_off_to | blocked_on | escalation` additionally require a target.\n" +
      "against `CLOSURE_REASONS` (`:18`; **7** values:\n",
  );

  write(
    root,
    "docs/reference/README.md",
    "# index\n\n| [rig-spec.md](rig-spec.md) | shipped |\n",
  );
  write(
    root,
    "docs/as-built/README.md",
    "# index\n\n| [workflow-runtime.md](architecture/workflow-runtime.md) |\n" +
      "| [daemon-core.md](architecture/daemon-core.md) |\n" +
      "| [adapters-and-runtimes.md](architecture/adapters-and-runtimes.md) |\n" +
      "| [coordination-primitive.md](architecture/coordination-primitive.md) |\n",
  );
  return root;
}

function withFixture(fn) {
  const root = makeFixture();
  try {
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("clean fixture produces no findings", () => {
  withFixture((root) => {
    assert.deepEqual(runChecks({ root }), []);
  });
});

test("a drifted exit-kind sentence fails with the fact id", () => {
  withFixture((root) => {
    write(
      root,
      "docs/as-built/architecture/workflow-runtime.md",
      "The exits are `handoff`, `done`, and `failed`. An exit-specific mapping takes precedence.\n\n" +
        "`WORKFLOW_AGENT_HARNESSES` contains `claude-code`, `codex`, `opencode`, and `dsh`. `terminal` stays excluded. Nonlocal pins are separate.\n",
    );
    const findings = runChecks({ root });
    assert.ok(
      findings.some((f) => f.code === "workflow-exit-kinds" && /missing waiting/.test(f.message)),
      JSON.stringify(findings),
    );
  });
});

test("a drifted built-in runtime list fails", () => {
  withFixture((root) => {
    write(
      root,
      "docs/reference/rig-spec.md",
      "Current supported values: `claude-code`, `codex`, `pi`, `omp`, `terminal`, `stub`. `stub` is a deterministic test harness.\n",
    );
    const findings = runChecks({ root });
    assert.ok(
      findings.some(
        (f) => f.code === "builtin-runtimes" && /missing opencode, dsh/.test(f.message),
      ),
      JSON.stringify(findings),
    );
  });
});

test("a stale quoted adapter count fails", () => {
  withFixture((root) => {
    write(
      root,
      "docs/as-built/architecture/daemon-core.md",
      "Wires **8** runtime keys — `claude-code`, `codex`, `pi`, `omp`, `opencode`, `dsh`, `stub`, `terminal` (`startup.ts:1`).\n" +
        "The\nadapter-class and runtime-key rows are refreshed.\n\n" +
        "| Runtime adapter classes | **5**: Two | `git grep` |\n" +
        "| MCP tools | 18 | `grep` |\n",
    );
    const findings = checkCountFacts(root);
    assert.ok(
      findings.some(
        (f) => f.code === "runtime-adapter-implementations" && /declares 5/.test(f.message),
      ),
      JSON.stringify(findings),
    );
  });
});

test("a new adapter implementation makes the documented count stale", () => {
  withFixture((root) => {
    write(
      root,
      "packages/daemon/src/adapters/three.ts",
      "export class ThreeAdapter implements RuntimeAdapter {}\n",
    );
    const findings = checkCountFacts(root);
    assert.ok(
      findings.some((f) => /repository has 3/.test(f.message)),
      JSON.stringify(findings),
    );
  });
});

test("a reference page missing from the index is an error", () => {
  withFixture((root) => {
    write(root, "docs/reference/agent-spec.md", "# Agent spec\n");
    const findings = checkDocsIndexes(root);
    assert.ok(
      findings.some(
        (f) => f.code === "docs-index" && /agent-spec\.md/.test(f.message),
      ),
      JSON.stringify(findings),
    );
  });
});

test("a broken relative doc link is an error but an inline example is not", () => {
  withFixture((root) => {
    write(
      root,
      "docs/reference/rig-spec.md",
      "See [missing](missing.md). Example: `![mockup](mockups/review.png)`.\n",
    );
    const findings = checkDocLinks(root);
    assert.deepEqual(
      findings.map((f) => f.message),
      ["docs/reference/rig-spec.md links missing.md, which does not exist"],
    );
  });
});

test("a relative doc link that escapes the repository is rejected", () => {
  withFixture((root) => {
    write(
      root,
      "docs/reference/page.md",
      "See [outside](../../../../outside/README.md).\n",
    );
    const findings = checkDocLinks(root);
    assert.deepEqual(
      findings.map((f) => f.message),
      ["docs/reference/page.md links ../../../../outside/README.md, which is outside the repository"],
    );
  });
});

test("a symlinked doc target that resolves outside the repository is rejected", (t) => {
  const outside = mkdtempSync(join(tmpdir(), "check-docs-facts-outside-"));
  try {
    withFixture((root) => {
      write(root, "docs/reference/page.md", "See [outside](escape).\n");
      try {
        symlinkSync(outside, join(root, "docs/reference/escape"));
      } catch (error) {
        if (error.code === "EPERM" || error.code === "EACCES" || error.code === "ENOSYS") {
          t.skip(`symlink unavailable on this platform: ${error.code}`);
          return;
        }
        throw error;
      }
      const findings = checkDocLinks(root);
      assert.ok(
        findings.some(
          (f) => f.code === "docs-link" && f.message.includes("outside the repository"),
        ),
        JSON.stringify(findings),
      );
    });
  } finally {
    rmSync(outside, { recursive: true, force: true });
  }
});

test("a drifted queue-state list fails", () => {
  withFixture((root) => {
    write(
      root,
      "docs/as-built/architecture/coordination-primitive.md",
      "State enum (**8** values, `QUEUE_STATES` at `queue-repository.ts:33`;\n" +
        "`sed -n '/^export const QUEUE_STATES/,/] as const/p' file | grep -c '^  \"'`):\n" +
        "`pending | in-progress | done | blocked | failed | denied |\n" +
        "handed-off`. Carries `closure_reason`.\n\n" +
        "`state=done` requires `closure_reason ∈ {handed_off_to, blocked_on, denied,\n" +
        "canceled, no-follow-on, escalation, superseded}`. The reasons\n" +
        "`handed_off_to | blocked_on | escalation` additionally require a target.\n" +
        "against `CLOSURE_REASONS` (`:18`; **7** values:\n",
    );
    const findings = runChecks({ root });
    assert.ok(
      findings.some(
        (f) => f.code === "queue-states" && /missing canceled/.test(f.message),
      ),
      JSON.stringify(findings),
    );
  });
});

test("a drifted closure-reason set fails", () => {
  withFixture((root) => {
    write(
      root,
      "docs/as-built/architecture/coordination-primitive.md",
      "State enum (**8** values, `QUEUE_STATES` at `queue-repository.ts:33`;\n" +
        "`sed -n '/^export const QUEUE_STATES/,/] as const/p' file | grep -c '^  \"'`):\n" +
        "`pending | in-progress | done | blocked | failed | denied | canceled |\n" +
        "handed-off`. Carries `closure_reason`.\n\n" +
        "`state=done` requires `closure_reason ∈ {handed_off_to, blocked_on, denied,\n" +
        "canceled, no-follow-on, escalation}`. The reasons\n" +
        "`handed_off_to | blocked_on | escalation` additionally require a target.\n" +
        "against `CLOSURE_REASONS` (`:18`; **6** values:\n",
    );
    const findings = runChecks({ root });
    assert.ok(
      findings.some(
        (f) => f.code === "closure-reasons" && /missing superseded/.test(f.message),
      ),
      JSON.stringify(findings),
    );
    assert.ok(
      findings.some((f) => f.code === "closure-reasons" && /declares 6/.test(f.message)),
      JSON.stringify(findings),
    );
  });
});

test("a missing source file is a finding, not a crash", () => {
  withFixture((root) => {
    rmSync(join(root, "packages/daemon/src/domain/workflow-types.ts"));
    const findings = runChecks({ root });
    assert.ok(
      findings.some((f) => f.code === "workflow-exit-kinds-source-missing"),
      JSON.stringify(findings),
    );
  });
});

test("the real repository passes the same checks", () => {
  assert.deepEqual(runChecks({ root: REPO_ROOT }), []);
});
