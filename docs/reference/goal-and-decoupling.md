# Goal and decoupling — goal as the object, run-driver as the only advancer

> **Status: proposal, not implemented.** 0.7.0 has no `goals` table, no `rig goal`
> command, no run-driver, and no `evidence_records` / `approvals` / `run_actions`
> tables. Nothing in this page describes current behavior. It is the contract input
> for M1; the code is right wherever this page disagrees with it.
>
> Baseline for every `file:line` below: commit `eba788d` (0.7.0), checked
> 2026-10-24; the cited code paths are unchanged since the release cut. Provenance: `workflow-group/runs/openrig-next-stage-20261022/reports/03-design.md`
> and its QA verdict `05-final.md`; this page moves the durable design into the
> repository and drops the one-off run narrative.
>
> Labels used below: **FACT** = read in this tree, with `file:line`;
> **INFERENCE** = reasoned from facts but not verified on a live daemon;
> **PROPOSAL** = not implemented, open to revision during M1.

## 1. Why this exists

**FACT.** OpenRig already has the storage for a run: `workflow_instances`, the
frontier packet, `workflow_step_trails`, `queue_items`, wake and resume. What it
does not have is (a) a durable object that owns the person's intent and (b) an
executor that advances a run without a conversation doing it.

- No goal object exists. Migrations stop at `114_session_agent_app.ts`
  (`packages/daemon/src/db/migrations/`), and no `goal_id` / `goalId` symbol
  appears in `packages/daemon/src`. `--root-objective` is only text written into
  the entry packet body (`packages/daemon/src/domain/workflow-runtime.ts:1843-1854`).
- The workflow engine does not advance itself. The only caller of
  `runtime.project()` is the HTTP route
  (`packages/daemon/src/routes/workflow.ts:290`), and that route is mounted
  without a bearer (`packages/daemon/src/server.ts:796`).
- There is no `main` object. The word shows up as a CLI pod name
  (`packages/cli/src/commands/create.ts:58,93`) and as a template target
  (`control-main@…` in `packages/daemon/src/builtins/workflow-specs/opencode-dsh.yaml:27`),
  but no code resolves "the current conversation" as an owner.

The practical consequence: close the conversation, and the goal and the thing that
pushes it both disappear. A queue row or a `PROJECT.md` is not a goal; a
transcript is not an audit log.

**PROPOSAL.** Add the two missing roles, not a second control plane:

1. `goal` — a durable row that owns the intent text and the acceptance contract.
2. `run-driver` — a loop inside the daemon, not a seat, that is the only writer of
   run progress and the only caller of `project()` for goal-bound runs.

Everything else (frontier, packet, trail, wake, queue, SQLite) is reused.

## 2. Object model — what is authoritative

| Object | Authority | Writer | Nature |
| --- | --- | --- | --- |
| principal (the person) | `goals.principal` (M1: string; M2: human registry) | submit | authoritative |
| **goal** | `goals` (new table) | submit / cancel request / driver | **authoritative** |
| run | `workflow_instances` + goal columns | driver only | authoritative |
| step packet | `queue_items` (existing) | projector | authoritative |
| action ledger | `run_actions` (new, `action_key UNIQUE`) | driver | authoritative, idempotent |
| evidence | `evidence_records` (new) + file in `proof/` | executor writes; verifier signs | authoritative |
| approval | `approvals` (new) | requester / authorized person | authoritative |
| rig / pod / seat / session | existing tables | existing paths | authoritative |
| conversation | runtime-native files + resume token | runtime | **payload, not state** |
| `--root-objective`, `PROJECT.md`, transcript | derived | — | projection |
| `rig ps` / TUI / web views | derived | — | projection |

**Do not** treat `queue_items.body` or `chat_messages` as the goal, `PROJECT.md`
as state, or a transcript as an audit trail. Those are the anti-patterns this
design exists to remove.

**PROPOSAL — M1 schema (all additive).** Four tables and a set of nullable columns:

```sql
CREATE TABLE goals (
  goal_id TEXT PRIMARY KEY,            -- ULID
  idempotency_key TEXT NOT NULL UNIQUE,
  principal TEXT NOT NULL,             -- from the bearer subject, never client-supplied
  text TEXT NOT NULL,                  -- the goal statement, sole authority
  workflow_name TEXT, workflow_version TEXT,
  acceptance_json TEXT,                -- [{id, statement, evidence_kind}]
  constraints_json TEXT,               -- maxHops / maxAttempts / wallClockSec / budget
  status TEXT NOT NULL,                -- materialized cache, written with the run transition
  cancel_requested_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  closed_at TEXT, close_reason TEXT
);

ALTER TABLE workflow_instances ADD COLUMN goal_id TEXT;          -- NULL = legacy, unchanged
ALTER TABLE workflow_instances ADD COLUMN attempt INTEGER NOT NULL DEFAULT 1;
ALTER TABLE workflow_instances ADD COLUMN lease_epoch INTEGER NOT NULL DEFAULT 0;
ALTER TABLE workflow_instances ADD COLUMN lease_owner TEXT;
ALTER TABLE workflow_instances ADD COLUMN lease_expires_at TEXT;
ALTER TABLE workflow_instances ADD COLUMN waiting_reason TEXT;
ALTER TABLE workflow_instances ADD COLUMN stop_reason TEXT;
ALTER TABLE workflow_instances ADD COLUMN last_tick_at TEXT;

CREATE TABLE run_actions (            -- one row blocks every duplicate side effect
  action_key TEXT PRIMARY KEY,        -- f(run, packet, attempt, kind)
  run_id TEXT NOT NULL, qitem_id TEXT, kind TEXT NOT NULL,
  epoch INTEGER NOT NULL, actor TEXT NOT NULL,
  evidence_digest TEXT,               -- frozen at closure, detects later edits
  occupant_generation TEXT,           -- occupant_tenures.generation_uuid at closure
  started_at TEXT NOT NULL, finished_at TEXT,
  outcome TEXT NOT NULL               -- ok | error | skipped
);

CREATE TABLE evidence_records (
  evidence_id TEXT PRIMARY KEY, goal_id TEXT, run_id TEXT NOT NULL, qitem_id TEXT,
  step_id TEXT, kind TEXT NOT NULL, ref TEXT NOT NULL, digest TEXT NOT NULL,
  produced_by TEXT NOT NULL, verified_by TEXT,
  verdict TEXT NOT NULL,              -- pass | fail | pending
  created_at TEXT NOT NULL, superseded_by TEXT
);

CREATE TABLE approvals (
  approval_id TEXT PRIMARY KEY, goal_id TEXT NOT NULL, run_id TEXT, qitem_id TEXT,
  requested_by TEXT NOT NULL, action_class TEXT NOT NULL, summary TEXT NOT NULL,
  decision TEXT NOT NULL,             -- pending | approved | rejected | expired
  decided_by TEXT, reason TEXT,
  created_at TEXT NOT NULL, decided_at TEXT, expires_at TEXT
);
```

**INFERENCE.** This shape covers the M1 scope. It is deliberately additive:
legacy instances have `goal_id IS NULL` and must behave byte-for-byte as they do
today.

## 3. Goal lifecycle

`goals.status` is a cache. Every transition is driven by a durable run transition
and written by the driver in the same transaction. A goal must not run a second
state machine beside the run.

> `draft` is a client state. It is not stored. Once `POST /api/goals` succeeds,
> the row is authoritative and the client draft is discarded.

| Goal state | Entered when | Trigger | Durable effect | Idempotency key |
| --- | --- | --- | --- | --- |
| `submitted` | `POST /api/goals` validates | principal | goal row + active instance + entry packet | `submit:<idem>` |
| `planned` | entry packet exists and an owner resolves | driver | `last_tick_at` | `plan:<run>` |
| `running` | at least one packet is `in-progress` | driver | — | — |
| `waiting_human` | pending approval / blocked on a human | driver | `waiting_reason` | `ask:<approval>` |
| `verifying` | frontier empty and closure pending (M2 only) | driver | closure check | `verify:<run>` |
| `done` | every acceptance has `pass` evidence with `verified_by != produced_by` | driver | `closed_at` + evidence | `close:<run>` |
| `failed` | step `failed`, budget/wall-clock exhausted, retries exhausted | driver | `stop_reason` | `close:<run>` |
| `cancelled` | `cancel_requested_at` set, driver reaches a tick boundary | principal request → driver | open packet closed `canceled`, no new packet | `cancel:<run>` |

