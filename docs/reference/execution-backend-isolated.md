# `execution.backend=isolated` — DSH 隔离执行后端设计（P2 proposal）

状态：**proposal，未实现**。本文不是 0.7.0 的行为承诺，代码里也没有 `execution` 键、
`isolated` 分支或本文描述的 shim。它是下一轮实现的契约输入；实现时必须先补测试再接线。

- 适用 runtime：`dsh`（首发）。`opencode` 只保留同一 shim 接口的扩展位，不在首批实现。
- 关联计划：[seat-load-isolation-and-resource-budgets-plan.md](seat-load-isolation-and-resource-budgets-plan.md) §3（P2）。
- 当前 DSH 双路径：[dsh-execution-paths.md](dsh-execution-paths.md)。
- 当前 `ps --resources` 语义：[host-resources.md](host-resources.md)。
- 基线：`195c017`（loop 基线）+ 截至 `6cf877c` 的 loop-2 改动；本文所有 `file:line` 以该树为准。

## 0. 怎么读这份文档

每一节的三类内容分开写：

- **事实**：当前树里能直接指到 `file:line` 的行为。实现轮不得重新发明。
- **推断**：基于事实、但未在本机验证的判断（例如 DSH 内部会不会 `setsid`）。实现轮必须先用实验证实，或明确标为风险。
- **提案**：本文建议的新契约，尚未实现。实现轮可以调整细节，但不能跳过验收。

一句话结论：**`isolated` 不是“换一个 runtime”，而是给现有 per-turn headless `dsh`
加一层可验证的监督进程：独立进程组、显式凭据 allowlist、可持久化 resume、
可对账的孤儿清理、以及不谎报的观测面。** 默认不启用；不选 `isolated` 的 seat 执行行为与 0.7.0 一致；
`ps --json` 只多一个 additive 的 `execution` 字段（默认人表不变）。

## 1. 决策摘要

| # | 决策 | 取值 | 理由 |
| --- | --- | --- | --- |
| D1 | 配置键 | `execution.backend`，rig 默认 + member 覆盖 | 计划 §3.1 已提出；schema 已有严格的未知键拒绝，必须显式加键 |
| D2 | 值域 | `inherit`（默认）/`shared-web`/`headless`/`isolated` | `inherit` 保当前行为；`headless` 给显式回滚；`isolated` 是新增保证 |
| D3 | 默认 | `inherit`，解析到当前树的行为 | ROUND-SPEC：新开关默认关闭/保持现状。计划里“默认 shared-web”与 0.7.0 P0 后的树不一致，见 §4.4 |
| D4 | 进程模型 | 每 seat 一个常驻 `cli-agent-runner`；每 turn 一个 `dsh-isolated-shim` + 一个 `dsh` 子进程；shim 与 dsh 各占一个进程组 | 复用现有 runner 的 stdin 队列、sidecar、取消路径；不改 DSH 调用形状 |
| D5 | 凭据 | 只从 **runner 进程环境**按**名字**取（runner 继承启动 tmux server 的环境）；值不进 argv/YAML/sidecar/日志/`ps` | 硬规则“凭据只走环境变量”；`tmux set-environment`/env 文件都会把值放上命令行或磁盘，不采纳 |
| D6 | session | 复用 `$OPENRIG_HOME/state/dsh/<seat>/runner-state.json`，新增 additive `execution` 块 | 现有 resume 捕获已经读这个文件；不引入第二套状态 |
| D7 | 孤儿清理 | 进程组 + 启动对账 + `/proc` 身份校验 | 0.7.0 只杀直接子进程；不引入 cgroup（P3） |
| D8 | 观测 | `rig ps --nodes --json` / `--fields execution`；`rig ps --resources --json` 增 seat 级 `execution`；不改默认人表列 | 避免破坏现有输出解析；不新增命令 |
| D9 | 失败 | 稳定 `error.code` + 不静默重试 + 不谎报 | 与 0.7.0 的 `not_enforced`/`not_reported` 诚实性一致 |
| D10 | 范围 | 不含 cgroup、容器、Web UI 侧栏映射、Windows、auto 选择 | P3/P4 或永不做 |

## 2. 事实基线（当前树）

| # | 事实 | 证据 |
| --- | --- | --- |
| F1 | DSH 当前默认是 per-turn headless：`OPENRIG_DSH_BIN`/`DSH_BIN` 未设时用 PATH 上的 `dsh`；设为 web shim 时才走 shared-web | `packages/daemon/src/startup.ts:964-974`；`packages/daemon/src/adapters/cli-agent/cli-agent-runner-protocol.ts:152-155` |
| F2 | runner 每 turn `spawn` 一个 `dsh` 子进程，`env: process.env`，没有 detached/进程组 | `packages/daemon/src/adapters/cli-agent/cli-agent-runner.ts:253-258` |
| F3 | 预算/取消只 `child.kill()` 直接子进程；没有进程树清理 | `packages/daemon/src/adapters/cli-agent/cli-agent-runner.ts:267-275`、`packages/daemon/src/adapters/cli-agent/cli-agent-runner.ts:363-377` |
| F4 | sidecar 是 runner 唯一写的状态文件，路径 `state/dsh/<seat>/runner-state.json`，tmp+rename 原子写 | `packages/daemon/src/adapters/cli-agent/cli-agent-runner-protocol.ts:31-36`；`packages/daemon/src/adapters/cli-agent/cli-agent-runner.ts:144-158` |
| F5 | 自动 resume 只在 sidecar 的 `nodeId` 与当前 node 相同时发生 | `packages/daemon/src/adapters/cli-agent/cli-agent-runtime-adapter.ts:157-165` |
| F6 | DSH 事件协议 v1：`session`/`status`/`final`/`error` 被消费，未知事件忽略；exit 0 无 `final` 仍是成功 | `packages/daemon/src/adapters/cli-agent/dsh-event-protocol.ts:9-16`、`packages/daemon/src/adapters/cli-agent/dsh-event-protocol.ts:154-175` |
| F7 | web shim 在 session 校验失败时静默新建会话，回复超时默认 1800s | `packages/daemon/assets/dsh/dsh-web-shim.py:56-80`、`packages/daemon/assets/dsh/dsh-web-shim.py:116-173` |
| F8 | rig/member 的未知键会被拒绝；`MEMBER_KEYS` 没有 `execution` | `packages/daemon/src/domain/rigspec-schema.ts:48-57` |
| F9 | seat 的 `env:` 是“非密钥设置”，值会进 tmux 命令行 | `packages/daemon/src/domain/seat-env.ts:1-6` |
| F10 | `ps --resources` 的 backend 枚举没有 isolated；CPU/memory 恒 `not_enforced` | `packages/daemon/src/domain/ps-resources.ts:39`、`packages/daemon/src/domain/ps-resources.ts:256-269` |
| F11 | `ps --resources` 人表已有 `SCOPE`/`BACKEND` 列 | `packages/cli/src/commands/ps.ts:1833-1848` |
| F12 | resume 捕获对 dsh 读 runner sidecar 的 `sessionId` | `packages/daemon/src/domain/resume-token-capture.ts:122-133` |
| F13 | `rig capture`/`rig transcript` 读 pane，因此两条 DSH 路径都可用 | `packages/cli/src/commands/capture.ts:1-20`；`packages/cli/src/commands/transcript.ts:1-30` |
| F14 | `rig up --existing <rig> --fresh <seat>` 是已有的“显式全新启动”入口 | `packages/cli/src/commands/up.ts:119` |

**推断（未验证，实现前必须证实）**

