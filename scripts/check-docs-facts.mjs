/**
 * Doc fact drift guard.
 *
 * The as-built and reference docs quote source-level value spaces (exit kinds,
 * workflow harnesses, runtime keys, queue states, closure reasons) and counts
 * (runtime adapter implementations). Those sentences are only useful while
 * they still match the code, and prose review is exactly what let them drift.
 *
 * This check re-derives each fact from source and compares it with the page
 * that states it. It also checks that both documentation indexes cover every
 * page, and that relative links in shipped docs resolve. A drifted sentence
 * fails with the fact id and the offending file, so the fix is mechanical.
 *
 * Run from the repository root:
 *
 *   node scripts/check-docs-facts.mjs
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const WORKFLOW_TYPES = "packages/daemon/src/domain/workflow-types.ts";
const BUILT_IN_RUNTIMES = "packages/daemon/src/domain/built-in-runtimes.ts";
const QUEUE_REPOSITORY = "packages/daemon/src/domain/queue-repository.ts";
const HOT_POTATO = "packages/daemon/src/domain/hot-potato-enforcer.ts";

const WORKFLOW_RUNTIME_DOC = "docs/as-built/architecture/workflow-runtime.md";
const DAEMON_CORE_DOC = "docs/as-built/architecture/daemon-core.md";
const ADAPTERS_DOC = "docs/as-built/architecture/adapters-and-runtimes.md";
const COORDINATION_DOC = "docs/as-built/architecture/coordination-primitive.md";

/**
 * Facts stated as a backticked list in prose. Each assertion names the slice
 * (`needle` .. `end`) so later prose cannot leak into the comparison.
 */
export const TOKEN_FACTS = [
  {
    id: "workflow-exit-kinds",
    sourceFile: WORKFLOW_TYPES,
    symbol: "WORKFLOW_EXIT_KINDS",
    docs: [
      {
        file: WORKFLOW_RUNTIME_DOC,
        needle: "The exits are",
        end: "An exit-specific",
        description: "workflow exit kinds",
      },
    ],
  },
  {
    id: "workflow-agent-harnesses",
    sourceFile: WORKFLOW_TYPES,
    symbol: "WORKFLOW_AGENT_HARNESSES",
    docs: [
      {
        file: WORKFLOW_RUNTIME_DOC,
        needle: "`WORKFLOW_AGENT_HARNESSES` contains",
        end: "`terminal` stays excluded",
        description: "pinnable workflow agent harnesses",
      },
    ],
  },
  {
    id: "builtin-runtimes",
    sourceFile: BUILT_IN_RUNTIMES,
    symbol: "BUILT_IN_RUNTIMES",
    docs: [
      {
        file: "docs/reference/rig-spec.md",
        needle: "Current supported values:",
        end: "`stub` is a deterministic",
        description: "supported member runtimes",
      },
      {
        file: DAEMON_CORE_DOC,
        needle: "runtime keys —",
        end: "The\nadapter-class and runtime-key rows",
        description: "wired runtime keys",
      },
      {
        file: ADAPTERS_DOC,
        needle: "runtime keys —",
        end: "### Launch posture",
        description: "wired runtime keys",
      },
    ],
  },
];

