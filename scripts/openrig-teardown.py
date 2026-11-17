#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Guarded OpenRig teardown wrapper.

Hard rule: do not tear down an OpenRig runtime unless the archived run manifest
is strict-COMPLETE (or a historical gap is explicitly accepted by a recorded
main-session decision).

The wrapper is deliberately explicit:
  * default is a read-only preflight (`--execute` is required to run anything);
  * the teardown command is supplied by the operator and is argv-split, not
    evaluated as a shell string;
  * PARTIAL archives return rc=2 and never execute the teardown command;
  * required items marked notApplicable with runtime evidence are treated as n/a,
    not missing (for example sessionSnapshots on a run with no DSH runtime);
  * `--allow-incomplete` needs both `--decision D-xxx` and a matching row for the
    same run in `<archive-root>/ARCHIVE-DECISIONS.md` (A5: a bare `D-` prefix used
    to be enough, so an invented id could bypass the strict gate).

Examples:
  python3 scripts/openrig-teardown.py --run-id openrig-demo --json
  python3 scripts/openrig-teardown.py --run-id openrig-demo \
    --execute --teardown-cmd "rig down openrig-demo --json"
  python3 scripts/openrig-teardown.py --run-id <run> --allow-incomplete \
    --decision D-H03 --execute --teardown-cmd "rig down <rig> --json"

Archive root defaults to `$OPENRIG_ARCHIVE_ROOT` or `<project>/var/openrig-archive`.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shlex
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(
    os.environ.get("OPENRIG_PROJECT_ROOT", str(Path(__file__).resolve().parents[1]))
).expanduser().resolve()
DEFAULT_ARCHIVE_ROOT = Path(
    os.environ.get("OPENRIG_ARCHIVE_ROOT", str(PROJECT_ROOT / "var" / "openrig-archive"))
).expanduser().resolve()
REQUIRED_KEYS = (
    "runSnapshot",
    "sessionSnapshots",
    "transcriptCapture",
    "openrigState",
    "homeSnapshot",
)
DECISION_ID_RE = re.compile(r"D-[A-Za-z0-9][A-Za-z0-9-]*")
DECISION_LEDGER_NAME = "ARCHIVE-DECISIONS.md"


def find_recorded_decision(archive_root: Path, decision: str, run_id: str) -> str | None:
    """Return `<ledger>:<line>` when the ledger records this decision for this run.

    The ledger is intentionally markdown-shaped rather than a parser: a row is a
    record iff the same line contains the decision id and the run id as a
    standalone token. That is strict enough to stop an invented `D-999`, while
    staying readable for humans and requiring no schema migration.
    """
    ledger = archive_root / DECISION_LEDGER_NAME
    if not ledger.is_file():
        return None
    run_token = re.compile(rf"(?<![A-Za-z0-9_-]){re.escape(run_id)}(?![A-Za-z0-9_-])")
    for lineno, line in enumerate(ledger.read_text(encoding="utf-8").splitlines(), 1):
        if decision not in DECISION_ID_RE.findall(line):
            continue
        if run_token.search(line):
            return f"{ledger}:{lineno}"
    return None


def find_manifest(archive_root: Path, run_id: str) -> Path | None:
    matches = sorted(archive_root.glob(f"machines/*/runs/{run_id}/MANIFEST.json"))
    if len(matches) > 1:
        raise RuntimeError(
            f"duplicate manifests for run {run_id}: {[str(p) for p in matches]}"
        )
    return matches[0] if matches else None