- I1：headless DSH 是否会在内部 `setsid` 或把工具子进程放进新进程组。若是，组 kill 只能覆盖一部分，
  必须靠 P3 cgroup 或额外的 marker 扫描兜底。验证方式：假 dsh 脚本 fork 一个 `sleep` 孙进程，
  检查 `/proc/<pid>/stat` 的 pgrp。
- I2：DSH 对“无效/过期 `--session-id`”是否有稳定的 stderr 文案或退出码。若没有，
  只能记 `nonzero_exit` 并保留 token，不能猜成 `resume_rejected`。见 §6.4。
- I3：Python shim 的启动开销（约 20–50ms/ turn）对交互 seat 可接受。首轮只对后台 seat 开放。

## 3. 目标与非目标

### 3.1 目标

1. 一个 seat 可以选择 `isolated`，其每个 turn 的执行进程树与 shared-web、其他 seat 相互独立。
2. 进程树有明确的边界：可启动、可超时、可取消、可对账清理，失败可见。
3. session id 持久化并可 resume；跨 node 不误继承。
4. 凭据只从环境变量注入，且可证明没有泄漏到任何持久面。
5. `rig ps`/UI 能回答“这个 seat 现在用哪个 backend、哪个进程组、resume 处于什么状态”，
   没有数据时显示 `unknown`，不猜。

### 3.2 非目标（本轮/首批都不做）

- cgroup/CPU/内存硬限制、`systemd-run` scope（P3）。
- 容器/VM/nsjail 等安全沙箱。`isolated` 是生命周期与资源边界，**不是安全边界**。
- 把 isolated 会话映射回 DSH Web 侧栏。
- 自动 backend 选择（`auto`）、按任务长度切换、跨 host 调度。
- Windows 原生支持；P2 在非 POSIX 平台 fail closed。
- 改 DSH 事件协议、改现有 budget 语义、改 `ps --resources` 的 CPU/memory 诚实性。
- OpenCode 的 isolated 实现；只要求 shim 接口不把它焊死。

## 4. 配置形状

### 4.1 作用域与优先级

**提案**：`execution` 只允许出现在 rig 根和 member 上，不引入 pod 级第三层。

```yaml
execution:                 # rig 默认，可被 member 覆盖
  backend: inherit
  isolated:                # 仅作为 member 的模板/默认
    profile: headless
    credential_env: []
    max_turn_seconds: 3600
    kill_grace_seconds: 10
    resume: same_node

pods:
  - id: delivery
    members:
      - id: builder
        runtime: dsh
        execution:
          backend: isolated
          isolated:
            credential_env: [DEEPSEEK_API_KEY]
```

优先级（后者覆盖前者，逐键 merge）：

```text
built-in default
  < rig.execution
  < member.execution
  < effective backend 解析（§4.4）
```

- `backend` 是标量，member 直接覆盖 rig。
- `isolated` 块逐键 merge；member 只覆盖自己写的键。
- 不设 pod 级：pod 是上下文域，不是进程域；多一层优先级没有 P2 收益。
- `execution` 块不参与 `env:` 的合并；它们是两个独立面。
- rig 级 `execution` 只被 `runtime: dsh` 的 member 消费；非 DSH member 视为 `inherit`（no-op）。

### 4.2 字段表

| 字段 | 类型 | 默认 | 约束 | 说明 |
| --- | --- | --- | --- | --- |
| `backend` | string | `inherit` | `inherit` / `shared-web` / `headless` / `isolated` | 选择执行路径 |
| `isolated.profile` | string | `headless` | `^[a-z0-9][a-z0-9-]*$` | 传给 DSH 的 `--profile`；P2 只验证 `headless` |
| `isolated.credential_env` | string[] | `[]` | 唯一；`^[A-Z_][A-Z0-9_]*$`；不得以 `OPENRIG_` 开头；≤8 项 | 只写**变量名**，不写值 |
| `isolated.max_turn_seconds` | integer | `3600` | `0..86400`；0 = shim 不设墙钟 | shim 的活性上限，不等于 budget |
| `isolated.kill_grace_seconds` | integer | `10` | `1..60` | SIGTERM 后等待，再 SIGKILL |
| `isolated.resume` | string | `same_node` | `same_node` / `never` | `never` = 不传 `--session-id`，但仍记录 id 供观测 |

**类型形状（提案，尚未进代码）**

```ts
type ExecutionBackend = "inherit" | "shared-web" | "headless" | "isolated";

interface ExecutionSpec {
  backend?: ExecutionBackend;         // default "inherit"
  isolated?: {
    profile?: string;                 // default "headless"
    credential_env?: string[];        // names only; default []
    max_turn_seconds?: number;        // 0..86400; default 3600
    kill_grace_seconds?: number;      // 1..60; default 10
    resume?: "same_node" | "never";   // default "same_node"
  };
}
```

**校验规则（提案）**

1. `execution` 只允许在 rig 根/member；其他层级出现 → 未知键错误（沿用现有 strict 行为）。
2. `backend` 不在枚举内 → 错误。
3. member 显式写 `shared-web`/`headless`/`isolated` 只允许在 `runtime: dsh` 上；
   rig 级 `execution` 只被 DSH member 消费，非 DSH member 视为 `inherit`（no-op）。
   这样一份混合 rig 可以写全局默认，而不会让 Claude/Codex seat 报错。
4. member 写了 `execution.isolated`，但 merge 后的 effective backend 不是 `isolated` → 错误
   （避免“配置了凭据却走了别的路径”的死配置）。rig 级 `isolated` 是模板，不受此限。
5. `credential_env` 里出现 `OPENRIG_*` → 错误（保留给 OpenRig）。
6. 值不是字符串/整数、越界、重复项 → 错误。
7. 新键在未实现前不存在；现有 rig 不会因为本文而改变校验结果。

### 4.3 最小/完整/回滚示例

最小（后台 seat）：

```yaml
pods:
  - id: delivery
    members:
      - id: builder
        runtime: dsh
        agent_ref: local:agents/builder
        profile: default
        cwd: .
        execution:
          backend: isolated
          isolated:
            credential_env: [DEEPSEEK_API_KEY]
```

显式 headless（回滚单个 seat，不影响别人）：

```yaml
        execution:
          backend: headless
```

显式 shared-web（需要 DSH Web 已在运行）：

```yaml
        execution:
          backend: shared-web
```

### 4.4 与当前实例级开关的关系（重要冲突）

**事实**：计划 §3.1 写“默认保持 `shared-web`”；但 0.7.0 P0 之后当前树的实际默认是
**headless**（`OPENRIG_DSH_BIN` 未设 → `dsh`；见 F1）。两者不能同时成立。

**提案**：以当前树为准，默认 `inherit`：

| 配置 | `OPENRIG_DSH_BIN` | 解析结果 |
| --- | --- | --- |
| `inherit`（默认） | 未设 / `DSH_BIN` / 指向 `dsh` | `headless`（当前行为） |
| `inherit` | 指向 `dsh-web-shim.py` | `shared-web`（当前行为） |
| `shared-web` | 忽略 | 打包的 web shim；bridge 缺失时启动失败，不静默降级 |
| `headless` | 非 shim 路径则尊重；否则 PATH `dsh` | 当前 per-turn headless，无 isolated 保证 |
| `isolated` | 忽略 | 打包的 isolated shim；缺失/不支持时 fail closed |

- `headless` 是显式回滚值，不是“新功能”；它没有 shim、没有独立组保证、没有实例记录。
- `isolated` 要求使用**打包的** shim；自定义 `OPENRIG_DSH_BIN` 包装器请用 `headless`。
- 不新增实例级 `execution.backend` 设置键；实例默认仍由 `OPENRIG_DSH_BIN` 决定。
  如果 owner 以后要“全局强制 isolated”，那是另一个决策，不在 P2。

