# Release Notes

This directory is the lightweight release history for OpenRig.

It is intentionally simpler than a monolithic `CHANGELOG.md`.

Each shipped release gets its own note:

- `v0.1.12.md`
- `v0.2.0.md`
- `v0.3.0.md`
- and so on

## Coverage

Through 0.6.3, a release note was usually written while cutting the release. The
archive then missed 0.6.4–0.6.11; those eight notes were backfilled on 2026-10-24
from the matching `CHANGELOG.md` sections. A backfilled note says so in its own
header. It condenses what the changelog already recorded and does not claim a new
test run; the original GitHub release remains the verification and issue record for
that cut.

The archive now has a note for every version named in `CHANGELOG.md`, plus earlier
notes for 0.1.12 and 0.5.8–0.5.10. If a later release chooses not to write a separate
note, say that here in the same change rather than leaving a silent gap.

`v0.1.0.md` is the **local fork line's** first cut, not the upstream 0.1.0 and not
related to `v0.1.12.md`. The local line starts from the 0.7.0 pre-line tree and records
its upstream base in `/UPSTREAM-BASE`; see the note's header for the distinction.
`v0.1.2.md` is the package-identity cut (`@openrig-local/*`); the local line's rules and
the read-only upstream policy are in `docs/reference/fork-and-upstream.md`.
`v0.1.3.md` is the second backport batch (B1/B2/B4/D1); its `taken_commit` entries are in
`/UPSTREAM-BASE`.
`v0.1.4.md` is the dependency-security cut (`tar`/`hono` floors, the audit triage and the
shipped security notes); it adds no schema, command or configuration change.

## Why This Exists

We want a practical release-management pattern that works with how OpenRig is actually being shipped today:

- npm package release
- optional Git tag
- optional GitHub Release
- short, human-written summary of what is included

This keeps release notes:

- easy to author
- easy to link in GitHub Releases
- easy to paste into announcements
- durable in the repo

## Minimal Process

For each release:

1. Copy `_template.md` to `vX.Y.Z.md`.
2. Fill in the release summary, included changes, operator notes, known limitations, and verification performed.
3. Run the **substance gate** at the exact release cut. The gate derives every
   file under the shipped pack sources, verifies a hash-bound human judgment
   and an individual disposition for each mechanical candidate, scans the
   complete npm artifact set derived by the packager, and writes the durable
   receipt. The receipt records both artifact and scanned file lists; their
   artifact-minus-scanned diff must be empty. The review JSON carries one
   entry per file:

   ```json
   {
     "surfaces": [{
       "path": "packages/daemon/context-packs-src/example/guide.md",
       "sha256": "<sha256 of the reviewed bytes>",
       "verdict": "ship",
       "reason": "Generic product guidance.",
       "candidateDispositions": []
     }]
   }
   ```

   Assemble the package first, then run the named gate from the same clean
   worktree with the judge and cut SHA explicit. The assembly emits the
   substance roots it actually staged; the gate never carries its own root
   list. A non-shipping human verdict is one of `instance-fact`,
   `internal-path`, `position-knowledge`, or `lore-class` and carries its
   reason in the same per-file entry:

   ```bash
   bash scripts/build-package.sh
   npm run gate:substance -- \
     --review /path/to/substance-review.json \
     --receipt /path/to/substance-receipt.json \
     --judge <seat-or-person> \
     --cut-sha "$(git rev-parse HEAD)"
   ```

   A missing/stale judgment, an undispositioned candidate, internal substance,
   a lore-classed pack, a failed full artifact scan, or any artifact absent
   from the scanned set refuses the cut.
4. Create a git tag for the release:

   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

5. Create a GitHub Release using the same file:

   ```bash
   gh release create vX.Y.Z \
     --repo mvschwarz/openrig \
     --title "OpenRig vX.Y.Z" \
     --notes-file docs/releases/vX.Y.Z.md
   ```

6. Publish the npm package if that is part of the release flow.

## Guidance

- Prefer user-facing language over commit-log language.
- Group related fixes into a small number of bullets.
- Be explicit about operator-impacting changes: setup, permissions, startup state, restore, recovery, and environment notes.
- Keep internal refactors out unless they materially change user behavior or operator confidence.
- If verification was limited, say so directly.

## Version anchor

OpenRig has **no `VERSION` file**, and this archive does not add one.

`package.json` (root and `packages/cli/package.json`) is the only machine-readable
version; the CLI and daemon read it at build or runtime, and the packager stamps it.
`CHANGELOG.md` is the item-by-item record for every version. A file in this
directory is the short, human-written note for one version.

A second checked-in version file would be a second editable authority, and the two
would drift exactly when a release is hurried. If a build or release check needs a
single version later, read `package.json` through the existing CLI/package path
instead of adding a root `VERSION`.

## Scope

This directory is a release-note archive, not the full historical changelog.
`CHANGELOG.md` is the item-by-item source and covers every release, including the
ones whose notes here are short or backfilled.

If OpenRig later wants to generate these notes, generate them from `CHANGELOG.md`
rather than the other way around.