def inspect_manifest(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    status = str(data.get("archiveStatus") or "MISSING")
    required = data.get("required") if isinstance(data.get("required"), dict) else {}
    not_applicable = data.get("notApplicable") if isinstance(data.get("notApplicable"), dict) else {}
    missing_required = [
        k for k in REQUIRED_KEYS
        if required.get(k) is not True and not_applicable.get(k) is not True
    ]
    files = data.get("files") if isinstance(data.get("files"), list) else []
    return {
        "path": str(path),
        "archiveStatus": status,
        "required": required,
        "notApplicable": not_applicable,
        "missingRequired": missing_required,
        "files": len(files),
        "complete": status == "COMPLETE" and not missing_required and bool(files),
        "runId": data.get("runId"),
        "missing": data.get("missing") or [],
    }


def emit(report: dict, as_json: bool) -> None:
    if as_json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return
    print(f"run={report['runId']} archiveStatus={report['archiveStatus']} complete={report['complete']}")
    print(f"manifest={report['manifestPath']}")
    if report.get("missingRequired"):
        print(f"missingRequired={','.join(report['missingRequired'])}", file=sys.stderr)
    if report.get("missing"):
        print(f"manifestMissing={','.join(map(str, report['missing']))}", file=sys.stderr)
    if report.get("executed") is not None:
        print(f"executed={report['executed']} rc={report.get('exitCode')}")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Guarded OpenRig teardown (archiveStatus=COMPLETE)")
    ap.add_argument("--run-id", required=True)
    ap.add_argument("--archive-root", default=str(DEFAULT_ARCHIVE_ROOT))
    ap.add_argument("--teardown-cmd", default="", help="command to run only after gate passes")
    ap.add_argument("--execute", action="store_true", help="actually run --teardown-cmd")
    ap.add_argument("--allow-incomplete", action="store_true")
    ap.add_argument("--decision", default="", help="D-xxx required for --allow-incomplete")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args(argv)

    archive_root = Path(args.archive_root).expanduser().resolve()
    report = {
        "runId": args.run_id,
        "archiveRoot": str(archive_root),
        "manifestPath": "",
        "archiveStatus": "MISSING",
        "complete": False,
        "missingRequired": [],
        "missing": [],
        "executed": None,
        "exitCode": None,
        "decision": args.decision or None,
    }
    try:
        manifest = find_manifest(archive_root, args.run_id)
    except RuntimeError as exc:
        report["error"] = str(exc)
        emit(report, args.json)
        return 1
    if manifest is None:
        report["error"] = "manifest not found"
        emit(report, args.json)
        return 1
    report.update(inspect_manifest(manifest))
    report["manifestPath"] = report.pop("path")

    if not report["complete"]:
        if not args.allow_incomplete:
            report["error"] = "archiveStatus is not strict COMPLETE; teardown denied"
            emit(report, args.json)
            return 2
        if not DECISION_ID_RE.fullmatch(args.decision):
            report["error"] = "--allow-incomplete requires a recorded --decision D-xxx"
            emit(report, args.json)
            return 2
        recorded = find_recorded_decision(archive_root, args.decision, args.run_id)
        if recorded is None:
            report["error"] = (
                f"decision {args.decision} is not recorded for run {args.run_id} "
                f"in {archive_root / DECISION_LEDGER_NAME}; refusing historical override"
            )
            emit(report, args.json)
            return 2
        report["decisionRecord"] = recorded
        report["historicalOverride"] = True

    if not args.execute:
        report["dryRun"] = True
        emit(report, args.json)
        return 0
    if not args.teardown_cmd.strip():
        report["error"] = "--execute requires --teardown-cmd"
        emit(report, args.json)
        return 2
    cmd = shlex.split(args.teardown_cmd)
    try:
        proc = subprocess.run(cmd, cwd=str(PROJECT_ROOT), text=True, capture_output=True)
    except FileNotFoundError as exc:
        report["error"] = f"teardown command not found: {exc}"
        emit(report, args.json)
        return 1
    report["executed"] = args.teardown_cmd
    report["exitCode"] = proc.returncode
    report["stdoutTail"] = (proc.stdout or "")[-2000:]
    report["stderrTail"] = (proc.stderr or "")[-2000:]
    emit(report, args.json)
    return proc.returncode


if __name__ == "__main__":
    raise SystemExit(main())