### 4.5 兼容性

- 没有 `execution` 块的 rig：校验、启动、sidecar 行为不变；`ps --json` 多一个
  additive 的 `execution` 字段，默认人表与 `--fields` 默认集合不变。
- 新增的是 member 的可选键；现有 strict 校验不会放松。
- 不迁移数据库、不新增表、不改 `runner-state.json` 的必填字段
  （`parseCliAgentRunnerState` 只要求 `ready`/`updatedAt`，见 `packages/daemon/src/adapters/cli-agent/cli-agent-runner-protocol.ts:77-87`）。
- sidecar 的 `execution` 是 additive 字段；旧 daemon 读到会忽略。
- 默认执行行为不变；`isolated` 是显式 opt-in。
- 文档依赖：`docs/reference/rig-spec.md` 的 runtime 列表没有 `dsh`，但 pod-aware
  schema 只要求 runtime 是非空字符串（`packages/daemon/src/domain/rigspec-schema.ts:484-485`），所以本设计可行；
  发布前应由文档轮把 `dsh`/`opencode` 补进那张表。

## 5. headless shim 接口

### 5.1 进程拓扑

打包位置：`packages/daemon/assets/dsh/dsh-isolated-shim.py`（与 web shim 同目录，
`python3` shebang，可执行位由打包脚本保证）。

```text
tmux pane
└─ node cli-agent-runner            （常驻，stdin 一行一个任务）
   └─ python dsh-isolated-shim.py   （每 turn 一个；进程组 A 的 leader）
      └─ dsh --profile headless --json ...  （每 turn 一个；独立进程组 B 的 leader）
         └─ 工具子进程 …             （默认继承组 B）
```

- runner 复用现有实现；不改 stdin 队列、sidecar、budget 折叠。
- shim 只做“监督 + 转发”，不解析模型语义、不重试、不改写 DSH 输出。
- 组 A 用于让 runner/daemon 能找到并杀掉 shim 及其潜在子进程；组 B 用于 DSH 工具树。
- shim 与 dsh 分属两个组，shim 才能在清理组 B 时不杀死自己。

### 5.2 调用契约

**argv**：与现有 DSH 调用完全同形，runner 只替换 `bin`：

```text
dsh-isolated-shim.py --profile <p> --json [--session-id <id>] <task text>
```

**控制信息走环境变量**（不是 argv，避免凭据名/元数据出现在 `ps` 命令行）：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `OPENRIG_DSH_ISOLATED_CONTRACT` | 是 | 固定 `1`；不匹配 → exit 2，不启动子进程 |
| `OPENRIG_DSH_ISOLATED_INSTANCE_FILE` | 是 | 绝对路径；shim 原子写实例记录（§5.4） |
| `OPENRIG_DSH_ISOLATED_CREDENTIAL_ENV` | 否 | 逗号分隔的变量**名**；空 = 不注入额外凭据 |
| `OPENRIG_DSH_ISOLATED_MAX_TURN_SECONDS` | 是 | 整数；0 = 不设 shim 墙钟 |
| `OPENRIG_DSH_ISOLATED_KILL_GRACE_SECONDS` | 是 | 整数 |
| `OPENRIG_DSH_ISOLATED_SEAT` | 是 | 规范 seat 名，只用于记录 |
| `OPENRIG_DSH_ISOLATED_LAUNCH_ID` | 是 | 与 runner sidecar 的 `launchId` 一致 |
| `OPENRIG_DSH_ISOLATED_NODE_ID` | 是 | 与绑定 node 一致 |
| `OPENRIG_DSH_ISOLATED_RUNNER_PID` | 是 | runner 的 pid；shim 用它检测父进程是否已死 |
| `OPENRIG_DSH_ISOLATED_DAEMON_PID` | 是 | daemon 主进程 pid；用于对账时判断记录是否来自仍然存活的另一个实例 |
| `OPENRIG_DSH_ISOLATED_DAEMON_INSTANCE_ID` | 是 | 本次 daemon 启动的实例 id；由 runner 从 launch env 透传 |
| `OPENRIG_DSH_ISOLATED_TURN_ID` | 是 | 本轮 turn 的唯一 id；shim 写入实例记录，并作为 dsh 子进程的孤儿扫描 marker |

`OPENRIG_DSH_ISOLATED_TURN_ID` 同时会作为非密钥 marker 出现在 **dsh 子进程**环境；
它不控制行为，只用于记录缺失时的孤儿扫描兜底（§8.3）。

**stdout**：只允许 NDJSON，一行一个事件，逐行 flush。

- 成功时**透传** DSH 的原始 stdout 行（包括 `tool_call`/`usage` 等 richer events），
  不重新序列化；这样 budget 的 steps/tool/tokens 计数保持可用（对照 F6 与
  `dsh-execution-paths.md` 的 headless 覆盖表）。
- shim 自己只在“内部失败”时补一条 `status.reason.kind=error` + 空 `final`，与 web shim 的
  失败形状一致（F7）。
- 半行：shim 必须按行缓冲转发；子进程 EOF 时把尾部的非空半行原样写出，再退出。

**stderr**：透传诊断，但按 §7.3 脱敏；shim 自己的诊断也走 stderr，不能污染 stdout。

**exit code（提案）**：

| code | 含义 | 是否已启动子进程 |
| --- | --- | --- |
| 0 | 子进程 0 退出（无论是否有 `final`） | 是 |
| 2 | 用法/契约/平台错误 | 否 |
| 3 | 声明的凭据名缺失或为空 | 否 |
| 4 | 子进程 spawn 失败（EACCES 等） | 否 |
| 124 | shim 墙钟到点 | 是，已清理 |
| 125 | shim 内部错误 | 可能 |
| 126/127 | 不可执行/找不到 `dsh` | 否 |
| 128+N | 子进程被信号 N 杀死 | 是 |

除 124/125/128+N 外，2/3/4/126/127 这些“未启动子进程”的错误也必须先向 stdout 发一条
`status.reason.kind=error` + 空 `final`（与 web shim 的失败形状一致），再以对应码退出；
否则 runner 只能拿到 stderr，无法把失败落到结构化字段。

**不做**：shim 不读 stdin（stdin 设 `DEVNULL`），不启动交互式提示，不自动重试，
不把 task 写进实例记录。

### 5.3 生命周期与信号

**提案**：

1. runner `spawn(shim, args, { detached: true, ... })` → shim 成为组 A leader
   （POSIX `setsid` 语义）。
2. shim 启动时断言 `os.getpgrp() === os.getpid()`；不成立 → exit 2（fail closed）。
3. shim `spawn(dsh, { start_new_session: true })` → dsh 成为组 B leader。
4. shim 写实例记录（`state: running`），开始转发 stdout/stderr。
5. shim 每秒检查 `os.getppid()` 是否仍等于 `OPENRIG_DSH_ISOLATED_RUNNER_PID`；
   不等（被 reparent 到 1/子收割者）→ 视为 runner 崩溃，清理组 B 后退出，写 `state=orphaned`。
6. 子进程退出：shim 等待 200ms 让管道排空；检查 `killpg(B, 0)`；若组 B 仍存活，
   SIGTERM → grace → SIGKILL；更新实例记录（`state`/`exitCode`/`groupReaped`）后退出。
7. 收到 SIGTERM/SIGINT：转发 SIGTERM 到组 B；grace 后 SIGKILL；写 `cancelled`；退出 143。
8. 墙钟到点：同 7，但写 `timed_out`；退出 124。

