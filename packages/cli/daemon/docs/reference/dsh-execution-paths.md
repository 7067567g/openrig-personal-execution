# DSH execution paths: shared-web and headless

OpenRig has two ways to run a `dsh` seat. Both use the same pane-hosted CLI-agent runner
(`packages/daemon/src/adapters/cli-agent/cli-agent-runner.ts`), the same sidecar, and the same
NDJSON failure mapping. They differ in where the model turn executes and how much the runner
can observe.

This document describes the current tree (0.7.0). A per-seat `execution.backend` switch is a
P2 proposal, not an implemented setting. The detailed contract is
[execution-backend-isolated.md](execution-backend-isolated.md); the umbrella plan is
[seat-load-isolation-and-resource-budgets-plan.md](seat-load-isolation-and-resource-budgets-plan.md).

## 1. At a glance

| | shared-web (`dsh-web-shim.py`) | headless (`dsh --profile headless --json`) |
| --- | --- | --- |
| Selected by | `OPENRIG_DSH_BIN` points at the shim | `OPENRIG_DSH_BIN` unset, or points at `dsh` |
| Process per turn | One Python shim process; it calls the running DSH Web over `dsh_ctl` | One `dsh` child process |
| Default | No | **Yes** |
| Web UI visibility | Session is created with the seat `cwd`; no workspace is registered, so no new sidebar workspace | No Web server is started for the turn |
| Event richness | `session` / `status` / `final` only | Full DSH stream (`text`, `thinking`, `tool_call`, `tool_result`, status phases, `usage`) |
| Credentials | Borrowed from the running DSH Web instance; shim reads no key | Runtime/seat environment, e.g. `DEEPSEEK_API_KEY` |
| Reply timeout | `OPENRIG_DSH_REPLY_TIMEOUT`, default 1800s | None by default; the opt-in `budget.max_wall_time_seconds` adds a runner deadline |
| Resume | Web session id through the runner sidecar | DSH session id through the runner sidecar |
| Best for | Interactive seats that should stay visible in DSH Web | Background workers, research, builds, QA |

## 2. Selecting a path

The adapter reads the door at daemon startup
(`packages/daemon/src/startup.ts:876-884`):

```text
OPENRIG_DSH_BIN      # executable; unset -> `dsh` from PATH (headless)
OPENRIG_DSH_PROFILE  # default "headless"; passed as --profile
```

The runner resolves the binary again from `OPENRIG_DSH_BIN` / `DSH_BIN` when `--bin` was not
given (`cli-agent-runner.ts:63-65`), and builds:

```text
dsh --profile headless --json [--session-id <id>] <task>
```

(`cli-agent-runner-protocol.ts:126-129`). There is no per-seat backend column and no schema key
in this tree. Changing the environment changes every DSH seat on that daemon, so treat it as an
instance-level choice until P2 adds `execution.backend`.

Shared-web, development checkout:

```bash
export OPENRIG_DSH_BIN="$PWD/packages/daemon/assets/dsh/dsh-web-shim.py"
export OPENRIG_DSH_PROFILE=headless
rig up <rig.yaml> --cwd <project> --non-interruptive --yes
```

Headless is the default: unset `OPENRIG_DSH_BIN`, or point it at `dsh` on `PATH`.

## 3. The wire contract

Both paths must emit NDJSON that the runner can fold. The consumed subset is pinned in
`packages/daemon/src/adapters/cli-agent/dsh-event-protocol.ts` (`DSH_EVENT_PROTOCOL_VERSION = 1`):

| Event | Consumed behavior |
| --- | --- |
| `{"type":"session","sessionId":"..."}` | Records/updates the runtime session id; a conflicting id replaces the old one |
| `{"type":"status",...}` | Only `reason.kind === "error"` is terminal; `turn_start`/`progress`/`turn_end` are not interpreted |
| `{"type":"final","text":"..."}` | Appends text and marks the turn complete; empty text marks completion without output |
| `{"type":"error","error":...}` | Records a terminal error when there is no `final` |
| anything else | Ignored, not rejected, so a newer DSH can add events safely |

Blank and malformed lines are ignored. The runner flushes a trailing partial line when the
child closes (`cli-agent-runner.ts:195-199`, `:212`).

Failure mapping, unchanged by the P0 extraction:

| Situation | Result |
| --- | --- |
| Event carries `status.reason.kind=error` or `error` | `lastError` in the sidecar and `[cli-agent-runner] ERROR` in the pane |
| Non-zero exit | stderr tail, or `runtime exited with code N` when stderr is empty (`dsh-event-protocol.ts:162-175`) |
| Exit 0 and no `final` | **Still success** with empty result text; `missingFinal` is reported to callers but not promoted to an error |
| Shim reply timeout | Shim emits an error status plus empty `final`, writes stderr, exits 1 |
| Shim cannot import `dsh_ctl` | Exits non-zero with no NDJSON; the runner reports the child error |

The `missingFinal` decision is deliberately unchanged from the pre-P0 runner and was not
promoted by the 0.7.0 budget round. Turning it into a failure is a behavior change that needs
its own compatibility review.

