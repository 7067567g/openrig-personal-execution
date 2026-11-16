# OpenRig reference — index by topic and status

This directory is the user and operator reference that ships with `@openrig-local/cli`
(`scripts/build-package.sh` stages it into the package; the daemon materializes it
under `$OPENRIG_HOME/reference/`). It is not the developer as-built tree, which
stays in `docs/as-built/` and does not ship.

> **文档地图：** 本区随包发布；开发视图见 [../as-built/README.md](../as-built/README.md)；仓内入口见 [DOCS-MAP.md](../../DOCS-MAP.md)；跨仓总图见 [../../../../deepseek-知识库/workflow-group/docs/openrig/README.md](../../../../deepseek-知识库/workflow-group/docs/openrig/README.md)。

The index was checked against the 0.7.0 pre-line tree at `eba788d` on 2026-10-24. The
local 0.1.x line changes the version line, the package scope (`@openrig-local/*` since
0.1.2) and the fork policy docs, not the behavior described here. A page can still be
stale in detail; where it disagrees with the code, the code is right.

## Status legend

| Status | Meaning |
| --- | --- |
| **Shipped** | Describes behavior in the current release. |
| **Shipped, default off** | Implemented, but the feature is disabled until an operator turns it on. |
| **Proposal** | Design only. The code does not implement it. Do not cite it as behavior. |
| **Proposal, partly shipped** | Some phases shipped; the page still contains unimplemented phases. Read its status banner before relying on a section. |
| **Experimental** | Explicitly not guaranteed; may be incomplete or not work. |
| **Repository-only** | Lives outside the shipped reference tree; named, not linked, so an installed copy has no dead link. |

A page's own banner or title is the finer authority. This table is a map, not a
second status store: if a page and this index disagree, fix the page first.

## Start here

| Document | Status | Read for |
| --- | --- | --- |
| [getting-started.md](getting-started.md) | Shipped | The guided first-use path: install, meet the kernel operator, choose a team, review a result. |
| [help.md](help.md) | Shipped | What to do when OpenRig itself is stuck, and how to reach the team. |
| [whats-new.md](whats-new.md) | Shipped (0.1.4 note) | What behaves differently after upgrading to the local 0.1.4 line, and what to do about it. |
| [non-interruptive-mode.md](non-interruptive-mode.md) | Shipped | The per-rig mode that keeps full-bypass seats from being interrupted. |
| [fork-and-upstream.md](fork-and-upstream.md) | Shipped | Provenance, version rules, and the read-only upstream inspection/backport policy for the `openrig-local` line. |

## Runtime, seats and resources

| Document | Status | Read for |
| --- | --- | --- |
| [dsh-execution-paths.md](dsh-execution-paths.md) | Shipped | Choosing the shared-web DSH shim or a headless DSH seat; the two paths' trade-offs. |
| [host-resources.md](host-resources.md) | Shipped | `rig ps --resources`: host load, transcript capture cost, and what is honestly `not_enforced`. |
| [seat-admission-and-task-budgets.md](seat-admission-and-task-budgets.md) | Shipped, default off | Launch admission, per-turn budgets and the queue; all caps default off. |
| [toolchain-and-provider-concurrency.md](toolchain-and-provider-concurrency.md) | Shipped, default off | Toolchain environment projection and per-provider seat-start limits. |
| [execution-backend-isolated.md](execution-backend-isolated.md) | **Proposal** | P2 `execution.backend=isolated` contract: config, shim, resume, credentials, cleanup. Not implemented. |
| [seat-load-isolation-and-resource-budgets-plan.md](seat-load-isolation-and-resource-budgets-plan.md) | **Proposal, partly shipped** | The umbrella P0–P4 plan. P0/P1 shipped in 0.7.0; P2 design, P3 cgroup and P4 remain open. |
| [stream-classifier-worker.md](stream-classifier-worker.md) | **Experimental** | Occupant-owned stream classification and shadow capture; off by default, no accuracy claim. |