**与 runner 的分工**：

- runner 仍是 budget 的执行者（墙钟/steps/tool/tokens/retries），shim 的墙钟只是活性兜底。
- 两者都到点时，runner 的 budget 是更具体的原因：sidecar 以 `budget.exhausted` 为准；
  shim 只记录自己的状态（自己的墙钟 `timed_out`，被 runner 终止 `cancelled`），
  不覆盖 runner 的 `lastError`。
- runner 取消/关闭时先 SIGTERM 组 A；若实例记录里有组 B，再 SIGTERM 组 B；
  grace 后 SIGKILL 两组。**不能只 kill shim 的 pid**。
- 只有 shim 自己的墙钟到点才写 `timed_out`；runner 因 budget/stop 发来的终止写 `cancelled`。
  runner 的 sidecar 以 `budget.exhausted` 为更具体的原因，shim 的 `cancelled` 是清理记录。

### 5.4 实例记录 schema

路径：`$OPENRIG_HOME/state/dsh/<seat>/execution/<turnId>.json`，mode `0600`，tmp+rename 原子写。
一个 turn 一个文件；每个 seat 保留最近 5 个（按 `updatedAt`），更旧的由 runner 在 turn 结束后清理。

```json
{
  "contract": 1,
  "shimVersion": "1",
  "backend": "isolated",
  "seat": "builder@delivery",
  "nodeId": "node-...",
  "launchId": "...",
  "turnId": "...",
  "shimPid": 4100,
  "shimPidStartTicks": "123456",
  "shimPgid": 4100,
  "childPid": 4101,
  "childPidStartTicks": "123457",
  "childPgid": 4101,
  "bootId": "...",
  "daemonInstanceId": "...",
  "daemonPid": 4000,
  "killGraceSeconds": 10,
  "startedAt": "2026-10-24T01:00:00.000Z",
  "updatedAt": "2026-10-24T01:00:00.000Z",
  "state": "running",
  "exitCode": null,
  "sessionId": "session-...",
  "credentialEnv": [
    { "name": "DEEPSEEK_API_KEY", "present": true }
  ],
  "redactions": 0
}
```

硬规则：

- **不写 task 文本、不写环境变量值、不写 stderr 正文、不写 token**。
- `sessionId` 可以写（它已经在现有 sidecar 里）。
- `credentialEnv` 只写名字 + presence，不写长度/hash/前缀。
- 文件损坏时 daemon 记 `unreadable`，不阻塞 seat 启动，但不谎报清理成功。

### 5.5 版本/契约协商

- `shimVersion` 是 shim 自己的字符串版本（P2 为 `"1"`）；`contract` 是 runner 期望的接口版本（整数）。
- runner 启动 shim 前检查 `OPENRIG_DSH_ISOLATED_CONTRACT=1`；shim 启动时也应校验。
- 不匹配 → 不启动 dsh，sidecar 写 `execution_contract_mismatch`，seat 进 `attention_required`。
- 允许 shim 在**同一 contract** 内新增字段/事件；runner 必须忽略未知字段。
- DSH 自身的版本不在这里协商；它由 `OPENRIG_DSH_BIN`/PATH 决定，协议消费面仍是
  `DSH_EVENT_PROTOCOL_VERSION = 1`（F6）。

### 5.6 与现有 runner/protocol 的接点

实现轮的最小改动面（提案）：

1. `cli-agent-runner-protocol.ts`：`buildCliAgentInvocation` 增加 `backend`/`shimBin` 选择，
   仍返回 `{command,args}`；argv 形状不变。
2. `cli-agent-runner.ts`：`spawn` 增加 `detached: true`（仅 isolated）；
   恢复/取消时按组 kill；sidecar 写 `execution` 块；把 `OPENRIG_DSH_ISOLATED_*` 注入子环境。
3. `cli-agent-runtime-adapter.ts`：从 binding/rig 读 effective backend；选择打包 shim 路径；
   启动时把 execution 配置传给 runner（新增参数或环境，二者择一，不双写）；
   同时把 `OPENRIG_INSTANCE_ID`/`OPENRIG_DAEMON_PID` 放进 runner launch env（非密钥，
   供 §5.4 实例记录与 §8.3 对账使用）。
4. `rigspec-schema.ts`：加 `execution` 键与校验；不改现有键。
5. `ps-resources.ts`/`ps.ts`：只读 sidecar/实例记录，不主动扫进程。

## 6. session-id 与 resume 持久化

### 6.1 现状（事实）

- runner 从 `session` 事件的 `sessionID`/`sessionId` 取 id，也可从 `--resume-token` 种子；
  每次变化写 sidecar（`packages/daemon/src/adapters/cli-agent/cli-agent-runner.ts:190-194`、`packages/daemon/src/adapters/cli-agent/cli-agent-runner.ts:220-224`）。
- 调用 DSH 时把 id 作为 `--session-id`（`packages/daemon/src/adapters/cli-agent/cli-agent-runner-protocol.ts:152-155`）。
- 自动 resume 只在 sidecar 的 `nodeId` 与当前 node 一致时发生（F5）。
- `rig down` 通过 `readSessionFile` 把 id 存成 `dsh_session`（F12）。

### 6.2 持久化布局（提案）

沿用 `runner-state.json`，新增：

```json
{
  "ready": true,
  "launchId": "...",
  "sessionId": "session-...",
  "nodeId": "...",
  "updatedAt": "...",
  "execution": {
    "configuredBackend": "isolated",
    "effectiveBackend": "isolated",
    "shimVersion": "1",
    "launchId": "...",
    "turnId": "...",
    "instanceFile": "/home/.../execution/<turnId>.json",
    "shimPgid": 4100,
    "childPgid": 4101,
    "startedAt": "...",
    "state": "running|exited|timed_out|cancelled|failed|orphaned|reaped|cleanup_incomplete|unverified",
    "resume": { "requested": true, "outcome": "seeded|fresh|disabled|rejected|failed" },
    "failure": { "code": "execution_turn_timeout", "message": "..." },
    "credentialEnv": [ { "name": "DEEPSEEK_API_KEY", "present": true } ]
  }
}
```

- runner 是 sidecar 的唯一写者；shim 只写实例记录。**不双写**同一文件。
- 写 sidecar 仍用 tmp+rename；实现轮加 `fsync`（文件 + 目录）作为崩溃一致性要求。
- `execution` 是 additive；旧 daemon 的 `parseCliAgentRunnerState` 不会拒绝（F6/§4.5）。

### 6.3 resume 规则

| 情况 | 行为 |
| --- | --- |
| same node + `resume: same_node` + sidecar 有 id | 传 `--session-id`，`resume.outcome=seeded` |
| same node + `resume: never` | 不传 id；`resume.outcome=disabled`；sidecar 保留 id 供观测 |
| 新 node / 新 rig / nodeId 不匹配 | 不传 id；`resume.outcome=fresh`；不继承旧会话 |
| sidecar 无 id | 正常 fresh；`resume.outcome=fresh` |
| DSH 拒绝 resume | 见 §6.4；**不自动 fresh 重放** |

### 6.4 resume 被拒的失败语义（提案）

**推断 I2**：目前没有稳定的 DSH 错误码可区分“session 不存在/过期”和其他失败。

因此：

1. 只有 stderr/退出码能**明确**匹配到 resume 相关标记时，才写
   `execution.failure.code = "execution_resume_rejected"`；否则写通用的
   `execution_nonzero_exit` + stderr tail（可含 DSH 原文）。`lastError` 只放人类可读的
   `"<code>: <message>"`，不作为机器读取的唯一来源。
