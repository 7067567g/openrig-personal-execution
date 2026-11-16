# Run archive and guarded teardown

This note documents the local run-archive contract and the teardown guard added
for the workflow-group two-plane runs.

## Archive

`scripts/openrig-archive.py` writes a strict archive when all required pieces
are present:

- run snapshot
- related DSH session snapshot(s)
- transcript capture or raw transcripts
- OpenRig state / bridge / rig / workflow config
- `OPENRIG_HOME` snapshot

The resulting `MANIFEST.json` carries `archiveStatus: COMPLETE | PARTIAL`.
Historical gaps may be archived with `--allow-incomplete`, but that is not a
substitute for a strict COMPLETE sample.

Strictness details (2026-10-24 repair round):

- the archive root must not be the run dir or a descendant of it; the guard
  refuses with `rc=2` before creating any directory;
- an `OPENRIG_HOME` that exists but contains no files is not a live-home
  snapshot (`required.homeSnapshot=false`);
- every `.sqlite` found in the home must pass the online-backup step. One failed
  backup invalidates the whole home snapshot instead of leaving
  `required.homeSnapshot=true` next to an unusable DB;
- session snapshots are part of the integrity manifest. Their files appear in
  `MANIFEST.files` with `"scope": "session"` and in `SHA256SUMS` as paths
  relative to the run archive (for example
  `../../sessions/<session-id>/events.jsonl`), so `sha256sum -c SHA256SUMS`
  run from the run archive covers them too.

## Teardown guard

`scripts/openrig-teardown.py` is the guarded wrapper for teardown commands:

```bash
# Read-only preflight; never runs a teardown command.
python3 scripts/openrig-teardown.py --run-id <run-id>

# Run the teardown command only after strict COMPLETE validation.
python3 scripts/openrig-teardown.py --run-id <run-id> --execute \
  --teardown-cmd "rig down <rig-name> --json"

# Historical exception: requires a decision recorded in ARCHIVE-DECISIONS.md
# for this exact run (the ledger row must contain both ids).
python3 scripts/openrig-teardown.py --run-id <run-id> --execute \
  --allow-incomplete --decision D-H01 \
  --teardown-cmd "rig down <rig-name> --json"
```

`ARCHIVE-DECISIONS.md` lives at the archive root. A row is a record when the
same line contains the decision id and the run id as a standalone token, e.g.:

```markdown
| D-H01 | openrig-audit-fix-20261020 | PARTIAL | homeSnapshot accepted (historical gap) |
```

The run's own `DECISIONS.md` is not consulted by the teardown wrapper; the
archive ledger is the evidence surface at teardown time.

Refusal behavior:

- missing manifest: `rc=1`, command not executed;
- `PARTIAL` / non-COMPLETE: `rc=2`, command not executed;
- `--allow-incomplete` without a well-formed `--decision D-xxx`: `rc=2`, command
  not executed;
- `--allow-incomplete` with a decision that is not recorded for this run in
  `ARCHIVE-DECISIONS.md`: `rc=2`, command not executed;
- `--execute` without `--teardown-cmd`: `rc=2`.

Behavior change (narrowing, **BREAKING** for callers that relied on the old
loophole): before this repair any string starting with `D-` was accepted, so
`--allow-incomplete --decision D-999` could bypass a PARTIAL archive. Now the
ledger entry is required. Existing historical exceptions remain usable after
the ids in `ARCHIVE-DECISIONS.md` are cited.

The guard is an application-level workflow gate, not an OS sandbox. It only
protects teardown calls that actually go through this wrapper.