## Specs, topology and workspace

| Document | Status | Read for |
| --- | --- | --- |
| [rig-spec.md](rig-spec.md) | Shipped | RigSpec fields: rigs, pods, seats, runtimes, permissions, resources. |
| [agent-spec.md](agent-spec.md) | Shipped | AgentSpec fields and the spec library formats. |
| [agent-startup-guide.md](agent-startup-guide.md) | Shipped | What a seat receives at startup and which runtime support is reliable. |
| [agent-state-taxonomy.md](agent-state-taxonomy.md) | Shipped | Activity, startup status and state vocabulary used by `rig ps` and the TUI. |
| [edge-types.md](edge-types.md) | Shipped | Allowed coordination edges between seats. |
| [rosters.md](rosters.md) | Shipped | Finding specialists with `rig roster list/show/find`. |
| [topology-naming.md](topology-naming.md) | Shipped | Naming rigs, pods and seats; where each name is used. |
| [project-workspace.md](project-workspace.md) | Shipped | The project workspace contract and work-install selection. |
| [chain-file-convention.md](chain-file-convention.md) | Shipped | The CE-v2 chain-file convention for authored work. |
| [instance-layout.md](instance-layout.md) | Shipped | Where the instance, rigs, seats, logs and state live on disk. |
| [project-release-profile.yaml](project-release-profile.yaml) | Shipped (config) | The release-profile schema used by project missions. |

## Operating, recovery and observation

| Document | Status | Read for |
| --- | --- | --- |
| [health-diagnosis.md](health-diagnosis.md) | Shipped | Agent-operated health diagnosis and the findings it may report. |
| [keeping-a-watch.md](keeping-a-watch.md) | Shipped | Keeping a watch for a person with today's queue commands and their limits. |
| [refocus-channel.md](refocus-channel.md) | Shipped | The refocus channel and work-packet pointers. |
| [scoped-operating-posture.md](scoped-operating-posture.md) | Shipped | Human-led vs delegated posture with `rig mode`, and what posture does not grant. |
| [inventory-request-diagnostics.md](inventory-request-diagnostics.md) | Shipped | Diagnosing inventory requests across seats and hosts. |
| [telemetry.md](telemetry.md) | Shipped | The finite telemetry metadata fields; no free-form payloads. |
| [run-archive-and-teardown-guard.md](run-archive-and-teardown-guard.md) | Shipped | Run archive manifests and the guarded teardown path. |
| [legacy-topology-migration.md](legacy-topology-migration.md) | Shipped | Migrating a pre-convention rig's topology context. |
| [security-notes.md](security-notes.md) | Shipped | Point-in-time host kernel and model-file cautions, plus the npm dependency floor this line enforces. |

## Workflow, product and knowledge

| Document | Status | Read for |
| --- | --- | --- |
| [sdlc-conventions.md](sdlc-conventions.md) | Shipped | The markdown control plane: mission, slice, progress, release conventions. |
| [product-journey-sdlc.md](product-journey-sdlc.md) | Shipped | Product-journey components and how they fit the SDLC. |
| [wave-sdlc.md](wave-sdlc.md) | Shipped | Parallel build, wave-level review and composition as the care dial. |
| [planning-dial.md](planning-dial.md) | Shipped | How much rigor a plan gets, chosen per piece. |
| [product-management-pass.md](product-management-pass.md) | Shipped | The pass above planning, before planners touch a mission. |
| [mission-install.md](mission-install.md) | Shipped | Composing a mission install: world, project, depth and pacing. |
| [knowledge-maturity.md](knowledge-maturity.md) | Shipped | Maturity labels (`wip` … `retired`) and how knowledge is promoted. |
| [lore-routing.md](lore-routing.md) | Shipped | Position knowledge by address, its privacy boundary and what it deliberately does not add. |

## Bundles, packaging and access