/** Facts stated as a pipe-separated or braced list, plus a declared count. */
export const ENUM_FACTS = [
  {
    id: "queue-states",
    sourceFile: QUEUE_REPOSITORY,
    symbol: "QUEUE_STATES",
    docs: [
      {
        file: COORDINATION_DOC,
        needle: "State enum (",
        end: "Carries `closure_reason`",
        mode: "pipe",
        countPattern: /State enum \(\*\*(\d+)\*\* values/,
        description: "queue item states",
      },
    ],
  },
  {
    id: "closure-reasons",
    sourceFile: HOT_POTATO,
    symbol: "CLOSURE_REASONS",
    docs: [
      {
        file: COORDINATION_DOC,
        needle: "`state=done` requires `closure_reason",
        end: "The reasons",
        mode: "brace",
        countPattern: /CLOSURE_REASONS` \(`:[^`]+`; \*\*(\d+)\*\* values/,
        description: "closure reasons",
      },
    ],
  },
];

/** Counts the page quotes next to the command that produces them. */
export const COUNT_FACTS = [
  {
    id: "runtime-adapter-implementations",
    actual: countRuntimeAdapterImplementations,
    docs: [
      {
        file: DAEMON_CORE_DOC,
        needle: "| Runtime adapter classes |",
        end: "| MCP tools",
        countPattern: /Runtime adapter classes \| \*\*(\d+)\*\*/,
        description: "runtime adapter class count",
      },
      {
        file: ADAPTERS_DOC,
        needle: "classes implement `RuntimeAdapter`",
        end: "All live under",
        countPattern: /\*\*(\d+)\*\* classes implement `RuntimeAdapter`/,
        description: "runtime adapter class count",
      },
    ],
  },
];

/** Read a repo-relative file as UTF-8. */
export function readRepoFile(root, relPath) {
  return readFileSync(join(root, relPath), "utf-8");
}

/** Pull the string array out of an `export const NAME = [...]` or `new Set([...])` declaration. */
export function extractStringArray(text, symbol) {
  const declaration = new RegExp(
    `export\\s+const\\s+${symbol}\\b[\\s\\S]{0,200}?(?:\\[|new\\s+Set\\()\\s*\\[?([\\s\\S]*?)\\]`,
  );
  const match = declaration.exec(text);
  if (!match) {
    throw new Error(`could not find a string array for ${symbol}`);
  }
  return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

/** Every lowercase-kebab token inside backticks. */
export function backtickedTokens(text) {
  return [...text.matchAll(/`([^`]+)`/g)]
    .map((m) => m[1].trim())
    .filter((token) => /^[a-z][a-z0-9-]*$/.test(token));
}

function sliceBetween(text, needle, end) {
  const at = text.indexOf(needle);
  if (at === -1) return null;
  if (!end) return text.slice(at, at + 400);
  const stop = text.indexOf(end, at + needle.length);
  if (stop === -1) return null;
  return text.slice(at, stop);
}

/** Parse a pipe-separated list inside one backtick span. */
export function pipeTokens(slice) {
  for (const match of slice.matchAll(/`([^`]+)`/g)) {
    const body = match[1];
    if (!body.includes("|")) continue;
    const parts = body
      .split("|")
      .map((part) => part.trim())
      .filter((part) => /^[a-z][a-z0-9-]*$/.test(part));
    if (parts.length > 1) return parts;
  }
  return [];
}

/** Parse a brace-enclosed bare list, e.g. `{a, b, c}`. */
export function braceTokens(slice) {
  const open = slice.indexOf("{");
  const close = slice.indexOf("}", open + 1);
  if (open === -1 || close === -1) return [];
  return slice
    .slice(open + 1, close)
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter((part) => /^[a-z][a-z0-9_-]*$/.test(part));
}

function describeDifference(actual, expected) {
  const missing = expected.filter((value) => !actual.includes(value));
  const extra = actual.filter((value) => !expected.includes(value));
  const parts = [];
  if (missing.length) parts.push(`missing ${missing.join(", ")}`);
  if (extra.length) parts.push(`unexpected ${extra.join(", ")}`);
  return parts.join("; ") || `found ${actual.join(", ")}`;
}

function compareList(actual, expected, { id, file, description }) {
  const actualSet = [...new Set(actual)];
  const expectedSet = [...new Set(expected)];
  const same =
    actualSet.length === expectedSet.length &&
    expectedSet.every((value) => actualSet.includes(value));
  if (same) return [];
  return [
    {
      code: id,
      message: `${file}: ${description} drifted from source (${describeDifference(actualSet, expectedSet)})`,
    },
  ];
}

/** Count files under packages/daemon/src that declare a RuntimeAdapter implementation. */
export function countRuntimeAdapterImplementations(root) {
  const start = join(root, "packages/daemon/src");
  let count = 0;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
      } else if (entry.isFile() && entry.name.endsWith(".ts")) {
        if (readFileSync(path, "utf-8").includes("implements RuntimeAdapter")) {
          count += 1;
        }
      }
    }
  };
  walk(start);
  return count;
}