2. 两种情况下都**保留** `sessionId`：明确识别写 `resume.outcome = "rejected"`，
   未能识别只写 `resume.outcome = "failed"`。
3. 不自动清 token、不自动用同一 task 重跑。部分执行的 turn 重放会造成重复副作用。
4. 恢复动作是显式的：`rig up --existing <rig> --fresh <seat>`（F14）或
   `rig seat launch <seat> --fresh --reason ...`（`packages/cli/src/commands/seat.ts:694`）。
5. 下一次 `rig send` 仍会带旧 token；如果 DSH 继续拒绝，用户会再次看到同一个错误，
   直到显式 fresh。这比“静默新建会话”诚实（对照 F7 的 shared-web 行为）。

### 6.5 并发与原子性

- runner 的 stdin 队列保证同一 seat 同时只有一个 turn（`packages/daemon/src/adapters/cli-agent/cli-agent-runner.ts:130`、`packages/daemon/src/adapters/cli-agent/cli-agent-runner.ts:385-393`）。
- 一个 turn 内 shim/dsh 串行；不存在多写者。
- 读侧（`ps`/resume 捕获）只能看到完整的 tmp+rename 结果；损坏时返回 `parse_error`，
  不把半截 JSON 当事实。

## 7. 凭据注入

### 7.1 规则（提案）

1. **值只来自 runner 进程的环境变量**。runner 继承启动 tmux server 的那个环境（OpenRig 的
daemon 启动 server 时即 daemon 环境；用户自己起的 server 则是用户 shell 环境）；
   `credential_env` 从 runner 的 `process.env` 里按名字取值。OpenRig 不写凭据文件、
   不把值写进 rig YAML、不把值放 argv。
2. rig/member 的 `execution.isolated.credential_env` 只写**名字**。
3. 未在 `credential_env` 里声明的环境变量，不进入 dsh 子进程，即使 runner 环境里有。
4. 没有 `credential_env` 也能跑（DSH 可用自己的配置文件认证）；此时不预判失败。
5. 声明了名字但 runner 环境里不存在/为空 → 启动前失败 `execution_credential_missing`（exit 3），
   不启动子进程，避免“先跑一半再报 401”。
6. 声明的值短于 8 个字符 → `execution_credential_weak`（exit 3），不启动子进程。
   这条限制让脱敏可以“始终替换完整值”而不把日志打碎。

### 7.2 子进程环境（提案）

shim 为 dsh 构造一个最小环境，而不是 `...process.env`（对照 F2 当前行为）：

**基础 allowlist**：`PATH`、`HOME`、`USER`、`LOGNAME`、`SHELL`、`TERM`、`LANG`、`LC_ALL`、
`TMPDIR`、`TZ`、`NODE_OPTIONS`、`NODE_EXTRA_CA_CERTS`、`HTTP_PROXY`、`HTTPS_PROXY`、
`NO_PROXY`（大小写两种形式）、`DSH_HOME`、`DSH_WEB_PORT`。

**叠加**：`credential_env` 中声明且存在的变量；`OPENRIG_DSH_ISOLATED_*` 控制变量（仅 shim 用，
不传给 dsh）。**剔除**：所有其他 `OPENRIG_*`（避免把 daemon 内部状态带进 DSH）。

- 基础 allowlist 是 P2 的最小集；实现轮若发现 DSH 需要额外非密钥变量，必须显式加进列表并写测试，
  不能退回 `...process.env`。
- 例外：`OPENRIG_DSH_ISOLATED_TURN_ID` 是给 dsh 子进程的孤儿扫描 marker（非密钥），
  显式加入子环境；除它和 `OPENRIG_DSH_ISOLATED_*` 控制变量外，不传其他 `OPENRIG_*`。
- 代理/CA 变量是常见的构建依赖，才放进基础列表；它们不是凭据。
- 不设 `CI=1` 等会改变 DSH 行为的变量。
- **值的传递路径**：daemon 环境 →（创建 tmux server/session 时继承）runner 环境 →
  （runner 直接 `spawn`，环境变量不经命令行）shim 环境 →（shim 构造最小环境）dsh 环境。
  不使用 `tmux set-environment` 传值：该 API 会把值放上 tmux 命令行
  （`packages/daemon/src/adapters/tmux.ts:1103-1109`）；也不写 env 文件。

### 7.3 脱敏

- shim 知道声明的值；对 stderr 逐行把**完整值**替换为 `[redacted:<NAME>]`，计数写入 `redactions`。
  值已在 §7.1 要求 ≥8 字符，因此不需要按长度跳过。
- runner 对写入 `lastError`/`lastResultText`/stderr tail 的文本做同样替换。
- 始终替换完整值；替换后仍不得把值写入任何文件。
- `rig ps` 只显示 `name: present|missing`，不显示值、长度、hash、前缀。
- 实例记录/sidecar/事件/报告都不得出现值。
- 如果 DSH 把密钥打进正常 stdout（模型输出），runner 在落 sidecar 前脱敏；
  pane 实时输出可能已经显示，属于 runtime 行为，P2 只能降低持久化风险，不能完全阻止。

### 7.4 与 seat `env:` 的关系

**事实 F9**：seat `env:` 的值会进 tmux 命令行，文档已声明“非密钥设置”。

**提案**：

- `credential_env` 是唯一受支持的密钥通道；不要用 seat `env:` 放密钥。
- 实现轮在 preflight 加**advisory**（不阻断）：`env:` 里出现
  `*_API_KEY`/`*_TOKEN`/`*_SECRET`/`*_PASSWORD` 形态的名字时，提示“可能泄漏到命令行，请用 daemon 启动环境（经 tmux server 继承到 runner）+ credential_env”。
- 不把 advisory 升级为 error，避免破坏现有 rig；但文档、CHANGELOG 要写清楚。

### 7.5 不做什么

- 不实现 `credential_file`/`env_file`（与硬规则冲突；计划 §3.2 的这条建议被本 proposal 拒绝）。
- 不支持把凭据值放在 `rig up --env`（同样会进命令行）。
- 不做凭据轮换/短期 token 交换；P4 以后再说。

## 8. 孤儿进程清理

### 8.1 进程组模型

- runner → shim：`detached: true`，shim 为组 A leader（pgid = shim pid）。
- shim → dsh：`start_new_session: true`，dsh 为组 B leader（pgid = dsh pid）。
- dsh 的工具子进程默认继承组 B；如果某个工具自己 `setsid`，它逃出两组（I1），
  P2 只能靠 marker 扫描兜底，P3 用 cgroup 根治。
- 记录两组 pgid；清理时先 B 后 A，避免 shim 先死导致 B 失去监督。

### 8.2 路径矩阵

| 事件 | 谁清理 | 机制 | 记录 |
| --- | --- | --- | --- |
| dsh 正常退出 | shim | 检查组 B 是否还有成员；有则 SIGTERM→grace→SIGKILL | `state=exited`, `groupReaped` |
| dsh 被信号杀 | shim | 同上 | `state=failed`, `exitCode=128+N` |
| shim 被 runner 取消 | runner → shim | SIGTERM 组 A；shim 清理 B；grace 后 SIGKILL A/B | `state=cancelled` |
| shim 崩溃（SIGKILL） | runner | 子进程 close 后读实例记录，SIGTERM/KILL 组 A/B | `execution_cleanup_incomplete` 若仍活 |
| runner 崩溃 | shim（首选）+ daemon 启动对账（兜底） | shim 检测 ppid 变化，清理 B 后退出；daemon 再扫记录杀 A/B | `orphaned` → `reaped` |
| daemon 崩溃 | 下一次 daemon 启动 | 同上 | 事件 `execution.orphan_reaped` |
| 主机重启 | OS + 下一次 daemon | 进程已不存在；清 stale 记录 | `reaped`/`stale` |
| `rig down`/seat stop | runner + daemon 校验 | 正常 shutdown；校验组消失 | `cleanup_incomplete` 若仍活 |