| Document | Status | Read for |
| --- | --- | --- |
| [rig-bundle.md](rig-bundle.md) | Shipped | RigBundle reference: formats, integrity, install and check. |
| [bundle-formats.md](bundle-formats.md) | Shipped | Frozen v1 bundle formats and their schemas. |
| [publishing-a-rig-bundle.md](publishing-a-rig-bundle.md) | Shipped | Publishing a rig bundle for others to install. |
| [worktree-builds.md](worktree-builds.md) | Shipped | Per-worktree install; never a symlinked `node_modules`. |
| [browser-access.md](browser-access.md) | Shipped | Allowed hosts and origins for the web UI and browser callers. |
| [slack-app-setup.md](slack-app-setup.md) | **Experimental** | Creating your own Slack app and its limited guarantees. |
| [claude-status-line.md](claude-status-line.md) | Shipped | The optional custom Claude Code status line. |

## Contributing and releases

| Document | Status | Read for |
| --- | --- | --- |
| [developing.md](developing.md) | Shipped | Build lanes, gates and the development workflow. |
| [release-boundary.md](release-boundary.md) | Shipped | Housekeeping run once per release fence. |
| `docs/releases/README.md` | Repository-only | The release-note archive, its coverage and its version anchor. Not in the installed copy. |
| `CHANGELOG.md` | Repository-only | Item-by-item record for every version. Not in the installed copy. |
| [schemas/](schemas/) | Shipped (data) | Machine-checked bundle and identity schemas plus fixtures. |

## Proposal tracker

Three pages are not fully implemented. Keep unfinished sections out of behavior
claims until their status changes in the same change that ships the code.

| Proposal | Scope | What would make it shipped |
| --- | --- | --- |
| [goal-and-decoupling.md](goal-and-decoupling.md) | Goal as a first-class object; in-daemon run-driver; evidence and approval objects; M1 acceptance A1–A12. | M1 code + tests, the goal-bound `project` gate, and a status banner change from proposal to implemented. |
| [execution-backend-isolated.md](execution-backend-isolated.md) | P2 `execution.backend=isolated` for DSH: shim, session/resume, credentials, orphan cleanup, UI observation. | P2.1–P2.4 code, a real headless DSH smoke, and the plan's P2 section reconciled. |
| [seat-load-isolation-and-resource-budgets-plan.md](seat-load-isolation-and-resource-budgets-plan.md) | P0–P4 resource isolation. P0/P1 shipped in 0.7.0; P2 is the proposal above; P3 (cgroup) and P4 remain open. | Ship or drop P3/P4. The banner now splits shipped P0/P1 from the open phases. |

**Documentation debt closed (2026-10-24):** the seat-isolation plan's banner used
to say "proposal, 未实现" after its P0/P1 work shipped in 0.7.0. The banner now
names the shipped phases and points at `whats-new.md` / `CHANGELOG.md` for released
behavior; this index's status row matches it.

## Release notes and the version anchor

- `package.json` (root and `packages/cli/package.json`) is the only
  machine-readable version. `rig --version` and the daemon read it; the packager
  stamps the built package from it.
- `CHANGELOG.md` is the item-by-item record for every version.
- `docs/releases/` holds the short note per version.

Both live outside the shipped reference tree, so they are named here rather than
linked; an installed copy only has the pages under this directory.
- **There is no `VERSION` file, and this repository does not add one.** A second
  checked-in version authority would drift from `package.json` exactly when a
  release is rushed. See
  the "Version anchor" section of `docs/releases/README.md`.

## Check the inventory

From the repository root, the Markdown pages in this directory are:

```bash
ls docs/reference/*.md | wc -l
```

The count includes this index. The tables above are expected to name every page in
the directory at least once (the proposal tracker repeats two of them on purpose);
`reports/check-doc-index.py` in the round that added this index asserts that
mechanically. `docs/reference/schemas/` and the YAML
profile are data, not pages.