function extractExpected(root, fact) {
  try {
    const expected = extractStringArray(readRepoFile(root, fact.sourceFile), fact.symbol);
    if (expected.length === 0) {
      return { error: `${fact.sourceFile}: ${fact.symbol} parsed as an empty list` };
    }
    return { expected };
  } catch (error) {
    return { error: `${fact.sourceFile}: ${fact.symbol} not readable/parseable (${error.message})` };
  }
}

/** Compare every token fact against its docs. */
export function checkTokenFacts(root) {
  const findings = [];
  for (const fact of TOKEN_FACTS) {
    const { expected, error } = extractExpected(root, fact);
    if (error) {
      findings.push({ code: `${fact.id}-source-missing`, message: error });
      continue;
    }
    for (const doc of fact.docs) {
      const slice = sliceBetween(readRepoFile(root, doc.file), doc.needle, doc.end);
      if (slice === null) {
        findings.push({
          code: `${fact.id}-anchor-missing`,
          message: `${doc.file}: cannot locate the ${doc.description} sentence (anchors: ${JSON.stringify(doc.needle)} .. ${JSON.stringify(doc.end)}); the fact is no longer checkable`,
        });
        continue;
      }
      findings.push(
        ...compareList(backtickedTokens(slice), expected, {
          id: fact.id,
          file: doc.file,
          description: doc.description,
        }),
      );
    }
  }
  return findings;
}

/** Compare pipe/brace enum facts, including the count the page declares. */
export function checkEnumFacts(root) {
  const findings = [];
  for (const fact of ENUM_FACTS) {
    const { expected, error } = extractExpected(root, fact);
    if (error) {
      findings.push({ code: `${fact.id}-source-missing`, message: error });
      continue;
    }
    for (const doc of fact.docs) {
      const text = readRepoFile(root, doc.file);
      const slice = sliceBetween(text, doc.needle, doc.end);
      if (slice === null) {
        findings.push({
          code: `${fact.id}-anchor-missing`,
          message: `${doc.file}: cannot locate the ${doc.description} list; the fact is no longer checkable`,
        });
        continue;
      }
      const actual = doc.mode === "pipe" ? pipeTokens(slice) : braceTokens(slice);
      findings.push(
        ...compareList(actual, expected, {
          id: fact.id,
          file: doc.file,
          description: doc.description,
        }),
      );
      const declared = doc.countPattern ? doc.countPattern.exec(text) : null;
      if (declared && Number(declared[1]) !== expected.length) {
        findings.push({
          code: fact.id,
          message: `${doc.file}: declares ${declared[1]} ${doc.description}, source has ${expected.length}`,
        });
      }
    }
  }
  return findings;
}

/** Compare quoted counts with the count the repository actually produces. */
export function checkCountFacts(root) {
  const findings = [];
  for (const fact of COUNT_FACTS) {
    let actual;
    try {
      actual = fact.actual(root);
    } catch (error) {
      findings.push({
        code: `${fact.id}-source-missing`,
        message: `cannot count runtime adapter implementations (${error.message})`,
      });
      continue;
    }
    for (const doc of fact.docs) {
      const text = readRepoFile(root, doc.file);
      const declared = doc.countPattern.exec(text);
      if (!declared) {
        findings.push({
          code: `${fact.id}-anchor-missing`,
          message: `${doc.file}: cannot locate the ${doc.description}; the count is no longer checkable`,
        });
        continue;
      }
      if (Number(declared[1]) !== actual) {
        findings.push({
          code: fact.id,
          message: `${doc.file}: declares ${declared[1]} ${doc.description}, repository has ${actual}`,
        });
      }
    }
  }
  return findings;
}

