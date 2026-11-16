#!/usr/bin/env python3
"""Archive one OpenRig run into the OpenRig project-local archive.

Default archive root:
    <openrig-project>/var/openrig-archive/

The archive is intentionally self-describing:
  machines/<machine>/runs/<run-id>/MANIFEST.json
  machines/<machine>/runs/<run-id>/RECORD.md
  machines/<machine>/runs/<run-id>/run/       # copy of workflow-group/runs/<run-id>
  machines/<machine>/runs/<run-id>/home/      # redacted/filtered live OPENRIG_HOME snapshot
  machines/<machine>/sessions/<session-id>/   # related DSH session snapshot

Strict mode (default) requires: run snapshot, at least one related DSH session,
a successful transcript capture (or captured transcripts), OpenRig state/config,
and a non-empty OPENRIG_HOME snapshot whose SQLite online backups all succeed.
Session snapshot files are hashed into MANIFEST.files/SHA256SUMS (scope=session).
Use --allow-incomplete only for historical runs whose live home no longer exists;
the archive will still be written and RECORD.md will list the gaps.

Path mode (no run snapshot):
  python3 scripts/openrig-archive.py --print-paths
  python3 scripts/openrig-archive.py --ensure
  python3 scripts/openrig-archive.py --print-paths --json

Environment overrides:
  OPENRIG_PROJECT_ROOT   project root; default: parent of this script
  OPENRIG_ARCHIVE_ROOT   archive root; relative values resolve from project root
  OPENRIG_MACHINE_ID     machine id; default: sanitized hostname-user
"""

from __future__ import annotations

import argparse
import getpass
import hashlib
import json
import os
import re
import shutil
import socket
import sqlite3
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

SCHEMA_VERSION = 1
PROJECT_ROOT = Path(
    os.environ.get("OPENRIG_PROJECT_ROOT", str(Path(__file__).resolve().parents[1]))
).expanduser().resolve()
DEFAULT_ARCHIVE_ROOT = PROJECT_ROOT / "var" / "openrig-archive"
DEFAULT_SESSION_ROOT = Path.home() / ".dsh" / "sessions"

RUN_EXCLUDES = [".git/", "node_modules/", "__pycache__/", ".pytest_cache/", ".venv/", ".venvs/"]
SESSION_EXCLUDES = [".lock", "*.lock"]
HOME_EXCLUDES = [
    "*.sock", "*.pid", "*token*", "*credential*", "*.key", "*.pem", ".env", ".env.*",
    "*.sqlite-wal", "*.sqlite-shm", "*.sqlite-journal",
]
HOME_SAFE_FILES = [
    "daemon.json",
    "terminal-views.yaml",
    "file-edit-audit.jsonl",
    "bundle-audit.jsonl",
]
HOME_SAFE_DIRS = ["transcripts", "state", "topology", "compaction", "context"]
SECRET_PATTERNS = [
    ("openai-key", re.compile(r"sk-[A-Za-z0-9_-]{20,}")),
    ("openai-env", re.compile(r"OPENAI_API_KEY\s*=\s*\S+")),
    ("bearer", re.compile(r"Authorization:\s*Bearer\s+\S+", re.I)),
    ("password", re.compile(r"(?:PASSWORD|SECRET|TOKEN)\s*=\s*\S+", re.I)),
]


def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def ts_name() -> str:
    return datetime.now().strftime("%Y%m%d-%H%M%S")


def machine_name(explicit: str | None = None) -> str:
    raw = explicit or os.environ.get("OPENRIG_MACHINE_ID") or f"{socket.gethostname()}-{getpass.getuser()}"
    return re.sub(r"[^A-Za-z0-9._-]+", "-", raw).strip("-") or "unknown-host"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def copy_tree(src: Path, dst: Path, excludes: list[str] | None = None) -> None:
    dst.mkdir(parents=True, exist_ok=True)
    cmd = ["rsync", "-aHAX", "--delete"]
    for pat in excludes or []:
        cmd += ["--exclude", pat]
    cmd += [f"{src}/", f"{dst}/"]
    proc = subprocess.run(cmd, text=True, capture_output=True)
    if proc.returncode != 0:
        raise RuntimeError(f"rsync failed ({proc.returncode}) {src} -> {dst}: {proc.stderr.strip()}")


