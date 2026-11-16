# OpenRig Personal Execution

**Release tag:** `v0.1.4`
**Release date:** 2026-11-16
**Package version:** `openrig-local 0.1.4`

Personal local source line of OpenRig: the daemon, CLI and TUI that run persistent
teams of coding agents as named seats in separate terminals, coordinated through a
durable queue, a workflow runtime and a shared transcript/observation layer.

## What is inside

| Area | Contents |
| --- | --- |
| `packages/daemon/` | Control-plane daemon: queue, workflow runtime, sessions, adapters |
| `packages/cli/` | `rig` CLI; entry point `packages/cli/dist/bin-wrapper.js` |
| `packages/tui/` | Terminal UI client |
| `packages/ui/` | Web UI assets |
| `packages/test-system/` | Shared test infrastructure |
| `packages/*/dist/` | Prebuilt JavaScript bundles, shipped on purpose |
| `scripts/` | Build, packaging, documentation and gate scripts |
| `docs/` | Architecture, reference, release notes, as-built documentation |
| `skills/` | Agent skills shipped with the runtime |
| `assets/`, `test/`, `demo/`, `docker/`, `.github/` | Supporting material |
| `runtime/` | `install.sh`, `rig-shim.sh`, `OPENRIG_ENV.example` |

Two release assets accompany this tag:

- `openrig-personal-evidence-20261116.tar.zst` — cleaned evidence: 63 workflow
  runs' control documents plus the run-archive index.
- `openrig-personal-offline-runtime-20261116.tar.zst` — prebuilt `node_modules`,
  `packages/*/dist`, a Python venv and the rig shim, for offline installs.

## Quick start

```bash
bash runtime/install.sh
export PATH="$PWD/runtime:$PATH"
rig --version
```

Requirements: Node.js 22 or 24. Optional for full teams: Python 3, `opencode`,
`dsh`, `tmux`, and the vendor CLIs you intend to run.

Full detail — toolchain versions, build, the `rig` shim, environment variables and
troubleshooting — is in **`RUNTIME.md`**.

## Provenance

- Upstream project: OpenRig (`https://openrig.dev`), Apache-2.0; see `LICENSE`.
- This snapshot is taken from a personal working tree of the OpenRig local source
  line at commit `e932ae9`, **including uncommitted working-tree changes**, plus
  the newly added packaging documents listed above.
- Snapshot date: 2026-11-16.
- `PACKAGE-MANIFEST.json` records the exact file count, byte count, largest files
  and exclusion rules; `SHA256SUMS` covers every shipped file.

## Security

This package contains **no** API keys, tokens, credentials, private keys, raw
agent sessions or transcripts, SQLite databases, or home-directory snapshots.

- Provider credentials are owned by the agent CLIs and are never shipped or
  proxied by OpenRig.
- `runtime/OPENRIG_ENV.example` lists variable **names** with placeholder values
  only.
- `CLEANING-REPORT.md` documents the secret scan, the raw-session scan and the
  machine-path scan, and justifies every allowlisted match individually.
