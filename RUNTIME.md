# RUNTIME — OpenRig Personal Local

How to build, run and configure this snapshot on a fresh machine.

## 1. Toolchain versions used for this snapshot

| Tool | Version |
| --- | --- |
| Node.js | v24.22.1 (engines: `^22 \|\| ^24`) |
| npm | 11.19.1 |
| Python | 3.14.4 (only needed by auxiliary tooling) |
| opencode | v2.2.7 (optional adapter/runtime) |
| dsh | present on the build machine (optional adapter/runtime) |
| tmux | 3.6 (required for multi-seat terminal control) |
| OpenRig | `openrig-local 0.1.4` |

## 2. Build

```bash
bash runtime/install.sh
```

Equivalently:

```bash
npm ci
npm run build      # builds daemon, ui, tui and cli workspaces
```

The build writes `packages/*/dist/`. These bundles are also shipped in this
snapshot, so you can start the runtime without rebuilding.

## 3. Run the CLI

The CLI entry point is `packages/cli/dist/bin-wrapper.js`. Use the shim:

```bash
export PATH="$PWD/runtime:$PATH"
rig --version
```

`runtime/rig-shim.sh` resolves the repository root from its own location. Set
`OPENRIG_ROOT` to override it:

```bash
OPENRIG_ROOT=/path/to/openrig-personal-local rig status
```

## 4. First run

```bash
rig status                 # daemon state
rig daemon start           # start the daemon (kernel/operator are opt-in on first run)
rig whoami --json          # identity of the current seat, if inside a rig
```

`rig context get help` is the installed help guide; `rig <command> --help` is
always authoritative for the installed binary.

## 5. Environment variables

Copy `runtime/OPENRIG_ENV.example` and fill in only what you need. Variable
names are stable; example values are placeholders.

| Variable | Purpose |
| --- | --- |
| `OPENRIG_HOME` | Root for OpenRig runtime state (defaults to a per-user location) |
| `OPENRIG_ROOT` | Repository root override used by `runtime/rig-shim.sh` |
| `OPENRIG_LOG_LEVEL` | Daemon log verbosity |
| `OPENRIG_HOST` / `OPENRIG_PORT` | Daemon bind host and port |
| `OPENRIG_BIND_HOST` | Restrict the listening interface |
| `OPENRIG_URL` / `OPENRIG_UI_URL` | Base URL used by clients and the web UI |
| `OPENRIG_OPENCODE_BIN` | Path to the `opencode` binary, when not on `PATH` |
| `OPENRIG_OPENCODE_AGENT` | Default opencode agent name |
| `OPENRIG_OPENCODE_MODEL` | Default opencode model |
| `OPENRIG_DSH_BIN` | Path to the `dsh` binary, when not on `PATH` |
| `OPENRIG_DSH_PROFILE` | dsh profile to use |
| `OPENRIG_TMUX_CONTROL` | tmux control mode settings |
| `OPENRIG_TMUX_SHELL` | Shell launched inside seat terminals |
| `OPENRIG_WORK_ROOT` | Default working root for agent sessions |
| `OPENRIG_TARGET_REPO` | Default target repository for review flows |
| `OPENRIG_TRANSCRIPTS_ENABLED` | Enable transcript capture |
| `OPENRIG_TRANSCRIPTS_PATH` | Where transcripts are written |
| `OPENRIG_NO_KERNEL` | Start the daemon without the kernel seats |

The full set is discoverable from source:

```bash
grep -rhoE 'OPENRIG_[A-Z0-9_]+' packages/*/src | sort -u
```

## 6. Provider credentials

Agent credentials belong to the agent CLIs, not to OpenRig. For example:

```bash
# Claude Code reads its own login/credentials
# Codex reads ~/.codex or its own auth flow
# opencode reads its own auth store
```

OpenRig itself has no bundled provider keys. Do not commit `.env` files; they
are git-ignored.

## 7. Tests and gates

```bash
npm test                # repo scripts + workspace tests
npm run lint            # typecheck over all workspaces
npm run generate-context-packs:check
```

## 8. Troubleshooting

| Symptom | Check |
| --- | --- |
| `rig: command not found` | `export PATH="$PWD/runtime:$PATH"` or call `runtime/rig-shim.sh` directly |
| `Cannot find module .../dist` | run `npm run build` (dist may be stale or absent) |
| `node: unsupported engine` | install Node 22 or 24 (`engines` in `package.json`) |
| Daemon won't start | `rig status --json`, then check `OPENRIG_LOG_LEVEL=debug` output |
| Seat terminals misbehave | confirm `tmux -V` ≥ 3.4 and that `OPENRIG_TMUX_SHELL` points at a real shell |