### 8.3 启动对账（提案）

新模块 `ExecutionReaper`（实现轮命名可调）在 daemon 启动后、seat readiness 之前跑。
对账有总预算（建议 30s）：超时未处理完的记录保留 `cleanup_incomplete`，不阻塞 daemon 启动。

1. 扫 `$OPENRIG_HOME/state/dsh/*/execution/*.json`。
2. 处理 `state` 为 `running`/`cancelled`/`failed`/`timed_out`/`cleanup_incomplete`
   且 `updatedAt` 早于本 daemon 启动时间的记录（这些状态都可能还留着进程组）。
3. 跳过：`daemonInstanceId` 等于当前实例；或记录的 `daemonPid` 仍存活且不是本 daemon 的前身
   （多 daemon 共用 `OPENRIG_HOME` 时不能互杀）。
4. 身份校验（防 PID 复用）：
   - `/proc/<pid>/stat` 的 starttime 与记录里的 `pidStartTicks` 一致；
   - `/proc/<pid>/cmdline` 含 `dsh-isolated-shim`（组 A）或 `dsh`（组 B）；
   - 两者任一不满足 → 不杀，标 `unverified`，记日志。
5. 杀：`kill(-pgid, SIGTERM)` → `kill_grace_seconds` → `kill(-pgid, SIGKILL)`；
   用 `kill(-pgid, 0)` 确认消失。
6. 成功：写 `state=reaped`、`reapedAt`、`reapedBy=daemonInstanceId`；发事件
   `execution.orphan_reaped`（只带 pids/seat，不带 task）。
7. 失败/不可验证：保留记录，`state=cleanup_incomplete`；`ps` 显示原因；下一次启动再试。
8. **记录缺失/损坏的兜底**：若实例记录没有 `childPgid`、文件损坏，或 shim 在写记录前就被杀，
   扫 `/proc/*/environ` 找 `OPENRIG_DSH_ISOLATED_TURN_ID=<turnId>`，再用
   `/proc/*/stat` starttime + cmdline 校验后按 pgid kill。跳过：当前 sidecar 指向的
   `turnId` 且 state 仍为 running（那是活 turn）；`/proc/<pid>/environ` 不可读（不同 uid）。
   这个扫描只在启动对账/清理失败时做，不是常驻轮询；找不到 marker 就诚实标 `unverified`，不乱杀。

**非 Linux**：没有 `/proc` 身份校验；P2 只支持 POSIX（Linux/macOS），macOS 用
`ps -o lstart=`/`pgrep -f` 做等价校验，若做不到则标 `unverified` 并**不杀**。
Windows → `execution_backend_unsupported`，不启动 isolated。

### 8.4 为什么不是 cgroup

P3 的 systemd scope 会是更强的生命周期边界（`--collect`、`MemoryOOMGroup`）。
P2 不引入它，原因：

- P2 只解决“进程树能被找到并杀掉”，不承诺 CPU/内存上限；
- `systemd-run` wrapper 会改变 pane 前台命令，影响现有 send guard（计划 §4.3 已记录）；
- cgroup 需要单独的 Linux e2e 与平台降级，属于 P3。

### 8.5 验收要点

- 假 dsh 先 fork 一个 `sleep` 孙进程，再挂起；取消 seat 后 `grace+2s` 内两组都消失。
- SIGKILL runner：shim 在 2s 内检测到 ppid 变化，清理组 B 后退出，记录 `orphaned`。
- 杀 shim（SIGKILL）后 runner 仍能清理组 B。
- daemon 重启后 stale 记录被 reaped；伪造一个不存在的 pgid 不会被误杀。
- 记录里的 pid 被复用到无关进程时，identity check 拒绝 kill，标 `unverified`。
- `rig down` 后 `ps` 不再显示 `running`：正常结束写 `exited`，进行中被取消写 `cancelled`。

## 9. UI / 可观测入口

### 9.1 数据模型（提案）

在 seat 的观测投影上增加一个可空对象（不是新表、不是新命令）：

```ts
interface SeatExecutionView {
  configured: "inherit" | "shared-web" | "headless" | "isolated";
  effective: "shared-web" | "headless" | "isolated" | "unknown";
  state: "running" | "exited" | "timed_out" | "cancelled" | "failed" | "orphaned" | "reaped" | "cleanup_incomplete" | "unverified" | "unknown";
  shimVersion: string | null;
  shimPgid: number | null;
  childPgid: number | null;
  sessionIdPresent: boolean;      // DSH 的 sessionId 同时是 resume token，默认不显示原值
  sessionIdShort: string | null;  // 仅前 8 位 + …；--full 才允许原值（沿用 ps 现有约定）
  startedAt: string | null;
  resume: "seeded" | "fresh" | "disabled" | "rejected" | "failed" | "unknown";
  credentials: Array<{ name: string; present: boolean }>;  // 永不带值
  failure?: { code: string; message: string };
  reason?: string;               // 例如 "no_instance_record" / "unverified"
}
```

- 数据来源：sidecar 的 `execution` 块 + 实例记录；daemon 只读，不主动 `ps` 扫进程。
- OpenRig UI 的 seat 详情直接消费该对象（badge + 字段），不需要新页面；
  Web UI 只显示 OpenRig 自己的 seat，不映射 DSH Web 侧栏。
- `configured`/`effective` 来自配置解析，即使没有实例记录也能给出；
  `state`/pids/`resume`/`failure` 来自 sidecar/实例记录。
- 没有实例记录：`state: "unknown"`, `reason: "no_instance_record"`；
  不根据“有 tmux 会话”推断，也不把 `effective` 改成 `unknown`。
- shared-web/headless 的 DSH seat：`effective` 为对应值，`state: "unknown"`,
  `reason: "backend_not_isolated"`（没有 isolated 实例记录可读）。

### 9.2 `rig ps --nodes`

- `--json`：每个 DSH seat 增加 `execution` 字段（上面对象，shared-web/headless 也有
  `configured`/`effective`，只是 `state=unknown`）；非 DSH seat 为 `null`。
- `--fields`：加入 `execution`（允许 `execution` 或 `execution.effective` 形式，实现轮定）；
  默认人表**不加列**，避免宽度/解析变化。
- 人表可选：`rig ps --nodes --fields execution` 显示 `backend/pgid/session/resume` 摘要。
- 现有字段 `tmuxAttachCommand`/`resumeCommand` 不变；不泄漏 token。DSH 的 `sessionId`
  同时是 resume token（`rig down` 会把它存成 `dsh_session`），因此沿用
  `packages/cli/src/commands/ps.ts:626`/`packages/cli/src/commands/ps.ts:790` 的约定：
  默认只显示 `present`/前 8 位，`--full` 才显示原值。

### 9.3 `rig ps --resources`

- `--json`：`SeatResourceRow` 增加 `execution`（同 9.1）。资源行本身不变：
  CPU/memory 仍是 `not_enforced` + `cgroup_budget_not_implemented`/`platform_unsupported`（F10）。
- 人表：**仅当**该 seat 有 isolated 实例记录时，在资源行之后追加一行 `exec:` 摘要：
  `exec: builder@rig isolated running pgid=4101 session=session-… shim=1 resume=seeded creds=DEEPSEEK_API_KEY:present`
  （`session-…` 只是前 8 位；默认不打印完整 token。）
  shared-web/headless 默认不追加，保持人表输出不变；要看它们用 `--json` 或
  `--fields execution`。非 DSH seat 不追加。
