# opencode-dsh starter rig

Minimal OpenRig rig for the two runtimes this fork treats as first-class:

| Member | Runtime | Role | Transport |
| --- | --- | --- | --- |
| `control-main` | `opencode` | main | CLI runner in tmux |
| `control-pmo` | `opencode` | PMO | CLI runner in tmux |
| `exec-tdo-oc` | `opencode` | TDO | CLI runner in tmux |
| `exec-tdo-dsh` | `dsh` | TDO | CLI runner in tmux |
| `assurance-qa` | `opencode` | QA | CLI runner in tmux |

## Launch

From the owned OpenRig checkout:

```bash
export OPENRIG_OPENCODE_BIN=/home/dev/.nvm/versions/node/v24.18.0/bin/opencode
export OPENRIG_DSH_BIN=/home/dev/.nvm/versions/node/v24.18.0/bin/dsh
export OPENRIG_OPENCODE_MODEL=opencode-go/deepseek-v4.1-flash
export OPENRIG_DSH_PROFILE=headless

rig up packages/daemon/specs/rigs/focused/opencode-dsh/rig.yaml \
  --cwd /path/to/your/project \
  --non-interruptive --yes
```

## Runtime contract

Both runtimes use the same pane-hosted runner:

```text
packages/daemon/src/adapters/cli-agent/cli-agent-runner.ts
```

- **OpenCode** child command: `opencode run --format json [--session ses_…] <task>`
- **DSH** child command: `dsh --profile headless --json [--session-id session-…] <task>`
- The runner sidecar is `<OPENRIG_HOME>/state/<runtime>/<session>/runner-state.json`.
- The sidecar records `ready`, `launchId`, `sessionId`, `lastResultText`, and `lastError`.
- Subsequent `rig send` messages reuse the runtime-native session id in the same runner process.
- Startup prose is merged into `AGENTS.md`; it is never written to stdin, so a launch does not consume model tokens.

### Shared-web vs headless

The `OPENRIG_DSH_BIN` above selects the headless path. To drive a running DSH Web instance
instead, point the same variable at the shipped shim:

```bash
export OPENRIG_DSH_BIN="$PWD/packages/daemon/assets/dsh/dsh-web-shim.py"
```

The packaged location is `<cli>/daemon/assets/dsh/dsh-web-shim.py`. Unset still means `dsh` on
`PATH` (headless). Trade-offs, credentials, timeouts, and event richness are documented in
[`docs/reference/dsh-execution-paths.md`](../../../../../docs/reference/dsh-execution-paths.md).

## Current R2 status

- Runner session ids are captured into `sessions.resume_token` (`opencode_session`
  / `dsh_session`) before `rig down`; `rig up --existing` resumes the same
  runtime-native conversation when at least one task created a session.
  Seats that never ran a task have no runtime session and must be started with
  `--fresh`.
- Skills are projected to the shared native project path `.agents/skills/`;
  OpenCode also discovers `.opencode/skills/`.
- Claude Code/Codex/Pi/OMP remain compiled for compatibility, but this fork's
  default starter entry is this OpenCode + DSH rig.
- DSH provider auth is runtime-owned. If headless lacks a credential, the
  adapter reports the real failure in the sidecar instead of faking readiness.