Run-side mapping reuses the existing enum
(`packages/daemon/src/domain/workflow-types.ts:203`):
`submitted/planned/running → active`; `waiting_human → waiting`;
`done → completed`; `failed/cancelled → aborted`.

Rules:

- **Cancel is a request, not a kill.** Set `cancel_requested_at`; at the next tick
  the driver closes the open packet with `closure_reason=canceled`, creates no
  next packet, and writes `aborted` plus evidence. Do not kill a seat mid-write.
- **Retry is a new attempt, not `resume`.** A new attempt is a new instance with
  `attempt+1`; the old instance stays for audit and `chain` points at it. `resume`
  only accepts `failed` (`packages/daemon/src/domain/workflow-runtime.ts:1122`).
- **Timeouts are three layers:** step `closure_required_at` (existing), run
  `constraints.wallClockSec`, and per-step `maxAttempts`. Reaching a bound is
  `failed` + `stop_reason` + evidence. It must never silently stay `active`.
- **Terminal rows are not deleted.** `done/failed/cancelled` only get `closed_at`.

## 4. Decoupling `main` from the conversation

**PROPOSAL.** Split four roles that today collapse into one `member@rig`:
principal (decides and approves), driver (advances), executor (does the step),
observer (anyone reading). The goal object is the fifth piece: it remembers and
authorizes.

| Situation | Today | With a goal object | Mechanism |
| --- | --- | --- | --- |
| Chat window closed | intent lives only in that session | no effect on the run | no run state is written into a conversation |
| New device / new session | only `rig ps` | `rig goal status <id>` from any client | `GET /api/goals/:id`, read-only, no seat needed |
| New session takes over | no path | `rig run attach <id> --session <s>` | records an observation; does not transfer ownership |
| Submitter leaves | run stalls | run continues | principal is an approver, not the executor |
| Approver on another machine | must be in that pane | `rig goal approve <goal> <approval>` | bearer + principal comparison |

**Sessions stay owned by seats.** `sessions.node_id` still binds a conversation to
a seat; a run owns no session. A resume token belongs to the seat's conversation,
not to the run. That is what makes "can the run continue?" independent of "is that
conversation still open?".

**`attach` mounts, it does not resume.** It renders a brief into the target
session: goal text, run state, frontier packet, recent evidence, pending approvals,
next deadline. It does not restore the old context. The old context remains in the
old session's native files and can still be opened by its resume token; the two
are independent.