def copy_file(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


def snapshot_sqlite(src: Path, dst: Path) -> dict:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        dst.unlink()
    src_conn = dst_conn = None
    try:
        src_conn = sqlite3.connect(f"file:{src}?mode=ro", uri=True)
        dst_conn = sqlite3.connect(dst)
        src_conn.backup(dst_conn)
        return {"source": str(src), "archive": str(dst), "ok": True, "bytes": dst.stat().st_size, "sha256": sha256_file(dst)}
    except Exception as exc:
        # A half-written destination is worse than no destination: it would be hashed
        # and listed as archived even though the backup failed.
        try:
            if dst.exists():
                dst.unlink()
        except OSError:
            pass
        return {"source": str(src), "archive": str(dst), "ok": False, "error": str(exc)}
    finally:
        if dst_conn is not None:
            dst_conn.close()
        if src_conn is not None:
            src_conn.close()


def find_sessions(session_ids: list[str], session_root: Path) -> dict[str, Path]:
    found: dict[str, Path] = {}
    for sid in session_ids:
        matches = sorted(session_root.glob(f"*/{sid}"))
        if matches:
            found[sid] = matches[0]
    return found


def copy_session(session_id: str, source: Path, sessions_root: Path, run_id: str) -> Path:
    dst = sessions_root / session_id
    note_path = dst / "SESSION-SOURCE.json"
    old_note = None
    if note_path.exists():
        try:
            old_note = json.loads(note_path.read_text(encoding="utf-8"))
        except Exception:
            old_note = None
    copy_tree(source, dst, SESSION_EXCLUDES)
    note = {
        "sessionId": session_id,
        "source": str(source),
        "copiedAt": now_iso(),
        "runs": [run_id],
    }
    if isinstance(old_note, dict):
        runs = old_note.get("runs") if isinstance(old_note.get("runs"), list) else []
        note["runs"] = sorted(set([*runs, run_id]))
        note["copiedAt"] = old_note.get("copiedAt") or note["copiedAt"]
    note_path.write_text(json.dumps(note, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return dst


def scan_secrets(root: Path) -> list[dict]:
    hits: list[dict] = []
    for path in sorted(p for p in root.rglob("*") if p.is_file()):
        if path.suffix.lower() in {".sqlite", ".db", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".zst", ".zstd"}:
            continue
        try:
            with path.open("r", encoding="utf-8", errors="ignore") as fh:
                for lineno, line in enumerate(fh, 1):
                    for kind, pattern in SECRET_PATTERNS:
                        if pattern.search(line):
                            hits.append({"file": str(path.relative_to(root)), "line": lineno, "kind": kind})
                            break
        except OSError:
            continue
    return hits


def copy_home(home: Path, dst: Path) -> dict:
    result = {
        "source": str(home),
        "ok": False,
        "copied": [],
        "sqlite": [],
        "skipped": [],
        "secretHits": [],
    }
    if not home.is_dir():
        result["error"] = "OPENRIG_HOME is not a directory"
        return result
    dst.mkdir(parents=True, exist_ok=True)

    # SQLite: use the online backup API, never a raw cp of a live DB.
    for db in sorted(home.glob("*.sqlite*")):
        if db.name.endswith(("-wal", "-shm", "-journal")):
            continue
        snap = snapshot_sqlite(db, dst / db.name)
        result["sqlite"].append(snap)
        if snap.get("ok"):
            result["copied"].append(db.name)

    for name in HOME_SAFE_FILES:
        src = home / name
        if src.is_file():
            copy_file(src, dst / name)
            result["copied"].append(name)

    for name in HOME_SAFE_DIRS:
        src = home / name
        if src.is_dir():
            copy_tree(src, dst / name, HOME_EXCLUDES)
            result["copied"].append(name + "/")

    for src in sorted(home.glob("*.log")):
        if src.is_file():
            copy_file(src, dst / src.name)
            result["copied"].append(src.name)

    result["secretHits"] = scan_secrets(dst)
    sqlite_failed = [s for s in result["sqlite"] if not s.get("ok")]
    result["fileCount"] = sum(1 for p in dst.rglob("*") if p.is_file())
    if result["secretHits"]:
        rejected = dst.with_name(dst.name + ".rejected-" + ts_name())
        os.replace(dst, rejected)
        shutil.rmtree(rejected, ignore_errors=True)
        result["ok"] = False
        result["error"] = "secret scan hit; home snapshot removed from archive"
    elif sqlite_failed:
        # A home whose database could not be backed up is not restorable. Counting it
        # as homeSnapshot=true is how a COMPLETE archive could carry an unusable DB.
        names = ", ".join(Path(s["source"]).name for s in sqlite_failed)
        result["ok"] = False
        result["error"] = f"sqlite snapshot failed: {names}"
    elif result["fileCount"] == 0:
        # An existing but empty OPENRIG_HOME (or one containing only empty dirs) is a
        # historical gap, not a live-home snapshot.
        result["ok"] = False
        result["error"] = "home snapshot is empty; refusing to count it as a live home"
    else:
        result["ok"] = True
    return result


def bridge_capture(run_dir: Path, home: Path | None, bridge_tool: Path | None) -> dict:
    result = {"attempted": False, "ok": False, "rc": None, "stdout": "", "stderr": ""}
    if not home:
        return result
    bridge_json = run_dir / "openrig" / "OPENRIG-BRIDGE.json"
    if not bridge_json.is_file() or not bridge_tool or not bridge_tool.is_file():
        return result
    src = home / "transcripts"
    if not src.is_dir():
        return result
    result["attempted"] = True
    cmd = [sys.executable, str(bridge_tool), "capture", "--run-dir", str(run_dir), "--source", str(src)]
    proc = subprocess.run(cmd, text=True, capture_output=True)
    result.update({"rc": proc.returncode, "ok": proc.returncode == 0, "stdout": proc.stdout[-4000:], "stderr": proc.stderr[-4000:]})
    return result


def capture_manifests(run_archive: Path) -> list[dict]:
    manifests = []
    for p in sorted(run_archive.rglob("capture-manifest.json")):
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        manifests.append({
            "path": str(p.relative_to(run_archive)),
            "ok": bool(data.get("ok")),
            "files": len(data.get("files") or []),
            "bytes": sum(int(f.get("bytes", 0)) for f in (data.get("files") or [])),
            "scanOk": bool((data.get("scan") or {}).get("ok")),
        })
    return manifests


def has_raw_transcripts(run_archive: Path, home_archive: Path | None) -> bool:
    if home_archive and home_archive.is_dir():
        if any(p.is_file() for p in (home_archive / "transcripts").rglob("*")):
            return True
    for p in run_archive.rglob("*transcript*"):
        if p.is_file():
            return True
    return False


def write_sha256sums(root: Path, extra_rows: list[dict] | None = None) -> Path:
    out = root / "SHA256SUMS"
    lines = []
    for p in sorted(x for x in root.rglob("*") if x.is_file()):
        if p.name in {"MANIFEST.json", "SHA256SUMS"}:
            continue
        lines.append(f"{sha256_file(p)}  {p.relative_to(root)}")
    # Session snapshots live under machines/<machine>/sessions/, outside the run
    # archive. Their rows are already relative to the run archive, so `sha256sum -c`
    # from the run directory resolves them through ../../sessions/.
    for row in extra_rows or []:
        lines.append(f"{row['sha256']}  {row['path']}")
    out.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")
    return out


def hash_tree(root: Path, base: Path, scope: str) -> list[dict]:
    rows = []
    for p in sorted(x for x in root.rglob("*") if x.is_file()):
        rows.append(
            {
                "path": Path(os.path.relpath(p, base)).as_posix(),
                "bytes": p.stat().st_size,
                "sha256": sha256_file(p),
                "scope": scope,
            }
        )
    return rows


def all_files_with_hashes(root: Path) -> list[dict]:
    rows = []
    for p in sorted(x for x in root.rglob("*") if x.is_file()):
        if p.name in {"MANIFEST.json", "SHA256SUMS"}:
            continue
        rows.append(
            {
                "path": str(p.relative_to(root)),
                "bytes": p.stat().st_size,
                "sha256": sha256_file(p),
                "scope": "run",
            }
        )
    return rows


def write_index(archive_root: Path) -> None:
    rows = []
    for manifest_path in sorted(archive_root.glob("machines/*/runs/*/MANIFEST.json")):
        try:
            m = json.loads(manifest_path.read_text(encoding="utf-8"))
        except Exception:
            continue
        rows.append(m)
    rows.sort(key=lambda m: (m.get("machine", ""), m.get("archivedAt", ""), m.get("runId", "")), reverse=True)
    lines = [
        "# OpenRig run archive index",
        "",
        f"> Generated: {now_iso()}",
        "> Default archive root: `10-openrig-deepseek/var/openrig-archive/`.",
        "",
        "| status | machine | run | archived | sessions | transcripts | home |",
        "|---|---|---|---|---:|---|---|",
    ]
    for m in rows:
        req = m.get("required") or {}
        lines.append(
            "| {status} | {machine} | `{run}` | {ts} | {sessions} | {transcripts} | {home} |".format(
                status=m.get("archiveStatus", "?"),
                machine=m.get("machine", "?"),
                run=m.get("runId", "?"),
                ts=m.get("archivedAt", "?"),
                sessions=(m.get("counts") or {}).get("sessions", 0),
                transcripts="yes" if req.get("transcriptCapture") else "no",
                home="yes" if req.get("homeSnapshot") else "no",
            )
        )
    if not rows:
        lines.append("| — | — | — | — | 0 | no | no |")
    (archive_root / "index.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_sessions_index(archive_root: Path) -> None:
    rows = []
    for note_path in sorted(archive_root.glob("machines/*/sessions/*/SESSION-SOURCE.json")):
        try:
            n = json.loads(note_path.read_text(encoding="utf-8"))
        except Exception:
            continue
        rows.append(n)
    rows.sort(key=lambda n: n.get("copiedAt", ""), reverse=True)
    lines = [
        "# OpenRig related DSH sessions",
        "",
        f"> Generated: {now_iso()}",
        "",
        "| session | copied | related runs | source |",
        "|---|---|---|---|",
    ]
    for n in rows:
        lines.append(
            f"| `{n.get('sessionId')}` | {n.get('copiedAt', '?')} | "
            f"{', '.join('`' + str(x) + '`' for x in n.get('runs', []))} | `{n.get('source', '?')}` |"
        )
    (archive_root / "sessions-index.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def archive_paths(archive_root: Path, machine: str) -> dict[str, str | None]:
    machine_root = archive_root / "machines" / machine
    try:
        archive_rel = archive_root.relative_to(PROJECT_ROOT).as_posix()
    except ValueError:
        archive_rel = None
    return {
        "projectRoot": str(PROJECT_ROOT),
        "archiveRoot": str(archive_root),
        "archiveRootRelative": archive_rel,
        "machineId": machine,
        "machineRoot": str(machine_root),
        "runsRoot": str(machine_root / "runs"),
        "sessionsRoot": str(machine_root / "sessions"),
    }


def print_archive_paths(paths: dict[str, str | None], as_json: bool) -> None:
    if as_json:
        print(json.dumps(paths, ensure_ascii=False, indent=2))
        return
    for key in (
        "projectRoot",
        "archiveRoot",
        "archiveRootRelative",
        "machineId",
        "machineRoot",
        "runsRoot",
        "sessionsRoot",
    ):
        print(f"{key}: {paths[key]}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--run-dir", help="workflow-group/runs/<run-id>; omit for path mode")
    ap.add_argument("--openrig-home", help="live OPENRIG_HOME to snapshot before teardown")
    ap.add_argument("--session-id", action="append", default=[], help="related DSH session id; repeatable")
    ap.add_argument("--session-root", default=str(DEFAULT_SESSION_ROOT), help="DSH sessions root")
    ap.add_argument("--archive-root", help="project-local archive root (default: OPENRIG_ARCHIVE_ROOT or var/openrig-archive)")
    ap.add_argument("--machine", help="machine label (default: OPENRIG_MACHINE_ID or sanitized hostname)")
    ap.add_argument("--bridge-tool", help="path to openrig_bridge.py; auto-detected for workflow-group runs")
    ap.add_argument("--allow-incomplete", action="store_true", help="historical archive: keep partial snapshot and rc=0")
    ap.add_argument("--force", action="store_true", help="replace an existing run archive directory")
    ap.add_argument("--print-paths", action="store_true", help="print resolved paths without creating or archiving")
    ap.add_argument("--ensure", action="store_true", help="create the resolved archive directories")
    ap.add_argument("--json", action="store_true", help="with path mode, print JSON")
    args = ap.parse_args()

    raw_archive = args.archive_root or os.environ.get("OPENRIG_ARCHIVE_ROOT") or str(DEFAULT_ARCHIVE_ROOT)
    archive_root = Path(raw_archive).expanduser()
    if not archive_root.is_absolute():
        archive_root = PROJECT_ROOT / archive_root
    archive_root = archive_root.resolve()
    machine = machine_name(args.machine)
    paths = archive_paths(archive_root, machine)

    if args.ensure:
        for key in ("archiveRoot", "machineRoot", "runsRoot", "sessionsRoot"):
            Path(str(paths[key])).mkdir(parents=True, exist_ok=True)
    if args.print_paths or args.ensure or not args.run_dir:
        print_archive_paths(paths, args.json)
        return 0

    run_dir = Path(args.run_dir).expanduser().resolve()
    if not run_dir.is_dir():
        print(f"run dir missing: {run_dir}", file=sys.stderr)
        return 2
    # Reject a run that would be copied into itself. `archive_root in run_dir.parents`
    # was backwards: it rejected legitimate ancestor roots and allowed the dangerous
    # descendant (run/var/archive), where rsync copies staging into its own source.
    if archive_root == run_dir or run_dir in archive_root.parents:
        print("refusing to archive a run into a directory inside itself", file=sys.stderr)
        return 2
    run_id = run_dir.name
    run_archive = Path(str(paths["machineRoot"])) / "runs" / run_id
    sessions_root = Path(str(paths["sessionsRoot"]))
    if run_archive.exists() and not args.force:
        print(f"archive exists: {run_archive} (use --force to refresh)", file=sys.stderr)
        return 2
    archive_root.mkdir(parents=True, exist_ok=True)
    sessions_root.mkdir(parents=True, exist_ok=True)

    home = Path(args.openrig_home).expanduser().resolve() if args.openrig_home else None
    bridge_tool = Path(args.bridge_tool).expanduser().resolve() if args.bridge_tool else None
    if bridge_tool is None:
        candidate = run_dir.parent.parent / "templates" / "specialized" / "openrig-workflow-master" / "tools" / "openrig_bridge.py"
        if candidate.is_file():
            bridge_tool = candidate

    # A live home may still be changing; capture transcripts into run evidence first.
    capture_result = bridge_capture(run_dir, home, bridge_tool)

    staging = run_archive.with_name(f".{run_id}.staging-{ts_name()}")
    if staging.exists():
        shutil.rmtree(staging)
    staging.mkdir(parents=True)
    try:
        copy_tree(run_dir, staging / "run", RUN_EXCLUDES)
        home_result = copy_home(home, staging / "home") if home else {
            "source": None, "ok": False, "copied": [], "sqlite": [], "secretHits": [],
            "error": "no --openrig-home supplied",
        }
        session_results = []
        sessions_found = find_sessions(args.session_id, Path(args.session_root).expanduser())
        for sid in args.session_id:
            src = sessions_found.get(sid)
            if src is None:
                session_results.append({"id": sid, "ok": False, "error": "session not found"})
                continue
            dst = copy_session(sid, src, sessions_root, run_id)
            session_results.append({"id": sid, "ok": True, "source": str(src), "archive": str(dst)})
    except Exception:
        shutil.rmtree(staging, ignore_errors=True)
        raise

    # Session snapshots are written outside the run staging tree (machine-wide
    # sessions/<id>/). Hash them here, relative to the final run archive, so
    # MANIFEST.files and SHA256SUMS cover them too (A4).
    session_files: list[dict] = []
    for session in session_results:
        if session.get("ok"):
            session_files.extend(hash_tree(Path(session["archive"]), run_archive, "session"))

    transcript_manifests = capture_manifests(staging / "run")
    transcript_ok = any(m["ok"] and m["files"] > 0 for m in transcript_manifests) or has_raw_transcripts(staging / "run", staging / "home")
    run_ok = any(p.is_file() for p in (staging / "run").rglob("*"))
    session_ok = bool(args.session_id) and all(s.get("ok") for s in session_results)
    state_ok = any((staging / "run" / name).is_file() for name in ["OPENRIG-STATE.json"]) or any(
        (staging / "run" / name).is_file() for name in ["openrig/OPENRIG-BRIDGE.json", "openrig/rig.yaml", "openrig/workflow.yaml"]
    )
    home_ok = home_result.get("ok", False)
    required = {
        "runSnapshot": run_ok,
        "sessionSnapshots": session_ok,
        "transcriptCapture": transcript_ok,
        "openrigState": state_ok,
        "homeSnapshot": home_ok,
    }
    missing = [k for k, v in required.items() if not v]
    archive_status = "COMPLETE" if all(required.values()) else "PARTIAL"

    record = [
        f"# OpenRig run archive — {run_id}",
        "",
        f"- Archived at: {now_iso()}",
        f"- Archive status: **{archive_status}**",
        f"- Machine: `{machine}`",
        f"- Source run: `{run_dir}`",
        f"- Source OPENRIG_HOME: `{home or 'not supplied / already cleaned'}`",
        f"- Archive root: `{archive_root}`",
        "",
        "## Mandatory retention checklist",
        "",
        f"- [{'x' if run_ok else ' '}] run snapshot",
        f"- [{'x' if session_ok else ' '}] related DSH sessions ({len(args.session_id)} requested, {sum(1 for s in session_results if s.get('ok'))} copied)",
        f"- [{'x' if transcript_ok else ' '}] transcript capture / raw transcripts",
        f"- [{'x' if state_ok else ' '}] OpenRig state or bridge/config",
        f"- [{'x' if home_ok else ' '}] live OPENRIG_HOME snapshot",
        "",
    ]
    if missing:
        record += [f"- Missing: `{x}`" for x in missing] + [""]
    record += ["## Related sessions", ""]
    if session_results:
        for s in session_results:
            record.append(f"- `{s['id']}` — {'copied' if s.get('ok') else 'MISSING'}")
    else:
        record.append("- (none listed)")
    record += ["", "## Transcript capture", ""]
    if transcript_manifests:
        for m in transcript_manifests:
            record.append(f"- `{m['path']}` — ok={m['ok']} files={m['files']} bytes={m['bytes']} scanOk={m['scanOk']}")
    else:
        record.append("- (no capture-manifest.json found)")
    record += ["", "## OPENRIG_HOME snapshot", ""]
    if home:
        record.append(f"- copy ok: {home_result.get('ok')} / copied: {', '.join(home_result.get('copied') or []) or '(none)'}")
        if home_result.get("sqlite"):
            for s in home_result["sqlite"]:
                record.append(f"- sqlite `{s.get('source')}` -> ok={s.get('ok')}")
        if home_result.get("error"):
            record.append(f"- error: {home_result['error']}")
    else:
        record.append("- no live home supplied; historical gap recorded")
    record += [
        "",
        "## Restore",
        "",
        f"- Run control-plane files: copy `{run_archive}/run/` back to `{run_dir.parent}/` as `{run_id}`.",
        "- Related DSH sessions: copy from `../../sessions/<session-id>/` into the target machine's `~/.dsh/sessions/<workspace-key>/`.",
        "- Do not restore `openrig.sqlite` while a daemon is running; restore the DB before daemon start.",
        "",
    ]
    (staging / "RECORD.md").write_text("\n".join(record) + "\n", encoding="utf-8")

    manifest = {
        "schemaVersion": SCHEMA_VERSION,
        "archiveStatus": archive_status,
        "archivedAt": now_iso(),
        "machine": machine,
        "runId": run_id,
        "sources": {
            "runDir": str(run_dir),
            "openrigHome": str(home) if home else None,
            "sessionRoot": str(Path(args.session_root).expanduser()),
            "bridgeTool": str(bridge_tool) if bridge_tool else None,
        },
        "required": required,
        "missing": missing,
        "sessions": session_results,
        "transcriptCapture": {
            "bridgeAttempt": capture_result,
            "manifests": transcript_manifests,
        },
        "openrigHome": home_result,
        "counts": {
            "sessions": sum(1 for s in session_results if s.get("ok")),
            "transcriptManifests": len(transcript_manifests),
            "runFiles": sum(1 for p in (staging / "run").rglob("*") if p.is_file()),
            "sessionFiles": len(session_files),
        },
    }
    (staging / "MANIFEST.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_sha256sums(staging, session_files)
    manifest["files"] = all_files_with_hashes(staging) + session_files
    manifest["counts"]["bytes"] = sum(f["bytes"] for f in manifest["files"])
    (staging / "MANIFEST.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if run_archive.exists():
        old = run_archive.with_name(f".{run_id}.old-{ts_name()}")
        os.replace(run_archive, old)
        os.replace(staging, run_archive)
        shutil.rmtree(old, ignore_errors=True)
    else:
        os.replace(staging, run_archive)

    write_index(archive_root)
    write_sessions_index(archive_root)
    print(f"archived {run_id} -> {run_archive}")
    print(f"status={archive_status} missing={','.join(missing) or 'none'} sessions={manifest['counts']['sessions']}")
    if archive_status != "COMPLETE" and not args.allow_incomplete:
        print("strict archive gate failed; rerun with a complete home/capture/session set or --allow-incomplete for a historical gap", file=sys.stderr)
        return 3
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
