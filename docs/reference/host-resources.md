# Host load and transcript capture

> This view is observational. It reports the enforcement the daemon actually
> performs (launch admission, provider/model seat starts, per-turn budgets) and
> says `not_enforced` with a reason where it performs none. CPU/memory cgroup
> budgets are not implemented; the broader design stays in
> [seat-load-isolation-and-resource-budgets-plan.md](seat-load-isolation-and-resource-budgets-plan.md).

Use `rig ps --resources` to inspect the serving host, or add `--host <id>`
for one registered HTTP/SSH host. `--json` returns the same measurements for
operators and monitoring tools. This view is host-scoped; rig/node filters and
multi-host fan-out do not apply. Ordinary `rig ps` output is unchanged.

The view reports available CPU count, host load averages (1/5/15 minutes),
load divided by CPU count, running seats, the number of rotating seats and how
many of them are backed off, and transcript capture attempts, failures, UTF8
bytes and elapsed capture time for currently rotating seats.
Load is not CPU utilization; capture elapsed time includes waiting for tmux,
and is not daemon CPU time. Load averages are unavailable on Windows, rather
than reported as zero. Counters reset when a rotation is restarted/stopped or
the daemon restarts, so they are observations rather than a durable billing log.
When no seat is capturing, the active interval, idle ceiling and line count are
unavailable (`null` in JSON), not zero.

## Reduce idle capture cost

Transcript rotation still captures the bounded trailing buffer. When successive
captures are unchanged and tmux exposes an unchanged current-window activity
hint, capture backs off exponentially to a derived ceiling. With the default
2-second active interval and 1-second settings timer, the effective ceiling is
3 seconds: the 10-second freshness window minus the 1-second activity-hint
deadline, 5-second capture-result deadline and 1-second timer spacing. The
ceiling is capped at 6 seconds but never below the configured active interval.
This scheduling budget is not a CPU or child-process lifetime bound; the result
deadline does not cancel an unfinished capture. One shared tmux
activity read wakes idle rotations; a changed hint restores the active cadence.
Missing/failed hints retain the configured full-capture cadence. A hint read
that takes longer than one second becomes unknown without starting additional
metadata probes while its underlying call is still pending. Periodic full
capture reconciles output even when a hint fails to change (tmux timestamps have
one-second resolution). Longer configured active intervals retain that interval
instead of silently increasing capture frequency.

This does not change provider readiness, delivery guards, seat activity or queue
state. Capture activity is not proof an agent is healthy or finished. As before,
transcripts are bounded trailing snapshots, not lossless terminal archives: an
output burst larger than retained tmux scrollback or the configured line limit
can exceed the saved trail. Interactive terminal streaming is unchanged.

## Change capture settings without restarting

```bash
rig config set transcripts.poll_interval_seconds 3
rig config set transcripts.lines 2000
rig ps --resources
rig config reset transcripts.poll_interval_seconds
```

Running rotations reread shared settings at most once per second and adopt the
next valid policy without starting overlapping captures. Intervals accept whole
seconds from 1 to 3600; trailing lines accept integers from 1 to 1000000. The
existing environment variables take precedence over file settings. Malformed
intermediate JSON retains the last usable policy, is shown in the resource view,
and is retried; normal config
writes reject invalid values. Changing `transcripts.enabled` or
`transcripts.path` still requires a daemon restart. This feature does not impose
CPU quotas or allocate build slots. For the default-off toolchain env projection
and the provider/model seat-start limit, see
[toolchain-and-provider-concurrency.md](toolchain-and-provider-concurrency.md).

## Per-seat resource enforcement

Since 0.7.0 the human view ends with one row per seat and enforcement dimension.
`--json` carries the same rows under `seats[]`; every row has `resource`,
`scope`, `limit`, `current`, `peak`, `enforcedBy`, `backend` and, when
enforcement is absent or partial, `reason`.

| Resource | Scope | What `limit` means |
| --- | --- | --- |
| `provider_seats` | `provider_model` | live seats for one provider/model (`resources.provider_limit.max_active_seats`) |
| `launch_slot` | `rig` | concurrently admitted seat starts for the rig (`resources.admission.max_per_rig`) |
| `wall_time` | `seat` | per-turn deadline (`budget.max_wall_time_seconds`) |
| `steps`, `tool_calls`, `tokens` | `seat` | per-turn counters (`budget.max_*`) |
| `cpu`, `memory` | `platform` | no cgroup budget in 0.7.0; always `not_enforced` |

The surface refuses to guess:

- A disabled master switch reads `not_enforced` with reason `disabled`; a
  configured dimension with no numeric cap reads `no_limit`. A missing number
  never means "unlimited and fine".
- `current` and `peak` are reported only from a real observation. Provider and
  launch peaks cover the daemon's lifetime; a budget peak covers the last turn
  in the runner sidecar (`peakScope: "last_turn"`).
- `provider_seats.current` uses the gate's own live-seat statuses
  (`running` / `idle` / `unknown`, by registry status), so it cannot show fewer
  occupied seats than the semaphore counts. `launch_slot.current` counts
  concurrently admitted seat *starts*, not running seats.
- A budget dimension the runtime never emitted reads `coverage: "not_reported"`
  and `reason: "not_reported_by_runtime"`, even when a cap is configured. The
  shared-web DSH shim emits only `session`/`status`/`final`, so its steps, tool
  calls and tokens stay `not_reported`; wall time is still enforced. With no
  runner sidecar at all, wall time is `no_runner_sidecar` and also
  `coverage: "not_reported"` — there is no clock to report.
- `cpu`/`memory` read `cgroup_budget_not_implemented` on Linux and
  `platform_unsupported` elsewhere. They are P3 work, not part of 0.7.0.
- A pre-0.7.0 daemon returns no `seats`; the CLI then prints
  `Per-seat resource enforcement: not reported by this daemon (older daemon).`
  rather than synthesizing rows.

The table is a read-only projection. It starts nothing, releases nothing and
changes no setting.