**When someone is missing** (write this down; it prevents "active but nothing
happens"):

| Missing | Driver action | What the person sees |
| --- | --- | --- |
| step owner seat is dead | M1: escalate; M2: bounded relaunch | `waiting_reason=no_live_executor` + seat name |
| observing session disappears | nothing | — |
| driver itself (daemon dead) | on restart `epoch++`, recompute from SQLite | `last_tick_at` is stale → `stalled` |
| a new occupant does not know which run it serves | inject env at launch | `OPENRIG_GOAL_ID` / `OPENRIG_RUN_ID` |

Env injection uses the existing non-secret seat env columns added by
`packages/daemon/src/db/migrations/111_seat_env.ts:1-12` (`rigs.env_json`,
`nodes.env_json`). Packet delivery headers must carry `goal_id / run_id /
step_id / upstream evidence refs`, and a wake must carry a replyable `source`;
otherwise a fresh occupant cannot find its run.

## 5. The run-driver

**PROPOSAL.** Location: `packages/daemon/src/domain/run-driver.ts`, started by the
daemon after ready. It is not a seat, occupies no rig, and does not enter the
queue.

Triggers: queue state change, wake failure, instance change, plus a 15-second
fallback sweep. It must not poll the whole database on every tick.

```text
tick():
  for run in workflow_instances where goal_id is not null and status in (active, waiting):
    if cancel_requested:          do_cancel(run);                continue
    if budget or wallclock hit:   do_stop(run, "budget");        continue
    pkt = frontier[0]
    if pkt has step_completion evidence:
        st = do_advance(run, pkt)        # the only caller of project() for this run
    elif pkt.overdue:             do_redrive(run, pkt)           # bounded
    elif owner not live:          do_escalate(run, pkt, "no_live_executor")
    else:                         do_nudge(run, pkt)             # existing wake ladder
    if declared and st == "completed": finalize_goal(run, "done")  # same tick
    write last_tick_at
```

`do_advance` calls `project()` with two separate identities: the caller is the
driver (the only subject allowed by the goal-bound gate), and `actorSession` is the
declaring executor (the parameter's owner-as-author semantics). Both go into
`run_actions`: `actor=driver, on_behalf_of=<executor>`.

**Bounded autonomy (M1 defaults).**

| Dimension | Default | At the bound |
| --- | --- | --- |
| `max_hops` | existing spec `loop_guards` | `failed` + evidence |
| `maxAttempts` per step | 3 | escalate `waiting_human`, no infinite retry |
| wall clock | 4h | `failed(stop_reason=wallclock)` |
| seat relaunches | M1: 0 (escalate only); M2: 2 | `waiting_human` |
| cost/token budget | M3 | `failed(budget)` |
| dead-man | no tick for 3× interval | `stalled` + notify; state unchanged |

**Automatic vs needs approval.** Automatic: workspace reads/writes, tests, opening
or closing queue rows, advancing a workflow, restarting its own seat. Needs a
person: host-credential actions, destructive/irreversible actions (push, publish,
deploy, delete data), over-budget work, another rig, or changing the goal itself.
Permission policy and approval are separate lines; do not merge them.

**The driver does not plan.** M1 requires an explicit `--workflow <spec>` on
submit. M2 may accept a planner seat's proposal, but the driver only validates and
instantiates it; an invalid spec creates no instance.

**Seat selection is not re-implemented.** Reuse the projector's existing
`resolveDefaultOwner` chain. The driver intervenes at only two points: an empty
resolution escalates `no_live_executor`, and (M2) a resolved but dead seat gets a
bounded relaunch. The projector alone writes `destination_session`; two writers
would produce two owners.

## 6. Evidence and principal — the two M1 corrections

These were P0 findings in QA and are part of the M1 gate, not later hardening.

### A1 — the evidence gate must run before `project()`

**FACT.** A non-routed terminal exit with an empty next frontier writes
`completed` in the same transaction:
`packages/daemon/src/domain/workflow-projector.ts:762-764`. Therefore the state
"active with an empty frontier" never exists, and a verifier mounted after frontier
drain would never run.

**FACT.** Acceptance currently compares three strings, including
`payload.evidence_ref !== step.acceptance.evidence_ref`
(`packages/daemon/src/domain/workflow-projector.ts:1882`). Presence of a path is
not existence, and a literal path per spec cannot bind one evidence row per run.

**PROPOSAL.**

1. Move the gate into `do_advance`, before `project()`: the frontier packet must
   have a `step_completion` evidence row; the row's digest must match the file;
   the step's acceptance contract (by `evidence_kind`, not a literal path) must be
   met. A final step then cannot reach `completed` without evidence.
2. The executor's verb is **declare**, not close:
   `rig evidence add --qitem <pkt> --kind step_completion --ref <path>`. It writes
   an `evidence_records` row (file must exist; digest computed now; `qitem_id` and
   `step_id` required) and does not touch queue state.
3. The queue layer already refuses an out-of-band terminal close of a live
   frontier packet (`packages/daemon/src/domain/queue-repository.ts:2673-2686`,
   error `workflow_frontier_packet`). Do not widen that guard; "declare is
   evidence" also eliminates the "declare first, produce later" state, because the
   declaration *is* the evidence row.
4. At closure, write `evidence_digest` and `occupant_generation` into
   `run_actions`. A later recomputation that does not match sets
   `verdict=fail(evidence_stale)` and marks the goal `needs_review`. The completed
   instance is not rolled back; rolling it back would create a second truth.

**Leave no separate `do_verify` / `do_finalize` stage.** The last `project()` writes
`completed` inside its own transaction, so a tick that selects `active|waiting`
will never see an empty-frontier active run. `do_advance` writes the goal's
`done`/`needs_review` when `project()` returns `completed`.

### A2 — principal comes from the bearer subject

**FACT.** `/api/workflow` is mounted without a bearer (`packages/daemon/src/server.ts:796`),
and the bearer that exists is a single static token,
"Token holder is fully privileged"
(`packages/daemon/src/middleware/auth-bearer-token.ts:11-14`). A client-supplied
`principal` string makes `approve`'s principal comparison always true.

**PROPOSAL.** `goals` routes require a bearer from day one, and `principal` is
taken from the bearer subject (`owner:<token-id>`), never from the request body.
Multi-principal identity comes from the human registry in M2.

**M1 must close the goal-bound project path.** For `goal_id IS NOT NULL`,
`POST /api/workflow/project` returns `403 use_in_process_driver`. This is not
"check that the caller is the driver" (there is no identity carrier to check); it
removes the path, because the in-process driver does not need HTTP. Legacy
instances (`goal_id IS NULL`) keep byte-identical behavior. `rig run recover`
writes a tick request for the driver to consume; it does not call `project()`
itself.

**Explicitly accepted in M1:** `/api/queue` and legacy `/api/workflow/*` anonymous
writes remain. M1 only promises that the new tables and new verbs add no anonymous
surface. This is a residual risk, not a silent omission.

## 7. Interfaces (one state, several consumers)

**PROPOSAL — M1 verbs.**

| Action | HTTP | CLI | Authority |
| --- | --- | --- | --- |
| submit | `POST /api/goals` | `rig goal submit --text … --workflow … [--accept file] [--budget]` | bearer + principal |
| read | `GET /api/goals/:id` | `rig goal status <id> [--json]` | bearer (read-only) |
| list | `GET /api/goals?state=` | `rig goal list` | bearer (read-only) |
| approve | `POST /api/goals/:id/approvals/:aid` | `rig goal approve <goal> <aid> --decision approve\|reject --reason` | principal comparison |
| cancel | `POST /api/goals/:id/cancel` | `rig goal cancel <id> --reason` | principal comparison |
| attach | `POST /api/runs/:id/attach` | `rig run attach <id> --session <s>` | bearer |
| declare | `POST /api/evidence` | `rig evidence add --qitem <pkt> --kind step_completion --ref <path>` | bearer + seat session |
| recover | `POST /api/runs/:id/recover` | `rig run recover <id> --reason` | bearer (requests one tick) |
| read run | `GET /api/runs/:id` | `rig run status <id>` | bearer |

`rig goal submit` returns `{goal_id, run_id, entry_packet, state}`. A repeated
idempotency key returns the same pair (201 → 200). TUI and web are read-only
consumers of `GET /api/goals/:id` in M1; submission from the UI is M3.

`rig goal status` must be enough to judge the run from a phone: state, the literal
stop reason, next deadline, pending approvals, latest evidence, `run_id`, and
instance status.

## 8. Persistence, recovery, idempotency

Authoritative: SQLite (`goals`, `workflow_instances`, `queue_items`,
`run_actions`, `evidence_records`). Payload: runtime conversation files, `proof/`
files, transcripts. Derived: every view.

| Crash point | Persisted | Restart action | Duplicate side effect |
| --- | --- | --- | --- |
| after submit, before instantiate | `goals` row | driver sees `submitted` with no instance and creates it idempotently (`plan:<run>`) | blocked by ledger |
| inside `project()` transaction | one transaction (`workflow-projector.ts:12,21`) | rollback; frontier unchanged | none |
| after `project()`, before nudge | new packet + outbox | `do_nudge`; nudge is at-least-once | none |
| executor dies | packet stays `in-progress` | `closure_required_at` → `do_redrive` | `redrive:<pkt>:<attempt>` |
| daemon restarts | all rows | `epoch++`, keep `last_tick_at`, recompute frontier | old-epoch writes fenced |
| host restarts | SQLite + native files | seats do not auto-restore → `no_live_executor` | — |

Three guards prevent duplicates: `run_actions.action_key UNIQUE`; `project()`'s
own optimistic/frontier checks; and epoch fencing (columns exist in M1, truly
enforced in M2).

**Same-seat concurrent occupants.** `project` must verify the caller's
`occupant_tenures.generation_uuid` and record it at closure. Two occupants of one
seat must not both be able to "represent" that seat.

## 9. M1 scope and acceptance

**In M1:** the four additive tables; `submit/status/cancel` + `rig evidence add`;
driver `do_advance` (including closure confirmation), `do_nudge`, `do_redrive`,
`do_cancel`; `waiting_reason`; four-state notification; seat env injection; goals
routes with bearer + principal comparison; A1 evidence gate; goal-bound project
403.

**Not in M1:** automatic planning, automatic seat relaunch, multi-host, cost/token
budget, UI submission, multi-client lease enforcement.

| # | M1 acceptance (observable) | Source test |
| --- | --- | --- |
| A1 | With the operator/main session closed and a seat alive, submit advances to `done` with zero client calls. | T14 / roadmap M1 |
| A2 | Every packet closure has a matching `run_actions(actor=driver)` row. | roadmap M1 |
| A3 | A non-driver `project` on a goal-bound instance returns 403 `use_in_process_driver`; legacy instance behavior is unchanged. | T22 |
| A4 | Kill the daemon mid-run; on restart there is no duplicate packet and the run finishes. | T3, T4 |
| A5 | The same idempotency key twice returns the same `goal_id`/`run_id`; no second instance. | T1, T2 |
| A6 | A missing evidence file refuses advancement. | T8 |
| A7 | An evidence file changed after closure produces `evidence_stale` and does not report clean `done`. | T9, T24 |
| A8 | `verified_by == produced_by` refuses `done`. | T10 |
| A9 | Cancel takes effect within one tick, closes the packet `canceled`, and creates no new packet. | T11 |
| A10 | Wall-clock exhaustion ends `failed(wallclock)` with evidence, never `active`. | T12 |
| A11 | Zero live seats at submit ends `waiting_human(no_live_executor)` and creates no unrunnable active run. | T6 |
| A12 | `rig goal status` is complete from a different session/host; `attach` renders a brief without taking ownership. | T14, T17 |

**M1's single most important test:** a handoff with no artifact is refused. That
defect was observed twice on a live daemon in the source run; the gate, not the
agent's discipline, is the fix.

**Rollback:** `OPENRIG_GOALS=off` turns off the routes and the driver; the new
tables are additive and `goal_id IS NULL` legacy rows behave unchanged.

## 10. Non-goals

Do not build in M1: a second packet/wake semantics; a general LLM planner inside
the daemon; one rig per goal; multi-master daemon sync; a UI rewrite; using
`chat_messages` as an inbound control plane; an `attach` that transfers ownership;
an `autonomy` switch that auto-approves.

## 11. Risks

| Risk | Mitigation |
| --- | --- |
| New tables exist but authority does not move; conversation still drives. | Only the driver writes run state; executors only declare evidence; shadow mode first. |
| The driver becomes a single point or silently stalls. | `last_tick_at` + existing watchdog `stalled` + a `waiting_reason` on every stop. |
| Autonomy amplifies self-certification (`done` = declared done). | A1 gate in M1; `verified_by != produced_by`; mechanical verification proves only existence + digest. |
| Identity spoofing (principal / driver). | Bearer subject for principal; goal-bound project path removed; human registry + second channel in M2. |
| Post-closure drift / same-seat concurrent occupancy. | Freeze `evidence_digest` + `occupant_generation` at closure. |

## 12. Relationship to other documents

- `docs/as-built/architecture/workflow-runtime.md` — current workflow engine
  behavior this proposal builds on. Repository-only; it does not ship.
- [`seat-load-isolation-and-resource-budgets-plan.md`](seat-load-isolation-and-resource-budgets-plan.md) —
  the resource-control proposal; independent of goals, but the driver adds another
  in-process writer that must respect it.
- [`run-archive-and-teardown-guard.md`](run-archive-and-teardown-guard.md) — run
  archives and guarded teardown; a goal's completed run remains an archived record.
- [`release-boundary.md`](release-boundary.md) — the release ceremony; a shipped
  goal feature must update this page's status rather than leave a proposal
  pointing at implemented code.

When M1 ships, this page becomes as-built: move it to `docs/as-built/architecture/`
or add a "Status: implemented in <version>" banner and keep the acceptance table as
the regression contract. Do not ship code while this page still says "not
implemented".
