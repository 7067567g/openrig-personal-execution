# OpenRig Personal Local

**OpenRig Personal Local** is a personal local source line of OpenRig: a control
plane that runs persistent teams of coding agents (Claude Code, Codex, OpenCode,
Pi and friends) as named seats in separate terminal sessions, coordinated through
a durable queue, a workflow runtime, and a shared transcript/observation layer.

This repository is a *source snapshot*, not an npm release. It contains the
daemon, CLI and TUI sources, the built `dist/` bundles, the test suites, the
docs, and a portable runtime setup so another machine can be brought up from
this tree.

## Quick start

```bash
# 1. Build (Node.js 22 or 24 required)
bash runtime/install.sh

# 2. Put the `rig` shim on your PATH (or call it directly)
export PATH="$PWD/runtime:$PATH"
rig --version

# 3. Inspect and start the daemon
rig status
rig daemon start

# 4. Read the runtime guide
less RUNTIME.md
```

`runtime/install.sh` runs `npm ci && npm run build`. Nothing outside the
repository is modified.

## What is in the box

| Path | Contents |
| --- | --- |
| `packages/daemon/` | Control-plane daemon: queue, workflow runtime, sessions, adapters |
| `packages/cli/` | `rig` CLI (`dist/bin-wrapper.js` is the entry point) |
| `packages/tui/` | Terminal UI client |
| `packages/ui/` | Web UI assets |
| `packages/test-system/` | Shared test infrastructure |
| `packages/*/dist/` | Prebuilt JavaScript bundles (shipped on purpose) |
| `scripts/` | Build, packaging, documentation and gate scripts |
| `docs/` | Architecture, reference, release notes and as-built documentation |
| `skills/` | Agent skills shipped with the runtime |
| `assets/`, `demo/`, `docker/`, `test/` | Supporting material |

## Requirements

- Node.js `^22 || ^24`
- npm (bundled with Node)
- Optional, for full agent teams: Python 3, `opencode`, `dsh`, `tmux`, and the
  vendor CLIs you intend to run (Claude Code, Codex, …)

See `RUNTIME.md` for the exact versions used to produce this snapshot and for
the `OPENRIG_*` environment variables.

## Security

- This repository contains **no** API keys, tokens, credentials, raw agent
  sessions/transcripts, SQLite databases, or home-directory snapshots. See
  `CLEANING-REPORT.md` for the scans that were run.
- `runtime/OPENRIG_ENV.example` lists variable *names* with placeholder values
  only. Never commit real keys; keep them in your shell environment or a local,
  git-ignored file.
- Provider credentials are read from the environment by the agent CLIs
  themselves. OpenRig Personal Local does not ship or proxy any credentials.

## License

Apache-2.0. See `LICENSE` and `NOTICE`/`UPSTREAM` attribution in `ARCHITECTURE.md`
and `docs/`.

## Provenance

Snapshot taken 2026-11-16 from the personal OpenRig source tree at commit
`e932ae9`, including uncommitted working-tree changes (see
`PACKAGE-MANIFEST.json` and `CLEANING-REPORT.md`).
