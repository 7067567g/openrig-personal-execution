# Fork and upstream: the openrig-local line

> Status: **Shipped**. This page describes how this tree relates to upstream OpenRig, how its
> version line works, and how to inspect upstream without merging it. The machine-readable
> record is `/UPSTREAM-BASE`; when this page and that file disagree, `UPSTREAM-BASE` wins.

## What this tree is

This repository is **openrig-local**: a personal local fork of
[OpenRig](https://github.com/mvschwarz/openrig). It is a product in its own right, not a
downstream branch that merges upstream, and not a nightly mirror.

- Root package: `openrig-local`.
- Workspaces: `@openrig-local/cli`, `@openrig-local/daemon`, `@openrig-local/ui`,
  `@openrig-local/tui`.
- Command names are unchanged: `rig` and `openrig-tui`. Environment variables
  (`OPENRIG_HOME`, …), the state directory (`~/.openrig`), wire fields, runtime ids and plugin
  ids are unchanged too. The rename is a package identity change, not a product rename.
- The local version line is **0.1.x**. Upstream tags (`v0.6.11`, `v0.7.0`, …) never set this
  tree's version.

## Provenance

The authoritative values, with commit hashes and dates, live in `/UPSTREAM-BASE`. Summary:

| Fact | Value |
| --- | --- |
| Upstream repository | `https://github.com/mvschwarz/openrig` |
| Upstream baseline release | `v0.6.11` (`379f0a0d`) |
| Fork base commit | `eabc816e` (local root `1f83b4d` is approximately this commit) |
| Latest upstream release inspected | `v0.7.0` (`c99450f3`) |
| Upstream snapshot inspected | `cd107465`, 2026-10-24 |
| Local line started | 2026-10-24 at `0.1.0` |

The first sync pass compared `eabc816e..cd107465` (389 upstream commits, 161 after `v0.7.0`) and
selected a take list rather than merging. That analysis lives in the pipeline run reports
(`runs/openrig-r14-upstream-diff`, `runs/openrig-r15-sync-plan`, `runs/openrig-r17-filter`);
`/UPSTREAM-BASE` records only the commits that were actually applied.

## Policy

`UPSTREAM-BASE` carries the policy as machine-checked keys:

| Key | Value | Meaning |
| --- | --- | --- |
| `fork_model` | `independent-local-line` | This tree evolves on its own; it is not a mirror. |
| `upstream_role` | `read-only-reference` | Upstream is read for information. It is never merged, rebased onto, or pushed to from here. |
| `version_line_policy` | `local-semver-independent-of-upstream` | The local version is chosen here; upstream tags do not imply a local version. |
| `sync_cadence` | `on-demand-at-least-per-quarter;no-automatic-merge` | Inspect on demand, at least once a quarter and before a local minor cut. No automation merges anything. |
| `integration_model` | `manual-backport-of-selected-commits` | A human-selected commit is adapted, tested, and then appended to `taken_commit`. |

`taken_commit` is **append-only**. One line per upstream commit actually applied:

```text
taken_commit=<40-hex> <YYYY-MM-DD> <#PR|UNRELEASED> <short subject>
```

If a patch is applied and later reverted, do not delete the line; record the revert and the
reason in the same round's report and in `CHANGELOG.md`.

## Differences from upstream

The differences fall into three buckets. This is a map, not a complete diff; use
`git diff <fork-base> -- <path>` for bytes.

1. **Identity and packaging.** The `@openrig-local/*` scope, the `openrig-local` root package,
   the `0.1.x` version line, and the `rig --version` banner (`openrig-local <semver>`). The
   packaging step rewrites `@openrig-local/daemon/<subpath>` imports into the daemon copy
   shipped inside the CLI tarball.
2. **Backports taken from upstream.** Security and data-integrity fixes that were selected and
   adapted while the local tree stayed independent. The applied set is exactly the
   `taken_commit` lines; the current batch is the five 0.1.1 backports (Vault loopback bind,
   empty `OPENRIG_HOME`, bundle login-file refusal, atomic inbox promotion, queue work during
   seat removal).
3. **Local-only behavior and docs.** Behavior that upstream does not have is visible in a diff
   against the fork base, not in `taken_commit`. `taken_commit` answers "what did we take from
   upstream", never "what did we change locally".

Upstream work that was **not** taken is not a gap in this document. It is listed, with reasons,
in the r17 filter report and in the "not in this release" section of the relevant release note;
the dependency-missing items need subsystems this tree does not carry.

## Version rules

- The local line is semver-shaped starting at `0.1.0`.
- **Patch** (`0.1.x`): backport batches, identity/packaging changes, bug fixes that do not add a
  public contract.
- **Minor** (`0.x.0`): a local feature cut or a contract addition. Pre-1.0, a minor may still
  contain breaking changes, which must be marked **Breaking** in `CHANGELOG.md`.
- A version bump touches all five package files (`package.json`, `packages/{cli,daemon,ui,tui}/package.json`),
  `package-lock.json`, `UPSTREAM-BASE.local_line`, `CHANGELOG.md` and a
  `docs/releases/vX.Y.Z.md` note **in the same round**. `npm run test:repo` fails when
  `local_line` and the packages disagree.
- `rig --version` prints `openrig-local <semver>` (plus the build stamp when stamped).
  `CLI_VERSION` remains the bare semver for machine consumers such as the MCP `serverInfo`
  field and scripts that parse a version.

## How to inspect upstream (read-only)

The reference copy is a **read-only** sibling checkout of upstream OpenRig. In this workflow it
usually lives outside the project tree; set `UP` to that checkout's absolute path for the
commands below. Never edit, commit,
fetch into, or push from that checkout; if a network fetch is genuinely required, clone to a
throwaway directory instead.

Inspection is a git-read-only exercise:

```bash
UP=/path/to/openrig-upstream
git -C "$UP" log --oneline --decorate <old>..<new>
git -C "$UP" diff --stat <old>..<new>
git -C "$UP" show <commit> -- <path>
git -C "$UP" tag --list 'v0.*'
```

Produce a report before touching this tree. For each candidate commit, record:

1. What problem it fixes, in one sentence.
2. Whether this tree actually has that problem (`file:line` evidence or a reproduction).
3. Upstream commit range and the local adaptation needed.
4. The test that will prove the fix locally.
5. Risk and rollback point.

Then apply selected commits one at a time (or one coherent batch), each with its own test run,
and append the applied commits to `taken_commit`. A commit that conflicts beyond a small
adaptation is downgraded to "not suitable" rather than forced. Never resolve a conflict by
taking upstream's version of a local-only file wholesale.

The inventory itself is a **run report**, not a change to this tree. Only the selected backport
plus its `taken_commit` lines and release note belong in a commit.

## What this fork does not do

- No automatic merge, rebase, or submodule tracking of upstream.
- No upstream version inheritance and no upstream release-note rewriting. Historical
  `docs/releases/v0.*.md` notes and old `CHANGELOG.md` sections keep the names and versions they
  were written with.
- No push, tag, or `npm publish` from this pipeline. Publishing identity remains an owner
  decision; `UPSTREAM-BASE` only records lineage.
