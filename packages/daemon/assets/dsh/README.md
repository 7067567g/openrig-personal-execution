# DSH shared-web shim

`dsh-web-shim.py` lets an OpenRig `dsh` seat run against a **running DSH Web instance**
(default `127.0.0.1:3080`) instead of spawning a headless `dsh --profile headless` process.
It is a drop-in replacement for the `dsh` executable as far as OpenRig's CLI-agent runner is
concerned: same argv shape, same NDJSON event stream, same session-id sidecar semantics.

This file is the in-repo, versioned copy. It is shipped because
`scripts/build-package.sh` copies `packages/daemon/assets/` wholesale into the npm artifact
(`<cli>/daemon/assets/dsh/dsh-web-shim.py`), and the daemon resolves assets relative to
`import.meta.dirname`.

## Provenance

| Field | Value |
| --- | --- |
| Imported from | the workflow-group `tools/dsh-web-shim` (outside this repo; the original host scratch copy no longer exists on the import host) |
| Source sha256 | `a8cf8e40494043881eed6a90cae46ae9f8aed8debc615d670ea4ab5d85af6da4` |
| In-tree sha256 | must equal the source hash; the copy is byte-identical (no local edits) |
| Size | 177 lines, 6230 bytes |
| Protocol pinned against | DSH `0.2.1-rc.2` (`dsh --version`), event vocabulary documented in the `dsh-headless` README |
| In-tree test | `packages/daemon/test/dsh-web-shim.test.ts` (fake `dsh_ctl`, no real DSH/3080 traffic) |

Rebase rule: if the shim is edited in place, update the hash row above **and** the protocol
test in the same commit. A silent edit invalidates provenance.

## Invocation contract

The runner builds `dsh --profile <profile> --json [--session-id <id>] <task>`
(`packages/daemon/src/adapters/cli-agent/cli-agent-runner-protocol.ts`). The shim parses:

| Argument | Meaning |
| --- | --- |
| `--profile <value>` | Accepted and ignored; the shim always drives the running Web instance. |
| `--json` | Accepted and ignored; NDJSON is the only output. |
| `--session-id <id>` | Optional resume hint. Ignored if the Web session id is unknown, has another `cwd`, or another preset. |
| everything else | Joined with spaces into the task text. Empty task exits `2` before touching DSH. |
| `-h` / `--help` | Prints the module docstring and exits `0`. |

## Event stream

One JSON object per line on stdout:

```text
{"type":"session","sessionId":"session-..."}
{"type":"status","phase":"turn_start","turn":1}
{"type":"status","phase":"progress","text":"工具调用 ...","event":"tool/call"}
{"type":"status","phase":"turn_end","turn":1}
{"type":"final","text":"..."}
```

If any step raises (busy session, prompt rejected, reply timeout, `dsh_ctl` error), the shim
emits a terminal error status and an empty `final`, writes the message to stderr, and exits `1`:

```text
{"type":"status","phase":"turn_end","turn":1,
 "reason":{"kind":"error","error":{"message":"...","code":"OPENRIG_DSH_WEB_SHIM"}}}
{"type":"final","text":""}
```

Defensive properties the runner relies on:

- `session` is always the first event, before any Web call can fail in the reply loop.
- `final` is the last stdout line; the process never retries a turn itself.
- The shim does **not** register the run directory as a DSH Web workspace (avoids a new
  workspace per run); it only creates a session with the current `cwd`.
- It cannot report `tool_call`/`tool_result` or token `usage`; the shared-web path is
  event-poorer than headless. Budgets based on tools/tokens are `not_enforced` here.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOME` | OS home | Resolves the `dsh_ctl` import root. |
| `DSH_HOME` | `$HOME/.dsh` | Passed through to the DSH bridge. |
| `DSH_WEB_PORT` | `3080` | Port of the running DSH Web instance. |
| `OPENRIG_DSH_REPLY_TIMEOUT` | `1800` (seconds) | Wall-clock budget for one reply. On expiry the shim emits the error status/final and exits `1`. It does not retry. |

The shim imports `dsh_ctl` from `$HOME/.dsh/clawbot-bridge/bridge-fork`. That module is
machine-local and is intentionally **not** vendored: without it the shim fails at import with a
non-zero exit and no stdout events. The test suite substitutes a fake module on `HOME`.

## Credentials

The shim reads no API key and writes none. It inherits whatever authentication the running
DSH Web instance already has. Do not put `DEEPSEEK_API_KEY` (or any other key) in rig YAML,
logs, or `rig ps` output for this path. Headless is the path that needs the runtime-owned
credential; see `docs/reference/dsh-execution-paths.md`.

## Using it

Development checkout:

```bash
export OPENRIG_DSH_BIN="$PWD/packages/daemon/assets/dsh/dsh-web-shim.py"
export OPENRIG_DSH_PROFILE=headless
rig up <rig.yaml> --cwd <project> --non-interruptive --yes
```

Packaged install: point `OPENRIG_DSH_BIN` at `<cli>/daemon/assets/dsh/dsh-web-shim.py`.
The default (variable unset) stays `dsh` from `PATH`, i.e. headless; importing this file does
not change any default.

## Limits

- One Web turn per process launch; cancellation is process termination by the runner.
- Poll cadence is `0.8s`; progress is coalesced to at most one status per 1.5s.
- The session preset is hard-coded to `standard`.
- The reply timeout covers waiting for DSH, not queueing/launch time.
- Python 3 and the machine-local `dsh_ctl` bridge are runtime prerequisites; neither is an
  npm dependency.