- 不把 isolated 写成 `enforced_by: config`；`isolated` 是 backend，不是资源上限。
- 不新增 `resource` 行来伪装“进程隔离已限制 CPU/内存”。

### 9.4 `rig capture` / `rig transcript`

- isolated 的 DSH 输出仍写在 pane，两个命令不需要改（F13）。
- 文档要给出三件套：
  - 看状态：`rig ps --nodes --fields execution`
  - 看最近输出：`rig capture <seat>`
  - 看 transcript：`rig transcript <seat> --tail 100`
- DSH Web 侧栏不会出现 isolated 会话（它没有 Web server）；这是明确取舍，不是 bug。
  要 Web 可见就用 shared-web。

### 9.5 事件与日志

提案的事件（内部 event bus / UI 订阅；不新增 CLI 命令）：

| 事件 | 触发 | 字段 |
| --- | --- | --- |
| `execution.backend_selected` | 每次 seat launch | seat, configured, effective, shimVersion |
| `execution.turn_started` | shim 启动成功 | seat, turnId, shimPgid, childPgid |
| `execution.turn_finished` | turn 结束 | state, exitCode, durationMs |
| `execution.resume_rejected` | 明确识别到 resume 被拒 | seat, sessionIdShort（前 8 位；不写凭据/task） |
| `execution.credential_missing` | 声明名缺失 | seat, name（只名字） |
| `execution.orphan_reaped` | 启动对账成功 | seat, shimPgid, childPgid, ageSeconds |
| `execution.cleanup_incomplete` | 清理失败 | seat, pgids, reason |

- 日志只写 code/pids/seat/name；不写 task、stderr 正文、凭据值。
- DSH 的 `sessionId` 是 resume token，事件/日志只写前 8 位或 `present`，不写全值；
  与 `ps` 的现有脱敏约定一致。

### 9.6 诚实性规则

1. 没有实例记录 → `unknown` + reason，不显示“0 个进程，所以没问题”。
2. `shimVersion` 不匹配 → `unknown` + `contract_mismatch`，不假装 running。
3. `ps` 不因为 seat 有 tmux 会话就推断 isolated 健康；以 sidecar/实例记录为准。
4. CPU/memory 的 `not_enforced` 不因 isolated 而改变。
5. 清理失败必须可见（`cleanup_incomplete`），不能只在 stderr 里写一行。

## 10. 失败语义

稳定 `code` 提案。机器读取以 sidecar `execution.failure.code` 为准；`lastError` 写
`"<code>: <人类可读消息>"`，方便 pane/日志。字符串集合固定，不随实现轮改变：

| code | 触发 | 子进程 | 自动重试 | 清理 | 用户可见/动作 |
| --- | --- | --- | --- | --- | --- |
| `execution_backend_unsupported` | 非 POSIX / shim 缺失 | 否 | 否 | n/a | `attention_required`；改用 headless/shared-web |
| `execution_contract_mismatch` | shim/runner contract 不一致 | 否 | 否 | n/a | 升级/重装 OpenRig；不要重试 |
| `execution_credential_missing` | 声明名在 runner 环境缺失/为空 | 否 | 否 | n/a | 在 daemon 的启动环境设置该变量并重启 tmux server/seat，或从 `credential_env` 移除 |
| `execution_credential_weak` | 声明值短于 8 字符 | 否 | 否 | n/a | 换一个正常的 provider key；不要用占位短串 |
| `execution_spawn_failed` | `dsh` 找不到/不可执行 | 否 | 否 | n/a | 修 PATH/权限；看 stderr tail |
| `execution_turn_timeout` | shim 墙钟 | 是 | **否** | 两组 SIGTERM→KILL | 调大 `max_turn_seconds` 或查 DSH 卡住 |
| `execution_cancelled` | seat stop/取消 | 是 | **否** | 两组 | 正常停止 |
| `execution_resume_rejected` | 明确识别 resume 被拒 | 是 | **否** | 清理 | 保留 token；用 `--fresh` 显式重开 |
| `execution_nonzero_exit` | 其他非零退出 | 是 | 仅当 budget 开启且允许 | 清理 | stderr tail；按现有 `max_retries` |
| `execution_missing_final` | exit 0 无 `final` | 是 | 否 | 清理 | **warning，不是失败**；与 F6 一致 |
| `execution_cleanup_incomplete` | grace 后组仍活 | 是 | 否 | 下次启动重试 | `attention_required`；查 pgid |
| `budget.exhausted` | 现有预算 | 是 | **否** | runner 现有路径 | 与 0.7.0 相同 |

规则：

1. 超时、取消、resume 拒绝、凭据缺失/过短、契约不匹配**永不静默重试**。
2. `execution_missing_final` 不升级为失败（保持 F6 的协议兼容）；但写 warning 字段。
3. 一个 turn 只允许一个终止原因；优先级：budget > shim timeout > 子进程非零退出 > missing final。
4. 失败时 sidecar 必须同时有：`lastError`、`execution.state`、`execution.failure.code`、
   pids、`updatedAt`；缺一即视为实现缺陷。
5. `execution_backend_runtime_mismatch` 是 **spec 校验错误**（`spec_validation` 阶段），
   不在本表；它不会启动 seat，也没有 sidecar。
5. 清理失败不能掩盖原始失败：两个 code 都要保留（例如 `execution_turn_timeout` +
   `execution_cleanup_incomplete`）。

## 11. 验收标准

实现轮必须逐条有测试；没有测试的条目标 `未验证`，不得写“通过”。

### A. 配置与兼容

1. 无 `execution` 块的 rig：现有测试全绿；执行行为不变，`ps --json` 只多 additive 字段。
2. `backend: isolated` 在 `runtime: dsh` member 上通过校验；effective 解析正确。
3. `backend: isolated` 在 `runtime: claude-code` 上被拒（`execution_backend_runtime_mismatch`）。
4. 未知 `execution.*` 子键被拒（strict），错误信息含路径。
5. `inherit` 在未设/设 web shim 两种实例环境下分别解析为 headless/shared-web。
6. `headless`/`shared-web` 显式值复现当前两条路径。

### B. 进程与清理

7. 每个 turn 的 shim 是组 A leader、dsh 是组 B leader；孙进程默认在组 B。
8. 墙钟到点：`grace+2s` 内组 A/B 都消失；sidecar `state=timed_out`。
9. `rig down`/seat stop：同上；`state=cancelled`。
10. SIGKILL shim：runner 仍能清理组 B；实例记录缺 `childPgid` 时，marker 扫描能找回组 B；
    `cleanup_incomplete` 只在真的失败时出现。
11. daemon 重启：stale running 记录被 reaped；事件 `execution.orphan_reaped` 有 pids/age。
12. PID 复用：伪造一个无关进程的 pid + 错误 starttime；reaper 不杀，标 `unverified`。
13. 多 daemon 场景：记录的 `daemonPid` 仍存活且不是当前 daemon → 跳过，不互杀。

### C. session/resume

14. 第一个 turn 从 `session` 事件写 id；第二个 turn 的 argv 含 `--session-id <id>`。
15. nodeId 不匹配 → 不自动 resume；`resume.outcome=fresh`。
16. `resume: never` → 不传 `--session-id`，但 sidecar 仍可显示 id。
17. 模拟 resume 被拒 → `execution_resume_rejected`（或通用 nonzero），token 保留，
    不自动重放 task；`--fresh` 是唯一恢复路径。
