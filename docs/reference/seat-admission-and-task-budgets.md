# Seat Admission and Per-Turn Task Budgets (0.7.0 P1a)

Status: implemented, **default off**. Source of truth:
`packages/daemon/src/domain/launch-admission.ts`,
`packages/daemon/src/adapters/cli-agent/task-budget.ts`,
`packages/daemon/src/adapters/cli-agent/cli-agent-runner.ts`.

This is the first P1 slice from
[seat-load-isolation-and-resource-budgets-plan.md](seat-load-isolation-and-resource-budgets-plan.md)
§5: a concurrency cap with a queue, per-task budgets, and a reserved interactive lane. It does
**not** add cgroups, provider rate limits, toolchain env projection or `rig ps --resources`
(r4/r5 own those).

## 1. What is admitted, and why launches

A "turn" happens inside the pane-hosted `cli-agent-runner` child process. The daemon has no turn
boundary it could hold, but it does own the thing that starts a seat: `NodeLauncher.launchNode`.
So the cap applies to **seat launch operations**:

- a launch over the cap waits in an in-memory FIFO queue instead of creating tmux + DB rows;
- the caller's `launchNode` promise stays pending until a slot frees or the queue deadline fires;
- on timeout the launch returns `admission_timeout` and **nothing is started** (no tmux session,
  no session/binding row);
- the slot is released in a `finally`, on success or failure.

The queue is deliberately in-memory. A daemon restart drops waiters; it does not resurrect stale
launches. That is a stated limitation, not a durability claim.

## 2. Lanes and the reserved interactive slot

| Lane | Who passes it | Cap |
| --- | --- | --- |
| `interactive` | operator/agent starting one seat: `POST /api/rigs/:rig/sessions/launch`, seat-lifecycle fresh start | the full limit |
| `background` (default) | rig instantiation / batch boot / restore / reconcile | `limit - reserved_interactive` at each level |

Reserved slots are enforced at both the global and per-rig levels: if
`max_concurrent=4` and `reserved_interactive=1`, background launches may occupy at most 3 slots.
Interactive waiters also strictly precede background waiters when a slot frees, so a batch boot
cannot starve an operator request even when the reservation is not the binding constraint.

A `reserved_interactive` larger than a limit floors the background cap at 0; it never makes the
limit negative. The snapshot reports the effective background caps so a later `ps --resources`
view does not have to re-derive them.

## 3. Budgets (per turn)

The daemon reads the budget once per launch and passes it to the runner as `--budget-*` args.
Each task line (one turn) gets a fresh counter set; the wall clock spans retries.

