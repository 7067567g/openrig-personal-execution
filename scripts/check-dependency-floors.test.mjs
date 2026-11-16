// Security floor guard for the directly vulnerable runtime dependencies.
//
// `tar` is on the `.rigbundle` pack/unpack path (packages/daemon/src/domain/bundle-archive.ts
// calls tar.create/tar.list/tar.extract), so the archive parser is reachable from an imported
// bundle. `hono` and `@hono/node-server` are the daemon's HTTP router and adapter. The other
// entries are direct dependencies whose 2026-10 advisories are fixed above the version named
// here, and which `npm audit` reports as high/critical when they fall below it.
//
// The check reads the lockfile (what `npm ci` actually installs) and the workspace manifests
// (the floor a future `npm install` must respect). It is deliberately a floor, not an exact
// pin: any later safe version passes and no release bump has to edit this file.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// minimum = lowest fixed version. workspaces = manifests that must not admit a lower one.
// `lockOnly` entries are transitive and have no manifest range of our own to check.
const FLOORS = {
  tar: {
    minimum: [7, 5, 21],
    workspaces: ["packages/cli", "packages/daemon"],
    advisory: "tar must be > 7.5.20",
  },
  hono: {
    minimum: [4, 13, 11],
    workspaces: ["packages/cli", "packages/daemon"],
    advisory: "hono must be >= 4.13.11",
  },
  "@hono/node-server": {
    minimum: [1, 19, 15],
    workspaces: ["packages/cli", "packages/daemon"],
    advisory: "@hono/node-server must be > 1.19.14",
  },
  "@modelcontextprotocol/sdk": {
    minimum: [1, 31, 1],
    workspaces: ["packages/cli"],
    advisory: "@modelcontextprotocol/sdk must be > 1.31.0",
  },
  zod: {
    minimum: [4, 6, 6],
    workspaces: ["packages/cli"],
    advisory: "zod must be >= 4.6.6",
  },
  "smol-toml": {
    minimum: [1, 8, 1],
    workspaces: ["packages/cli", "packages/daemon"],
    advisory: "smol-toml must be > 1.8.0",
  },
  postcss: {
    minimum: [8, 5, 23],
    workspaces: ["packages/ui"],
    advisory: "postcss must be > 8.5.22",
  },
  vite: {
    minimum: [6, 4, 4],
    workspaces: ["packages/ui"],
    advisory: "vite must be > 6.4.3",
  },
  ws: {
    minimum: [8, 20, 2],
    lockOnly: true,
    advisory: "ws must be > 8.20.1",
  },
  "fast-uri": {
    minimum: [3, 1, 9],
    lockOnly: true,
    advisory: "fast-uri must be > 3.1.8",
  },
};

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(REPO, relativePath), "utf8"));
}

function numericParts(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  assert.ok(match, `expected a semver version, got ${JSON.stringify(version)}`);
  return match.slice(1, 4).map(Number);
}

function compare(a, b) {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/** Lowest version a manifest range can resolve to: `^1.2.3`/`~1.2.3`/`>=1.2.3`/`1.2.3`. */
function rangeFloor(range) {
  const match = /^(?:\^|~|>=|=)?\s*(\d+\.\d+\.\d+)/.exec(range);
  assert.ok(match, `cannot read a version floor from range ${JSON.stringify(range)}`);
  return numericParts(match[1]);
}

test("the lockfile resolves every guarded package at or above its fixed floor", () => {
  const lock = readJson("package-lock.json");
  const failures = [];
  for (const [name, floor] of Object.entries(FLOORS)) {
    const entry = lock.packages[`node_modules/${name}`];
    if (!entry) {
      failures.push(`${name}: no package-lock.json entry`);
      continue;
    }
    if (compare(numericParts(entry.version), floor.minimum) < 0) {
      failures.push(
        `${name}@${entry.version} is below ${floor.minimum.join(".")} (${floor.advisory})`,
      );
    }
  }
  assert.deepEqual(failures, []);
});

test("every workspace that depends on a guarded package declares a fixed floor", () => {
  const failures = [];
  for (const [name, floor] of Object.entries(FLOORS)) {
    for (const workspace of floor.workspaces ?? []) {
      const manifest = readJson(`${workspace}/package.json`);
      const range = manifest.dependencies?.[name] ?? manifest.devDependencies?.[name];
      if (!range) {
        failures.push(`${workspace}/package.json does not depend on ${name}`);
        continue;
      }
      if (compare(rangeFloor(range), floor.minimum) < 0) {
        failures.push(
          `${workspace}/package.json declares ${name} ${range}, which admits a version below ` +
            `${floor.minimum.join(".")}`,
        );
      }
    }
  }
  assert.deepEqual(failures, []);
});

test("guarded runtime packages are not dev-only in the workspaces that ship them", () => {
  // tar/hono/@hono/node-server are runtime dependencies of the daemon and CLI. A future move
  // of one of them to devDependencies would still pass the floor check above but stop shipping
  // it, so pin the section as well.
  for (const workspace of ["packages/cli", "packages/daemon"]) {
    const manifest = readJson(`${workspace}/package.json`);
    for (const name of ["tar", "hono", "@hono/node-server"]) {
      assert.ok(
        manifest.dependencies?.[name],
        `${workspace}/package.json must list ${name} in dependencies`,
      );
    }
  }
});
