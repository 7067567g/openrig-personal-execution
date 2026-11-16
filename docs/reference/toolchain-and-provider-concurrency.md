# Toolchain and Provider Concurrency Limits (0.7.0 P1b)

Status: implemented, **default off**. Source of truth:
`packages/daemon/src/domain/toolchain-environment.ts`,
`packages/daemon/src/domain/provider-rate-limit.ts`,
`packages/daemon/src/domain/node-launcher.ts`.

This is the second P1 slice from
[seat-load-isolation-and-resource-budgets-plan.md](seat-load-isolation-and-resource-budgets-plan.md)
§5. It adds two independent, default-off controls:

1. **Toolchain concurrency projection** — one per-seat budget expressed through the environment
   variables build/test tools already read.
2. **Provider/model seat-start limiting** — a live-seat semaphore and a launch token bucket per
   provider/model key.

Neither changes the daemon's own process environment. Neither is a cgroup, an API proxy or a
per-request rate limiter.

## 1. Toolchain projection

`projectToolchainEnvironment()` maps one positive integer `N` into exactly these variables:

| Variable | Value |
| --- | --- |
| `CARGO_BUILD_JOBS` | `N` |
| `RUST_TEST_THREADS` | `N` |
| `MAKEFLAGS` | `-jN` |
| `CMAKE_BUILD_PARALLEL_LEVEL` | `N` |
| `UV_CONCURRENT_BUILDS` | `N` |
| `NPM_CONFIG_JOBS` | `N` |
| `UV_THREADPOOL_SIZE` | `N` |

Scope and precedence:

- The map is merged into the **launch environment of the one tmux session** created for a seat
  (`NodeLauncher` → `tmux new-session -e`), so the seat process and the builds it starts inherit
  it. The daemon process, other seats and the rig spec are untouched.
- It is applied **first**. `sessionEnv` (the daemon's launch env), `runtimeSessionEnv`, the seat
  spec's `env:` and a one-off `rig up --env` are merged after it, so any pre-existing value wins.
  This is deliberate: the projection only fills gaps, never overrides an operator's setting.
- A handover/respawn inherits the session environment, so the projection survives an occupant
  change without a second config read.
- `enabled=false` **or** `jobs=0` projects nothing. `jobs=0` is the explicit "no projection"
  state; it is not an implicit unlimited value.
- A config-read failure projects nothing; it never fails a launch.
- The projection is read once per launch, so `rig config set` applies to the next seat, not to
  seats already running.

| Key | Default | Meaning |
| --- | --- | --- |
| `resources.toolchain.enabled` | `false` | master switch |
| `resources.toolchain.jobs` | `0` | positive N projected into every variable; 0 = project nothing |

## 2. Provider/model seat-start limiting

OpenRig does not proxy provider API calls. The daemon's provider domain reads usage and account
metadata; the processes that actually call Anthropic/OpenAI/DeepSeek are the seats. The daemon's
one lever on provider load is therefore **how many seats of a provider/model are alive and how
fast new ones start**. This module bounds exactly that:

- **semaphore** — live seats for a `provider/model` key, counted from the session registry
  (`sessions.status IN ('running','idle','unknown')`) plus launches this daemon has admitted but
  not yet registered;
- **token bucket** — new seat starts per minute for the same key, with a configurable burst.

Provider is derived from the seat runtime:

| Runtime | Provider key |
| --- | --- |
| `claude-code` | `claude` |
| `codex` | `codex` |
| `dsh` | `deepseek` |
| `pi` / `omp` | `pi` / `omp` |
| anything else | the runtime string itself |

Model is `nodes.model`, or the empty model key when the node has no explicit model. A request
waits before `NodeLauncher` touches tmux or the database; on timeout it returns
`provider_rate_limited` and **starts nothing**. The lease is released in the same `finally` as the
launch-admission lease.

| Key | Default | Meaning |
| --- | --- | --- |
| `resources.provider_limit.enabled` | `false` | master switch; off = no query, no queue, no counters |
| `resources.provider_limit.max_active_seats` | `0` | live-seat cap per provider/model; 0 = unlimited |
| `resources.provider_limit.launches_per_minute` | `0` | start-rate cap per key; 0 = unlimited |
| `resources.provider_limit.burst` | `4` | token bucket capacity; 0 inserts one token at a time |
| `resources.provider_limit.queue_timeout_seconds` | `30` | queue deadline; 0 = wait forever |

Honest states:

- `enforcedBy="not_enforced"` with `reason="disabled"` when the master switch is off.
- `enforcedBy="not_enforced"` with `reason="no_limit"` when enabled but both numeric caps are 0.
- `reason="config_error"` when the config reader throws; the start is admitted (fail open).
- A live-count read failure also **fails open** and increments `countErrors` in the snapshot.
  A broken registry read must not brick launches.
- The queue is in-memory and not durable; a daemon restart drops waiters. Turning the feature off
  while starts wait releases them as `not_enforced`.

`ProviderRateLimiter.snapshot()` reports `limits`, `current`, `peak`, `queued`, `enforcedBy` and a
per-key breakdown (`live`, `pending`, `current`, `peak`, `queued`, `countErrors`). Since 0.7.0 the
`rig ps --resources` view consumes this data per seat and shows `not_enforced`/`not_reported` rather
than inventing a limit. The daemon **does not** bound individual provider requests; that would
need a runner↔daemon lease protocol or a proxy, which this round does not add.

## 3. Compatibility

- Both master switches default `false`; with them off the launch env and launch path are
  byte-for-byte unchanged, and no registry query runs.
- New keys are additive to the settings schema (`rig config`), not a rig-spec YAML block.
- No `BREAKING` change. Existing env values win over the toolchain projection.
- No credentials, tokens or provider keys are read, logged or exposed by either feature.

## 4. Tests

```bash
npx vitest run \
  packages/daemon/test/toolchain-environment.test.ts \
  packages/daemon/test/node-launcher-toolchain-env.test.ts \
  packages/daemon/test/provider-rate-limit.test.ts \
  packages/daemon/test/node-launcher-provider-limit.test.ts \
  packages/daemon/test/user-settings-store.test.ts \
  packages/cli/test/config-store-extended.test.ts
```

The tests pin: default-off / zero / non-integer behaviour; the exact seven-variable map; that a
pre-existing value wins; that no key is added when disabled; that a resolver failure does not fail
a launch; the live-seat cap queue and timeout; the token-bucket wait; key isolation; fail-open
behaviour; and that the limiter is never consulted when absent or disabled.