18. sidecar 原子写：注入写失败时不留下半截 JSON；读侧返回 `parse_error`。

### D. 凭据

19. 用 sentinel 值设置 `DEEPSEEK_API_KEY`，跑一个假 dsh：sentinel 不出现在 argv、
    sidecar、实例记录、`ps --json`、日志；stderr 里出现时被替换为 `[redacted:NAME]`。
    stdout 是模型输出通道，P2 不承诺改写它；测试只断言**持久化面**与 stderr。
20. 未在 `credential_env` 声明的 sentinel 变量不进入 dsh 子进程（假 dsh 把 env
    写到临时文件，断言文件里没有该名字/值）。
21. 声明名缺失 → `execution_credential_missing`，子进程未启动；声明值 <8 字符 →
    `execution_credential_weak`，子进程未启动。
22. stderr 里包含 sentinel → 输出为 `[redacted:NAME]`，`redactions > 0`。
23. `ps` 只显示 `name: present|missing`，没有值/长度/hash；DSH `sessionId` 默认只显示
    前 8 位/`present`，`--full` 才显示原值。

### E. 观测

24. `ps --nodes --json` 对 DSH seat 都有 `execution` 对象；isolated 有 pids/state，
    shared-web/headless 的 `state=unknown` + `backend_not_isolated`；非 DSH 为 `null`。
25. `ps --resources --json` 有 seat 级 `execution`；CPU/memory 仍是 `not_enforced`。
26. 无实例记录 → `effective` 仍是配置解析值，`state: "unknown"`, `reason: "no_instance_record"`。
27. 失败 turn 的 `ps` 显示 `state`/`failure.code`，不是 `running`。
28. `rig capture`/`rig transcript` 仍能读到 isolated 的 pane 输出。

### F. 失败语义

29. 表中每个 code 至少一个用例，断言：sidecar code、`state`、exit/清理、是否重试。
30. 超时/取消/凭据/契约/resume 拒绝均**零重试**。
31. `missing_final` 不升级为失败，但 warning 可见。

## 12. 实现切片（给下一轮实现轮）

| 切片 | 内容 | 出口条件 |
| --- | --- | --- |
| P2.1 | 打包 `dsh-isolated-shim.py` + 假 dsh 测试（组、超时、信号、脱敏、实例记录） | shim 单测全绿；不接 daemon，功能不可达 |
| P2.2 | schema + adapter 选择 + runner detached/组 kill + sidecar `execution` | 配置/进程/session 测试绿；默认不变 |
| P2.3 | `ExecutionReaper` + `ps --nodes`/`--resources` 字段 + 人表摘要 | 对账/观测测试绿；不谎报 |
| P2.4 | 假 dsh e2e、文档、CHANGELOG（proposal → implemented） | e2e 绿；真实 DSH 手工 smoke 记录 |

估算：5–8 个工程日（不含 cgroup/真实大负载基准）。P2.1 可独立合并，风险最低。

## 13. 风险与未决

### 13.1 风险

1. **R1 DSH 内部进程管理未知**（I1）：工具可能 `setsid` 逃出组；P2 只能 best-effort，
   P3 cgroup 才根治。缓解：marker 扫描 + 文档明说。
2. **R2 resume 拒绝不可稳定识别**（I2）：可能只能报 `nonzero_exit`；不猜、不自动 fresh。
   需要 DSH 上游提供 typed error，或实现轮做实验后写死明确标记。
3. **R3 Python 依赖**：目标机器可能没有 python3。0.7.0 的 web shim 已是 Python，风险可接受；
   启动前 `command -v python3` 检查，缺失 → `execution_backend_unsupported`。
4. **R4 tmux 环境快照**：tmux server 在启动时继承 daemon 环境；之后在 daemon 环境里新增/轮换的
   key 不会自动进入已有 tmux server。P2 的选择是诚实报 `execution_credential_missing`，
   由操作员重启 tmux server 或重建 seat；P4 若要热轮换，需要另做凭据 broker，不在本轮。
5. **R5 双重墙钟**：runner budget 与 shim timeout 可能同时触发；已定优先级（budget 优先），
   但实现轮要测竞态。
6. **R6 `ps` 数据陈旧**：runner 崩溃后 sidecar 可能停留在 `running`；启动对账负责修正，
   `ps` 自己不做进程扫描。用户可能短暂看到 stale；文档写清。
7. **R7 安全边界误解**：isolated 不是 sandbox；agent 仍可访问文件/网络。文档与 CHANGELOG 必须写
   “lifecycle/resource boundary, not a security boundary”。
8. **R8 平台差异**：macOS 没有 `/proc`；Windows 不支持。P2 的验收以 Linux 为主，
   macOS 只保证 POSIX 组 kill；Windows fail closed。

### 13.2 未决（需要 owner 决定，先按默认继续）

| # | 问题 | 默认选择 | 影响 |
| --- | --- | --- | --- |
| Q1 | 计划说默认 shared-web，当前树默认 headless；0.7.0 到底承诺哪个？ | **保持当前 headless/`inherit`** | 若要改默认，是 breaking，需单独轮次 |
| Q2 | 计划提 `credential_file`/`env_file`，与“凭据只走环境变量”冲突 | **只支持 runner 环境变量**；不写文件 | 需要文件凭据/热轮换的部署要改 systemd/launchd 并重启 tmux server |
| Q3 | resume 被拒时是否自动 fresh？ | **不自动**，保留 token，要求显式 `--fresh` | 用户体验差一点，但避免重复副作用 |
| Q4 | `isolated` 是否允许交互 seat？ | **允许但不推荐** | 交互 seat 失去 Web 可见性 |
| Q5 | rig 级 `isolated` 模板是否算“死配置”？ | **允许模板**；member 自己写才严格校验 | 方便统一默认 |
| Q6 | 实例记录保留几个 turn？ | **每 turn 一个文件，最近 5 个/seat** | 诊断与磁盘的折中 |

## 14. 不做什么（再次显式）

1. 不实现 cgroup、systemd scope、CPU/内存硬限制（P3）。
2. 不做容器/VM/nsjail/gVisor，也不把 isolated 宣传成安全隔离。
3. 不做 Web UI 侧栏映射、不做 DSH Web 的只读镜像。
4. 不做 `auto` backend、按任务长度切换、跨 host 调度。
5. 不做 Windows 原生实现；非 POSIX fail closed。
6. 不改 DSH 事件协议、不改 budget 默认值、不改 provider 限流、不改 transcript 默认值。
7. 不新增 `rig execution` 命令；观测走 `ps` + `capture`/`transcript`。
8. 不把 `execution` 写进 `env:` 或 `rig up --env`；凭据只走 runner 环境 + 名字声明。

## 15. 参考

- 计划：[seat-load-isolation-and-resource-budgets-plan.md](seat-load-isolation-and-resource-budgets-plan.md) §3、§6 P2、§7。
- 当前双路径：[dsh-execution-paths.md](dsh-execution-paths.md)。
- 预算/准入：[seat-admission-and-task-budgets.md](seat-admission-and-task-budgets.md)。
- 资源观测：[host-resources.md](host-resources.md)。
- 代码锚点：`packages/daemon/src/adapters/cli-agent/`、`packages/daemon/src/domain/ps-resources.ts`、
  `packages/daemon/src/domain/rigspec-schema.ts`、`packages/daemon/assets/dsh/dsh-web-shim.py`。
- 测试锚点：`packages/daemon/test/dsh-event-protocol.test.ts`、`packages/daemon/test/dsh-web-shim.test.ts`。
