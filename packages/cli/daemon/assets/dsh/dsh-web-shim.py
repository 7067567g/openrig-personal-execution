#!/usr/bin/env python3
"""OpenRig DSH runtime shim backed by the running DSH Web instance.

Accepts the exact CLI shape OpenRig's CLI-agent runner uses:
  dsh --profile headless --json [--session-id <id>] <task text>
and emits the NDJSON events the runner understands:
  {"type":"session","sessionId":"session-..."}
  {"type":"status",...}
  {"type":"final","text":"..."}
"""
import json
import os
import sys
import time

HOME = os.path.expanduser("~")
BRIDGE = os.path.join(HOME, ".dsh", "clawbot-bridge", "bridge-fork")
sys.path.insert(0, BRIDGE)
os.environ.setdefault("DSH_HOME", os.path.join(HOME, ".dsh"))
os.environ.setdefault("DSH_WEB_PORT", "3080")

import dsh_ctl  # noqa: E402


def emit(obj):
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def parse_argv(argv):
    session_id = ""
    task_parts = []
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--profile":
            i += 2
            continue
        if a == "--json":
            i += 1
            continue
        if a == "--session-id":
            if i + 1 >= len(argv):
                raise SystemExit("missing --session-id value")
            session_id = argv[i + 1]
            i += 2
            continue
        if a in ("-h", "--help"):
            print(__doc__)
            raise SystemExit(0)
        task_parts.append(a)
        i += 1
    return session_id, " ".join(task_parts).strip()


def session_ok(sid, cwd, preset):
    try:
        info = dsh_ctl.find_session_by_id(sid)
    except Exception:
        return None
    if not info:
        return None
    if str(info.get("cwd") or "") != cwd:
        return None
    if str(info.get("agentPreset") or preset) != preset:
        return None
    return info


def ensure_session(cwd, preset):
    # 不登记工作区：DSH 侧栏的工作区是按目录登记的，每跑一个 run 就长出一个
    # 「runs/<name>」工作区，纯属噪音。座位会话仍以 run 目录为 cwd
    # （reports/ 这类相对路径语义不变），只是不挂进任何工作区。
    # 要浏览 run 的文件，用已登记的「deepseek-知识库」工作区即可。
    created = dsh_ctl.create_session(cwd=cwd, agent_preset=preset)
    sid = str((created or {}).get("sessionId") or "").strip()
    if not sid:
        raise RuntimeError(f"session/create 未返回 sessionId: {created!r}")
    return sid


def event_phase(event):
    typ = str((event or {}).get("type") or "")
    data = (event or {}).get("data") or {}
    if typ == "turn/start":
        return "开始处理"
    if typ == "step/start":
        return "推理处理"
    if typ == "assistant/message":
        return "生成回复"
    if typ == "tool/call":
        name = str(data.get("name") or data.get("tool") or "").strip()
        return f"工具调用 {name}" if name else "工具调用"
    if typ == "tool/result":
        return "工具返回"
    if typ == "command/run":
        return "执行命令"
    if typ == "command/done":
        return "命令完成"
    if typ == "turn/end":
        return "本轮结束"
    return typ or "处理中"


def extract_final(events):
    texts = []
    for e in events:
        if e.get("type") == "assistant/message":
            try:
                texts.extend(dsh_ctl._assistant_texts(e))
            except Exception:
                pass
    return (texts[-1] if texts else "").strip()


def main():
    session_id, task = parse_argv(sys.argv[1:])
    if not task:
        print("empty task", file=sys.stderr)
        return 2
    cwd = os.getcwd()
    preset = "standard"
    sid = session_id
    if sid and session_ok(sid, cwd, preset) is None:
        sid = ""
    if not sid:
        sid = ensure_session(cwd, preset)
    emit({"type": "session", "sessionId": sid})
    emit({"type": "status", "phase": "turn_start", "turn": 1})

    try:
        ok, state = dsh_ctl.wait_until_idle(sid, timeout=180)
        if not ok:
            raise RuntimeError("DSH session busy before prompt")
        start_seq = int(dsh_ctl.projections(sid).get("asOfSeq") or 0)
        accepted = dsh_ctl.prompt(sid, task, timeout=60)
        if not accepted:
            raise RuntimeError("session/prompt was not accepted")

        deadline = time.time() + float(os.environ.get("OPENRIG_DSH_REPLY_TIMEOUT", "1800"))
        seen_phases = set()
        last_emit = 0.0
        while time.time() < deadline:
            as_of = int(dsh_ctl.projections(sid).get("asOfSeq") or 0)
            if as_of > start_seq:
                events = dsh_ctl.page_events(sid, as_of)
                new = [e for e in events if int(e.get("seq", -1)) > start_seq]
                if new:
                    phase = event_phase(new[-1])
                    now = time.time()
                    if phase not in seen_phases or now - last_emit >= 1.5:
                        emit({"type": "status", "phase": "progress", "text": phase,
                              "event": str((new[-1] or {}).get("type") or "")})
                        seen_phases.add(phase)
                        last_emit = now
                    if any(e.get("type") == "turn/end" for e in new):
                        text = extract_final(new)
                        if not text:
                            # The final assistant message may sit just before the tail window.
                            older = dsh_ctl.page_events(sid, max(0, min(int(e.get("seq", as_of)) for e in new) - 1))
                            text = extract_final([e for e in older if int(e.get("seq", -1)) > start_seq])
                        emit({"type": "status", "phase": "turn_end", "turn": 1})
                        emit({"type": "final", "text": text})
                        return 0
            time.sleep(0.8)
        raise RuntimeError("等待 DSH 回复超时")
    except Exception as e:
        msg = str(e) or type(e).__name__
        emit({"type": "status", "phase": "turn_end", "turn": 1,
              "reason": {"kind": "error", "error": {"message": msg, "code": "OPENRIG_DSH_WEB_SHIM"}}})
        emit({"type": "final", "text": ""})
        print(msg, file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