The headless stream is richer than the shim's. The shim cannot report `tool_call` / `tool_result`
or token `usage`; headless DSH does emit them. Since OPR.0.7.0 P1a the runner **folds** those
events into an opt-in per-turn budget (`task-budget.ts`) when `budget.enabled=true`; the adapter
passes the limits as `--budget-*` args. The shim path is honestly `not_reported` for
tool/token coverage even with a limit configured (see
[seat-admission-and-task-budgets.md](seat-admission-and-task-budgets.md)).

## 4. Session identity and resume

The runner persists the runtime-native id in
`$OPENRIG_HOME/state/dsh/<session>/runner-state.json` (`startup.ts:881`,
`cli-agent-runner-protocol.ts:28-33`). On relaunch, the adapter auto-resumes only when the sidecar
was written by the same node id (`cli-agent-runtime-adapter.ts:157-161`); a new rig does not
inherit an unrelated old conversation.

- Shared-web validates a requested session against the seat `cwd` and the hard-coded `standard`
  preset; a mismatch silently creates a fresh session (`dsh-web-shim.py:56-80`).
- Headless passes `--session-id` to `dsh`, which owns its resume validation.
- `rig down` captures the sidecar id as `dsh_session` before teardown
  (`resume-token-capture.ts:122-130`); `rig up --existing` reuses it.

`rig capture` reads the pane and therefore shows both paths. Shared-web does not make the run
directory a DSH Web workspace; to browse files in the Web UI, use an already registered
workspace instead of expecting one per run.

## 5. Credentials

Neither path accepts a key on the command line, in rig YAML, or in the sidecar.

- **Shared-web** uses whatever auth the running DSH Web instance already has. The shim imports
  `dsh_ctl` from `$HOME/.dsh/clawbot-bridge/bridge-fork` and reads no key. It also assumes the
  Web instance is already running on `DSH_WEB_PORT` (default 3080); OpenRig does not start,
  stop, or restart it.
- **Headless** runs as the seat process and inherits the seat environment. Provider auth must be
  supplied there (for example `DEEPSEEK_API_KEY`) by the operator or the runtime's own config.
  An absent credential surfaces as the real child error in `lastError`; readiness is not faked.

Keep keys out of `OPENRIG_DSH_BIN`-adjacent YAML, logs, reports, and `rig ps` output on both
paths.

## 6. Timeouts, cancellation, cleanup

- Shared-web: `OPENRIG_DSH_REPLY_TIMEOUT` bounds one reply (default 1800s). On expiry the shim
  emits `status.reason.kind=error` (`code: OPENRIG_DSH_WEB_SHIM`), an empty `final`, and exits 1.
  It never retries the turn itself.
- Headless: with `budget.enabled=false` (the default) the runner has no wall-clock timeout; a
  turn ends when the child exits. With it on, `budget.max_wall_time_seconds` terminates the
  turn. Do not describe the default as enforced.
- Cancellation: the runner sends `SIGTERM` to the current child on shutdown
  (`cli-agent-runner.ts:237`). It kills the immediate child, not a re-parented process group;
  orphan-tree cleanup remains a P2 concern.
- The shim is a single process per turn. The headless child may spawn its own tools; OpenRig does
  not currently track that subtree.

## 7. Observability and `not_enforced`

The sidecar records `ready`, `launchId`, `nodeId`, `sessionId`, `lastResultText`, `lastError`,
and `exited`. Readiness reads that sidecar, not the pane's foreground command
(`cli-agent-runtime-adapter.ts:210-224`). That is why a staged `/bin/sh` wrapper does not make a
healthy runner look dead.

With `budget.enabled=false` (the default) both paths are `not_enforced`. With it on, the runner
enforces what the stream can prove, and the sidecar records coverage per dimension:

| Dimension | Shared-web | Headless |
| --- | --- | --- |
| Wall clock | runner deadline (opt-in; shim reply timeout remains) | runner deadline (opt-in) |
| Steps | no events → `not_reported` | counted from `step_start`/`step_end` |
| Tool calls | not emitted → `not_reported` | counted from `tool_call`/`tool_use` |
| Tokens | not emitted → `not_reported` | summed from `step_end`/`usage` |
| CPU / memory | no cgroup or sampler | no cgroup or sampler |

A `not_reported` dimension is **not** a pass: `rig ps --resources` shows
`coverage: "not_reported"` and reason `not_reported_by_runtime` rather than infer enforcement
from the presence of a shim. A budget breach terminates the turn
and writes `budget.exhausted` to the sidecar; it is never retried silently.

## 8. Tests that pin this contract

```bash
npx vitest run \
  packages/daemon/test/dsh-event-protocol.test.ts \
  packages/daemon/test/dsh-web-shim.test.ts
```

- `dsh-event-protocol.test.ts` covers session/status/final folding, error without final,
  non-zero exit, exit 0 without final, duplicate sessions, malformed lines, and error truncation.
- `dsh-web-shim.test.ts` runs the shipped Python shim with a fake `dsh_ctl` on a temporary
  `HOME`: success stream, reply timeout, missing bridge, and empty task. It never touches a real
  DSH Web instance or port 3080.
