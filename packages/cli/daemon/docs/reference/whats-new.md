# What changed in openrig-local 0.1.4 (local line)

This note is for an agent on an install that moved to the local fork line at 0.1.4. It lists what
behaves differently from the 0.7.0 pre-line. For everything OpenRig can do, read the capability map:
`rig context get onboarding-width/public-what-you-can-do.md`. Each release replaces this file, so
`rig context get reference/whats-new.md` describes the installed version once the upgraded daemon is
running. Without a running daemon, read `$OPENRIG_HOME/reference/whats-new.md`. The daemon refreshes
that copy when it starts, so right after an upgrade it can still hold the previous version's note.

The local line is built from the 0.7.0 pre-line tree and advances independently of upstream. A
`taken_commit` list in the repository's `UPSTREAM-BASE` records every upstream fix backported into
this line; `docs/releases/` has one note per cut. There is no schema migration in any 0.1.x cut (the
newest remains 114).

## In 0.1.4 (dependency security)

- `tar` moves from 7.5.13 to 7.5.22 (`> 7.5.20`). The daemon pays this parser when it packs or
  unpacks a `.rigbundle`, so the six `<= 7.5.20` file-smuggling / PAX type-confusion /
  decompression-DoS advisories were on a real path. The bundle trust model is unchanged.
- `hono` moves from 4.12.8 to 4.13.13 (`>= 4.13.11`) on the daemon's HTTP router, together with
  `@hono/node-server` 1.19.17. `@modelcontextprotocol/sdk` moves to 1.32.2, `zod` to 4.6.7 and
  `smol-toml` to 1.9.1; the UI toolchain moves `postcss` to 8.5.31 and `vite` to 6.4.5, and the
  test runner to `vitest` 3.2.7. All stay inside their existing majors.
- `npm audit` on this tree drops from 27 findings (5 critical, 13 high) to 6 (2 critical,
  0 high). The six left are dev-only (`vitest`/`tinypool`/`@vitest/mocker`) or Tailwind 3
  build-time; no critical or high remains in a daemon or CLI runtime path.
- A new shipped page, `reference/security-notes.md`, records two host-level items this
  repository cannot fix: the Ubuntu kernel waiting on the `7.0.0-43.43` CVE-2026-99999 fix
  (do not run untrusted KVM guests before it), and PyTorch CVE-2026-24747 in the local
  ComfyUI environment (do not load untrusted `.ckpt`/`.pth`/`.pt`; move to torch >= 2.10.0).

## In 0.1.3 (second backport batch)

Four adapted upstream fixes, all in failure/competition paths:

- A single `rig send` (derived actor) that landed now marks its sender-side outbox audit row
  `delivered` with a timestamp instead of leaving it `pending` for ever. Delivery is unchanged.
- The CLI host-bindings lock sleeps between retries and waits past the 2 s stale threshold before
  failing open. A writer that stalls for 600 ms is waited out; a genuinely stale lock is still taken
  over. Calling commands may block up to about 3 s longer under contention.
- Before a managed plugin or marked global-skill refresh replaces a differing file, it copies that
  file to `$OPENRIG_HOME/backups/managed-refresh/<uuid>/` and logs the path. If the copy fails, that
  refresh is skipped and the existing files stay. The copy keeps bytes, not active behavior.
- One stuck-sweep finding whose creation fails no longer aborts the pass. The failure is logged with
  the row named, the other findings are kept, and the pass still records `failed`.

## In 0.1.2 (package identity, breaking for importers)

- Root package `openrig` → `openrig-local`; workspaces `@openrig/*` → `@openrig-local/*`. The
  installed CLI now lives at `$(npm root -g)/@openrig-local/cli`. An existing install is not
  migrated in place; reinstall from this tree.
- `rig --version` prints `openrig-local <semver>` (with the build stamp when stamped).
  `CLI_VERSION` remains the bare/stamped semver for machine consumers.
- Commands (`rig`, `openrig-tui`), `OPENRIG_HOME`, `~/.openrig`, wire fields, runtime ids, plugin
  ids and configuration keys are unchanged. Only out-of-tree importers of the old package specifiers
  must update their imports.

## In 0.1.1 (first backport batch)

- The bundled secrets-manager example binds Vault to `127.0.0.1:8200` instead of every interface.
- An empty `OPENRIG_HOME` is treated as unset by the terminal-token lookup, the crash-cart home
  lookup and the TUI socket path, so it no longer resolves to a cwd-relative `.openrig`.
- Bundle creation refuses harness login files (`.claude/.credentials.json`, `.codex/auth.json`,
  `.pi/agent/auth.json`) by default. `rig bundle create --include-login-files` records the exact
  included paths in the manifest and consumers show a credential-bearing notice.
- Promoting an inbox entry into queue work is atomic, and the inbox handler refuses a queue
  repository or event bus that uses a different database handle.
- Removing a seat no longer deletes queue work that arrived while its session was stopping; the item
  is rerouted or retained, and the removal result reports both.

## The 0.1.0 line reset (still true)

0.1.0 was a **version-line reset, not a feature release**: the tree is the 0.7.0 pre-line tree, so
the P0/P1 work described in `docs/releases/v0.7.0.md` is present and the local 0.7.0 was never
published. `UPSTREAM-BASE` records the upstream base, the v0.7.0 comparison commit and the sync date.

## After the upgrade

- **Restart the daemon the usual way** (`rig daemon stop`, then `rig daemon start`). No migration
  runs; the restart makes `/healthz` and the version route report 0.1.4.
- **Nothing new to turn on.** The four P1 controls from the 0.7.0 pre-line — `resources.admission.*`,
  `budget.*`, `resources.toolchain.*` and `resources.provider_limit.*` — remain default-off and
  behave as they did on 0.7.0.
- **`rig launch --plan` still works on this line.** The CLI treats a daemon on `0.1.x` as supporting
  `plan: true`, because this line was cut from the tree that added it. Every other version keeps the
  upstream `0.5.9` floor. A `--host` pointing at a genuine upstream 0.1.x daemon is the known
  trade-off of using a version prefix rather than a daemon capability.
- **Bundles that declare a minimum daemon version are still checked.** A bundle requiring
  `compatibility.min_daemon_version` at `0.5.x` or later is refused on 0.1.x; the bundled rigs in
  this tree declare no such minimum, so local installs are unaffected.

## If you are coming from 0.6.11

This line did not absorb upstream 0.7.0 as a merge. Read `docs/releases/v0.7.0.md` and the `[0.7.0]`
section of `CHANGELOG.md` for the pre-line P0/P1 work — the versioned DSH shim, launch admission,
per-turn budgets, toolchain concurrency, provider seat limits, `rig ps --resources` and the workflow
closure-evidence check. Those behaviors are in this tree.

## Compatibility

No command name, configuration key, schema, wire shape or default launch path breaks across 0.1.x.
The package rename in 0.1.2 breaks only out-of-tree importers of `@openrig/*` and hard-coded installed
paths. The 0.1.1–0.1.4 changes are failure-path fixes, the package identity cut and the dependency-security cut. See
`docs/releases/v0.1.0.md`–`v0.1.4.md` for each cut's verification run and `UPSTREAM-BASE` for lineage.