| Dimension | Counted from | Semantics |
| --- | --- | --- |
| `max_wall_time_seconds` | monotonic task start (in the runner) | deadline; reaching it terminates |
| `max_steps` | `step_start` (or `step_end` on end-only streams) | N allowed; the N+1th step terminates |
| `max_tool_calls` | `tool_call` / `tool_use` | N allowed; the N+1th call terminates |
| `max_tokens` | `usage` on `step_end` / explicit `usage` events | summed; exceeds the limit terminates |
| `max_retries` | non-budget failures only | 0 = never retry (today's behaviour); N = at most N extra attempts |

On a breach the runner:

1. emits `[cli-agent-runner] BUDGET_EXHAUSTED task budget exhausted: <dimension> limit=… observed=…`;
2. kills the current child (SIGTERM);
3. writes `budget.exhausted` + `lastError` to `runner-state.json`;
4. does **not** retry that turn.

`max_retries` is not a licence to retry a budget breach. A retry is allowed only when the failure
is not a budget breach and the budget still has headroom; each retry emits
`[cli-agent-runner] RETRY n/N`, so it is visible in the pane and the sidecar (`retries_used`).

## 4. Honest coverage (`not_reported`)

The shared-web DSH shim emits only `session` / `status` / `final`. It cannot report tool calls or
token usage. The sidecar therefore records coverage per dimension:

```json
{
  "budget": {
    "enforced": true,
    "coverage": { "steps": "not_reported", "tool_calls": "not_reported", "tokens": "not_reported" },
    "observed": { "steps": 0, "tool_calls": 0, "tokens": 0, "wall_time_ms": 1200 }
  }
}
```

`not_reported` means "the stream never carried this evidence", not "zero observed, therefore
fine". Wall time is always reported (the runner owns the clock). A dimension with no configured
limit is not a claim either; `budget.enabled=false` writes no `budget` field at all.

## 5. Configuration

All keys are visible in `rig config` / `rig config get` / `rig config --json --with-source`
(lockstep daemon/CLI twins) and are readable from `OPENRIG_*` env vars.

| Key | Default | Meaning |
| --- | --- | --- |
| `resources.admission.enabled` | `false` | master switch; off = every launch proceeds immediately |
| `resources.admission.max_concurrent` | `4` | global cap (positive integer) |
| `resources.admission.max_per_rig` | `2` | per-rig cap (positive integer) |
| `resources.admission.reserved_interactive` | `1` | slots background must leave free (0 allowed) |
| `resources.admission.queue_timeout_seconds` | `300` | queue deadline; 0 = wait forever |
| `budget.enabled` | `false` | master switch; off = runner gets no `--budget-*` args |
| `budget.max_wall_time_seconds` | `1800` | per-turn deadline |
| `budget.max_steps` | `200` | per-turn step cap |
| `budget.max_tool_calls` | `100` | per-turn tool-call cap |
| `budget.max_tokens` | `0` | 0 = unlimited |
| `budget.max_retries` | `0` | extra attempts for non-budget failures |

The admission resolver is read fresh at every acquire, so a `rig config set` flip applies to the
next launch without a daemon restart. The budget is read at launch time; a flip applies to the
next seat launch (already-running runners keep their args).

## 6. What this slice does NOT do

- No CPU/memory cgroup enforcement, no `execution.backend`, no headless resume (P2/P3).
- Provider/model limits and toolchain env projection are **not** in this slice; they are the
  default-off P1b controls in
  [toolchain-and-provider-concurrency.md](toolchain-and-provider-concurrency.md).
- `rig ps --resources` renders these seams per seat since 0.7.0: `LaunchAdmissionQueue.snapshot()`
  and `ProviderRateLimiter.snapshot()` supply `limit / current / peak / queued / enforced_by`, and
  the runner sidecar supplies `budget.coverage` + `budget.exhausted`. See
  [host-resources.md](host-resources.md#per-seat-resource-enforcement).
- No durable queue across daemon restarts.
- No per-rig YAML `resources:` block. The settings schema (`rig config`) is the config surface
  this round ships; per-rig persistence would need a DB/schema decision (see the round's
  `DECISIONS.md`).

## 7. Tests

```bash
npx vitest run \
  packages/daemon/test/launch-admission.test.ts \
  packages/daemon/test/node-launcher-admission.test.ts \
  packages/daemon/test/task-budget.test.ts \
  packages/daemon/test/cli-agent-budget-runner.test.ts \
  packages/daemon/test/user-settings-store.test.ts \
  packages/cli/test/config-store-extended.test.ts
```

- `launch-admission.test.ts` pins default-off, dual caps, FIFO, interactive priority, reserved
  slots, timeout, peak and idempotent release.
- `node-launcher-admission.test.ts` pins the real launch path: the second launch waits, only one
  tmux create runs, a release starts the waiter, a timeout starts nothing, and lanes/leases are
  passed/released on success and failure.
- `task-budget.test.ts` pins the fold for all five dimensions, 0 = unlimited, coverage honesty,
  retry caps and wall-clock semantics.
- `cli-agent-budget-runner.test.ts` runs the real runner against a stub runtime: no args = no
  accounting; tool-call breach; wall-clock breach; visible non-budget retry.
