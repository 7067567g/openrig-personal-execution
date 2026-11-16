# OpenCode + DSH starter rig

This rig is the minimal OpenRig specialization for two CLI runtimes:

- `opencode` seats use `opencode run --format json` through the shared CLI runner;
- `dsh` seats use `dsh --profile headless --json` through the same runner.

The roles are intentionally small: a control pod (main + PMO), an execution pod
(one OpenCode TDO and one DSH TDO), and a QA pod. The workflow is a static
two-branch fan-out/join; dynamic round planning belongs to the orchestration
layer above OpenRig.

Keep task evidence in files or queue evidence refs. Do not put provider keys in
reports. DSH provider credentials are runtime-owned; OpenCode auth is owned by
the OpenCode installation.