function markdownFiles(dir) {
  const out = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && entry.name.endsWith(".md")) out.push(path);
    }
  };
  walk(dir);
  return out;
}

/** Strip fenced code blocks and inline code so illustrative links are not treated as real. */
export function stripCode(text) {
  return text.replace(/^```[\s\S]*?^```/gm, "").replace(/`[^`\n]*`/g, "");
}

function linkedTargets(text) {
  return [...stripCode(text).matchAll(/\]\(([^)\s]+)\)/g)]
    .map((m) => m[1].split("#")[0].trim())
    .filter((target) => target && !/^(https?:|mailto:|#)/.test(target));
}

/** Both documentation indexes must link every page they index. */
export function checkDocsIndexes(root) {
  const findings = [];

  const referenceIndex = readRepoFile(root, "docs/reference/README.md");
  const referenceLinked = new Set(
    linkedTargets(referenceIndex).map((target) => target.replace(/^\.\//, "")),
  );
  const referenceDir = join(root, "docs/reference");
  for (const file of markdownFiles(referenceDir)) {
    const name = file.slice(referenceDir.length + 1);
    if (name === "README.md") continue;
    if (!referenceLinked.has(name)) {
      findings.push({
        code: "docs-index",
        message: `docs/reference/README.md does not link docs/reference/${name}`,
      });
    }
  }

  const asBuiltIndex = readRepoFile(root, "docs/as-built/README.md");
  const asBuiltLinked = new Set(
    linkedTargets(asBuiltIndex).map((target) => target.replace(/^\.\//, "")),
  );
  const asBuiltDir = join(root, "docs/as-built");
  for (const file of markdownFiles(asBuiltDir)) {
    const rel = file.slice(asBuiltDir.length + 1);
    if (rel === "README.md") continue;
    if (!asBuiltLinked.has(rel)) {
      findings.push({
        code: "docs-index",
        message: `docs/as-built/README.md does not link docs/as-built/${rel}`,
      });
    }
  }
  return findings;
}

/** Relative links in shipped docs must resolve to a real file. */
export function checkDocLinks(root) {
  const findings = [];
  for (const relRoot of ["docs/reference", "docs/as-built"]) {
    const dir = join(root, relRoot);
    for (const file of markdownFiles(dir)) {
      const rel = file.slice(root.length + 1);
      for (const target of linkedTargets(readFileSync(file, "utf-8"))) {
        const resolved = resolve(dirname(file), target);
        let exists = false;
        try {
          exists = statSync(resolved).isFile() || statSync(resolved).isDirectory();
        } catch {
          exists = false;
        }
        if (!exists) {
          findings.push({
            code: "docs-link",
            message: `${rel} links ${target}, which does not exist`,
          });
        }
      }
    }
  }
  return findings;
}

/** Run every check against a repository root. */
export function runChecks({ root = REPO_ROOT } = {}) {
  const groups = [
    ["token-facts", checkTokenFacts],
    ["enum-facts", checkEnumFacts],
    ["count-facts", checkCountFacts],
    ["docs-index", checkDocsIndexes],
    ["docs-link", checkDocLinks],
  ];
  const findings = [];
  for (const [id, check] of groups) {
    try {
      findings.push(...check(root));
    } catch (error) {
      findings.push({
        code: `${id}-crash`,
        message: `${id} could not run against ${root} (${error.message})`,
      });
    }
  }
  return findings;
}

export function main({ root = REPO_ROOT, log = console.error } = {}) {
  const findings = runChecks({ root });
  if (findings.length === 0) {
    console.log("check-docs-facts: 0 drift finding(s)");
    return 0;
  }
  log(`check-docs-facts: ${findings.length} drift finding(s)`);
  for (const finding of findings) log(`- [${finding.code}] ${finding.message}`);
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main();
}
