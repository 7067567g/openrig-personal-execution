# 座位负载隔离与资源预算 — 下版本计划

状态：proposal，部分已落地。P0（DSH shim 入库 + 协议测试）与 P1（准入/预算/toolchain/
provider/transcript/ps --resources）已在 0.7.0 发布；P2–P4 未实现。已发布行为以
[whats-new.md](whats-new.md) 和 `CHANGELOG.md` 的 0.7.0 段为准，本页保留原始提案与未实现部分。  
P2（`execution.backend=isolated`）详细设计：[execution-backend-isolated.md](execution-backend-isolated.md)（proposal，未实现）。  
关联：ROADMAP 的 **A host-aware resource budget for seats (#80)**。  
范围：DSH runtime 优先；OpenCode/Claude/Codex/Pi 只预留接口，不在首批强行实现。

## 1. 背景

当前本机实践里，多个 OpenRig seat 并不是独立执行进程，而是通过
`dsh-web-shim` 共用同一个 DSH Web 实例（默认 `127.0.0.1:3080`）。结果是：

- 4 个 seat 共享一个 Node.js 事件循环和一套会话/工具服务；
- OpenRig daemon 本身很轻，但 DSH Web 会被多路 agent 同时推高；
- OpenRig 的 `rig ps --resources` 只观测负载，不施加 CPU/内存限制；
- 当前所有相关 systemd scope 都是 `CPUQuota=infinity`、`MemoryMax=infinity`；
- 一个 seat 跑重任务时，其他 seat 和交互 UI 会一起变慢。

实测（2026-10-22，20 核 / 30 GB）：

- 4 seat 同时运行；
- 系统 load 约 2.2，按每 CPU 约 0.10，远未饱和；
- DSH Web 约 37% 单核、约 1 GB RSS；
- CPU pressure 为 0，I/O 只有轻微等待；
- 因此瓶颈不是 CPU 总量，而是共享进程、模型并发、长上下文和 UI 渲染。

## 2. 目标与非目标

### 目标

1. 交互任务和后台重任务可以走不同的执行后端，避免互相拖慢。
2. 每个 seat 可以有硬资源上限，至少覆盖整个 agent 进程树。
3. 资源上限可观测、可诊断，失败时不会静默重启成死循环。
4. 保持现有 shared-web/UI 用法可用，不做破坏式替换。
5. 方案能逐步落地：先并发/预算，再隔离，再 cgroup。

### 非目标

- 不让 OpenRig 变成 Kubernetes/容器编排器。
- 不在第一版做全局 CPU 超卖调度或跨主机动态迁移。
- 不保证所有 runtime 都支持硬限制；非 Linux 平台必须明确降级。
- 不用资源限制代替模型调用超时、任务队列和人工审批。

## 3. 方案 A：DSH 执行后端隔离

### 3.1 配置形态（建议）

在 rig 或 seat 上增加：

```yaml
execution:
  backend: shared-web       # shared-web | isolated
  # isolated 时按任务/seat 启动独立 DSH 进程
```

规则：

- 默认保持 `shared-web`，兼容现有网页 UI 和会话可见性。
- 后台 worker、研究、构建、QA 等 seat 建议 `isolated`。
- 交互 seat 保持 `shared-web`，继续在 DSH Web 中可见。
- 后续可支持 `auto`：任务短/交互式走 shared-web，长任务走 isolated。

### 3.2 实现要点

1. 把宿主 scratch 里的 `dsh-web-shim` 迁入仓库并版本化。
   - 当前它在宿主临时目录，重启会丢，是 P0 稳定性问题。
   - 建议位置：`packages/daemon/src/adapters/dsh/` 或 `scripts/runtime/`。
2. 增加 `dsh-headless-shim` 或 adapter 分支：
   - 每个 seat 独立进程执行 `dsh --profile headless --json`；
   - 解析 NDJSON：`session`、`status`、`final`；
   - 捕获并持久化 `session-id`，支持 resume；
   - 超时、取消、退出码、stderr 映射到 OpenRig 的 runner state；
   - 不能让 shim 自己变成无限重试循环。
3. 凭据传递：
   - 当前 headless DSH 需要 `DEEPSEEK_API_KEY`，而 shared-web 是借用 DSH Web 的凭据。
   - 增加 `credential_file` / `env_file` 或一个受控 credential resolver；
   - **不要在 rig YAML、日志、事件 payload 中放密钥**；
   - 文件权限、进程环境和 `rig ps` 输出都要脱敏。
4. UI/可见性取舍：
   - isolated 任务不会自动出现在 DSH Web 的侧栏；
   - 必须提供 transcript / session-id / `rig capture` / 明确的 resume 命令；
   - 在 `rig ps --nodes` 显示 `backend` 和 session 身份，避免“找不到会话”。
5. 清理和生命周期：
   - seat 停止时杀掉整个 headless 进程树；
   - 防止孤儿子进程；
   - 保留现有 snapshot/restore 语义。

### 3.3 难度与风险

难度：**中高**，首版约 5–10 个工作日（不含大规模 UI 工作）。

主要风险：

- headless DSH 的 NDJSON 事件形状可能随 DSH 版本变化；
- resume token/session id 的持久化必须和现有 runner state 机制对齐；
- 凭据不能通过命令行或 YAML 泄漏；
- 每个任务多一次 headless 启动开销，后台任务可接受，短交互不适合默认走 isolated；
- isolated 后失去 Web UI 可见性，必须补可观测入口。

## 4. 方案 B：每 seat 的 cgroup 资源预算

### 4.1 配置形态（建议）

```yaml
resources:
  cpu_quota_percent: 200     # 200% = 最多 2 个核
  memory_max_mb: 4096        # 4 GiB
  memory_high_mb: 3584       # 可选软水位
  tasks_max: 512
  io_weight: 100             # 可选，cgroup v2
```

优先级：seat override > rig default > 实例默认 > 不限制。

### 4.2 实现方式（Linux）

优先使用 cgroup v2 + systemd user scope：

```bash
systemd-run --user --scope \
  -p CPUQuota=200% \
  -p MemoryMax=4G \
  -p MemoryHigh=3584M \
  -p TasksMax=512 \
  -- <agent command>
```

关键：限制必须作用在整个 seat 进程树上（tmux 内的 runner 及其子进程），不能只限制
`dsh` 的父进程 PID。

建议同时使用：

- `MemoryHigh` 做软水位、`MemoryMax` 做硬上限；
- `MemorySwapMax=0`（或很小的值），避免 seat 用 swap 拖垮整机；
- `MemoryOOMGroup=yes`，让 OOM 作用于整个 seat group，而不是随机杀一个子进程；
- `CPUWeight` 做后台 seat 的相对优先级，`CPUQuota` 做失控硬上限；
- 需要时再加 `IOWeight` / `IOReadBandwidthMax` / `IOWriteBandwidthMax`；
- 监控 `/proc/pressure/{cpu,io,memory}` 与 `systemd-oomd` 状态。

本机 spike（systemd 259，cgroup v2，systemd-oomd active）：

- `systemd-run --user --scope --collect -p CPUQuota=20% -- node ...` 可用；
- 在 tmux pane 里，`pane_current_command` 仍是 `node`，没有变成 `systemd-run`；
- 但这是单机、单版本观察，不能替代跨 systemd 版本/发行版验证。

### 4.3 与 OpenRig 的接点

建议在 `CliAgentRuntimeAdapter.launchHarness()` 之前引入一个
`SeatResourceController`：

- `prepareSeatScope(seat, resources)` 创建或绑定 scope；
- `wrapLaunch(command, scope)` 保证最终 agent 在该 scope 中；
- `describeSeatScope(seat)` 返回 scope 名、是否生效、当前用量；
- `releaseSeatScope(seat)` 在 stop/relaunch/cleanup 时回收。

需要特别验证：tmux pane 前台命令是否仍是 agent runner。当前 send guard / readiness
依赖前台可观察进程；如果 `systemd-run` wrapper 留在前台，会重演“pane 显示 sh”问题。
备选路径：

1. 先创建 scope，再把已启动的 pane 进程迁入 scope；
2. 直接对 OpenRig 已创建/发现的 `tmux-spawn-*` scope 执行 `systemctl set-property`；
3. 增加 wrapper-aware 的 native process lineage 识别；
4. 最差才接受 wrapper 前台，并调整 send guard。

### 4.4 运行状态与失败语义

必须新增：

- `rig ps --resources` 显示每 seat 的 `limit`、`current`、`peak`、`enforced_by`、`scope`；
- 识别 OOM kill（常见 exit 137）、CPU throttling、`TasksMax` 导致的 fork 失败；
- 失败状态进入 `attention_required` 或 `resource_exhausted`，不能无限自动重启；
- 默认不配置硬限制，先提供 opt-in，避免升级后把现有长任务直接 OOM。

### 4.5 平台边界

- Linux + systemd user manager + cgroup v2：完整支持。
- WSL2：只有启用 systemd 且 cgroup 可用时才支持；否则明确显示 unsupported。
- macOS：没有等价 cgroup；第一版可只提供 `nice`/软 QoS 提示，不承诺硬限制。
- 容器/受限 CI：检测失败时不得静默忽略；显示 `not_enforced` 并允许回退。

### 4.6 难度与风险

难度：**中高**，约 1–2 周。

主要风险：

- `systemd-run` wrapper 会破坏 OpenRig 的 pane/runner 观测；
- 用户级 systemd 可用性、cgroup delegation、WSL/容器差异；
- 过低 `MemoryMax` 可能让 Node/DSH 直接 OOM，需要保守默认和清晰诊断；
- 硬限制只防止失控，不能提升模型吞吐；
- 若在 daemon 侧统一 limit，会误伤所有 seat，必须坚持每 seat scope；
- 需要 Linux 专用集成测试（CPU 打满、内存分配、子进程计入、退出码、清理）。

## 5. 方案 C：并发与任务预算（应先做）

在 A/B 之前先做低成本控制：

- 全局/rig 级 `max_concurrent_turns` 或信号量；
- 队列而不是立即启动所有 seat；
- 每任务预算：
  - `max_wall_time`
  - `max_steps`
  - `max_tool_calls`
  - `max_tokens`
  - `max_retries`
- daemon 计算 seat 预算：按 host CPU/内存、活跃 seat 数、seat 权重/角色动态计算，
  再投影到工具链环境和 `nice`/`CPUWeight`；不要只写死每 seat 配额。
- 工具链并发预算：把统一预算投影到常见环境变量，避免每个 build/test 默认吃满机器：
  `CARGO_BUILD_JOBS`、`RUST_TEST_THREADS`、`MAKEFLAGS=-jN`、
  `CMAKE_BUILD_PARALLEL_LEVEL`、`UV_CONCURRENT_BUILDS`、
  `NPM_CONFIG_JOBS` / `UV_THREADPOOL_SIZE` 等。
- transcript capture 降成本：后台无人看 UI 时提高 `transcripts.poll_interval_seconds`、
  降低 `transcripts.lines`，或按 seat 关闭/降频；当前实测 4 个旋转 seat 为
  2s active / 3s idle，capture 本身也有 tmux/client 成本。
- provider 级并发和速率限制：DeepSeek/OpenAI/Claude 等 provider 各自加
  semaphore / token bucket，避免把本机并发放大成 API 429 或排队。
- 交互 lane 优先，后台 lane 可排队；
- 触发预算后终止并上报，不静默重试。

难度：**中低**，约 3–5 个工作日。  
收益：比 cgroup 更快见效，且不需要先解决 systemd wrapper 问题。

## 6. 建议的交付顺序

### P0（稳定化，0.5–1 天）
- 把宿主临时目录里的 `dsh-web-shim` 迁入仓库；
- 固定 DSH 版本/事件协议测试；
- 记录 shared-web 与 headless 两条路径。

### P1（1–2 周）
- 并发上限 + 任务预算 + 队列；
- 工具链并发环境变量投影 + provider 级限流；
- 调低 transcript capture 频率/行数（无人看 UI 时优先）；
- `rig ps --resources` 增加每 seat 的当前用量和 backend；
- 先解决“4 路一起跑但 UI 卡”的 80% 问题。

### P2（1–2 周）
- `execution.backend = isolated`；
- headless DSH shim、凭据传递、resume、清理；
- 先只对后台 worker 开启。
- 详细契约：[execution-backend-isolated.md](execution-backend-isolated.md)（proposal，未实现）。

### P3（1–2 周）
- cgroup 资源预算；
- Linux e2e 验证 + 失败状态 + resource observability；
- 非 Linux 明确降级。

### P4（后续）
- 基于 host pressure / DSH 队列长度的自动 admission；
- build-heavy seat 的共享 GNU make jobserver / token pool；
- 更细的模型/token 预算；
- 多 host 资源调度。

## 7. 验收标准

- 4 个 seat 并发时，交互 seat 不被后台重任务拖到不可用；
- 至少 2 个后台 seat 可走独立进程，互不共享 DSH Web event loop；
- 超过 `cpu_quota_percent` 时被 cgroup 节流，而不是把整机带慢；
- 超过 `memory_max_mb` 时行为可诊断（OOM/attention），不是静默消失；
- `rig ps --resources` 能显示 limit、当前用量、是否实际生效；
- unsupported 平台显示原因，不假报 “limited”；
- 所有凭据不进入 rig spec、事件、日志或 `rig ps` 输出。

## 8. 待决问题

1. 默认是否保持 shared-web？建议是；isolated 作为后台 seat 的显式选择。
2. isolated 任务是否需要可选的 DSH Web 只读映射？
3. `memory_max_mb` 是对整个 cgroup 还是只对 DSH 进程？建议整个 seat scope。
4. cgroup property 是否允许来自 bundle/rig spec？建议只允许白名单字段，并由实例策略校验。
5. CPUQuota 的默认值：建议不限制，文档给出 200%/400% 参考值，由用户显式开启。

## 9. 成熟方案调研与取舍

| 方案 | 是否成熟 | 适合本项目的点 | 不适合/风险 |
|---|---:|---|---|
| systemd scope/slice + cgroup v2 | 高 | 本机 Linux 最直接；CPU/memory/pids/io/oom 都能覆盖整个进程树 | Linux/systemd 依赖；wrapper/前台识别、用户 cgroup delegation、WSL/容器差异 |
| Podman/Docker rootless | 高 | 每 seat 一个容器，资源限制 + 文件/网络更强的隔离；cgroup 语义成熟 | 镜像/挂载/凭据/端口/DSH 依赖管理复杂；持久终端和 resume 更重；macOS 实际仍走 VM |
| Kubernetes Job/Pod | 非常高 | 资源 requests/limits、配额、TTL、重试、隔离都成熟 | 对单机桌面过重；需要集群/容器运行时；交互式 seat 和快照恢复不是它的强项 |
| Nomad | 高 | 比 k8s 轻，任务资源限制和调度成熟 | 仍需要集群/agent；DSH 交互式 tmux/restore 需要额外适配 |
| Ray | 高 | Python 任务/actor 资源调度、并发控制 | 主要是调度层；不等价于对任意 CLI agent 的 cgroup 硬限制 |
| Temporal / Prefect / Dagster / Celery | 高 | 队列、并发上限、重试、持久工作流 | 不负责 CPU/内存硬隔离；接入后还要 systemd/容器层 |
| nsjail / bubblewrap / firejail | 中高 | 进程沙箱、seccomp/namespace；部分支持 cgroup | 安全模型复杂；bubblewrap 本身不做资源配额；firejail 的 setuid 模型有限制 |
| gVisor / Firecracker / Kata | 高（但重） | 不可信代码的强隔离 + 资源边界 | 启动/运维成本高；对本地开发者 agent 可能过重 |
| OpenRig #80 host-aware budget | 设计已有 | 已提出 daemon 计算 seat 预算、导出工具链 env、权重、transcript 成本 | 截至当前仍 open；不要重复设计，应该向上游方向对齐 |

**结论：**

- 第一版不引入容器/VM；用 systemd scope 做本机硬限制，用调度器做并发/预算，是最小可行路径。
- 如果以后需要“不可信 agent 的强隔离”，再评估 Podman/nsjail/gVisor/Firecracker，而不是把 cgroup 当安全边界。
- OpenRig 上游 #80 的方向（host-aware budget + toolchain env + priority + transcript 成本）
  比单纯加 cgroup 更全面，应该合并到同一 roadmap。

## 10. 容易漏掉的点

1. **cgroup 限的是资源，不是安全边界**：被限制的 agent 仍可访问文件/网络；如果 agent 有 root，可改 cgroup 或绕过限制。不要把 cgroup 当 sandbox。
2. **OOM 可能只杀一个子进程**：默认 OOM killer 可能杀 runner 的某个 child，留下半死 runner；建议 `MemoryOOMGroup=yes`，并把 OOM 映射为 `resource_exhausted`。
3. **CPUQuota 不等于优先级**：它会让慢任务更慢；后台 seat 更适合低 `CPUWeight`/`nice`，CPUQuota 只用于防失控。
4. **工具链自己会开满并发**：cgroup 限制 CPU 后，cargo/make/pytest/npm 仍会创建大量线程，导致 TasksMax/OOM；必须同时导出工具链并发变量。
5. **transcript capture 是隐藏成本**：当前 4 seat 每 2–3 秒 capture 一次；无人看 UI 时应降频/降行数，甚至考虑关闭。
6. **provider 层限流缺失**：本机 4 并发可能对应远端 4 倍 token/请求峰值；需要按 provider/model 做 semaphore/token bucket。
7. **交互 lane 与后台 lane 必须分开**：只限总并发仍可能让长任务占满，交互请求必须能抢占或保留槽位。
8. **不要静默降级**：没有 cgroup/systemd 时必须显示 `not_enforced`，否则用户会误以为有硬限制。
9. **默认限制要保守**：Node/DSH 会话可能短时占很多内存；默认不限制或给较宽上限，避免升级后直接 OOM。
10. **要测子进程树**：只测 parent RSS 会漏掉 bash/toolchain 的内存；必须测 cgroup 整体，包括 fork 出来的 worker。
11. **scope 生命周期和清理**：异常退出、daemon 重启、seat relaunch 都可能留下孤儿 scope/process；需要 `--collect`、显式 stop、启动时清理。
12. **跨平台差异**：macOS 无 cgroup；WSL2 的 systemd/cgroup 可能不完整；容器 CI 可能没有 cgroup delegation。

## 11. 本地验证记录（2026-10-22）

- systemd 259，cgroup v2 controllers：`cpuset cpu io memory hugetlb pids rdma misc dmem`
- `systemd-run --user --scope --collect -p CPUQuota=... -- node ...` 可启动
- `systemd-oomd` active
- 当前 OpenRig `tmux-spawn-*` scope 均为 `CPUQuota=infinity` / `MemoryMax=infinity`
- `rig ps --resources` 当前只有观测数据，没有配额
- OpenRig #80 仍 open；PR #556 已交付 host resource visibility + adaptive transcript capture，
  不包含 CPU 配额或 build jobserver

## 12. DSH/OpenCode 与替代架构（2026-10-22 补充）

### 12.1 先纠正“谁更省内存”的假设

不能只凭 runtime 名字判断内存：

- 当前实测快照（样本不等价）：
  - `dsh web` RSS 约 830 MB，已运行约 1 小时，承载过多个会话；
  - `opencode-cli serve --service` RSS 约 216 MB，主要是空闲后台服务。
- 这不是同 workload 对比：DSH 进程包含了 Web UI/会话/工具/上下文服务；OpenCode 样本没有在跑等价 agent。
- OpenCode 的 `run --standalone` 会启动私有 server，可能比共享后台服务更隔离，但启动/内存成本也会上升。
- DSH/OpenCode 都可能因长上下文、附件、LSP/MCP、工具输出、截图、子进程而出现内存峰值。

**结论：** “换 OpenCode”本身不是解决方案；真正的变量是：

1. 共享 server 还是每 worker 独立进程；
2. 同时运行多少 agent；
3. 上下文/附件/工具输出有多大；
4. 是否保留了长时间空闲 seat；
5. 是否有 cgroup 和任务预算。

### 12.2 需要补的基准测试

用相同 repo、相同模型、相同任务分别测：

| 变量 | 建议取值 |
|---|---|
| runtime | DSH headless / DSH shared-web / OpenCode standalone |
| 并发 | 1 / 2 / 4 |
| 任务 | 纯问答 / 10 次工具调用 / 长文件分析 / 截图或附件 |
| 指标 | 墙钟 P50/P95、cgroup `memory.peak`、CPU throttling、事件循环/UI 延迟、失败率 |

输出才能回答“DSH 和 OpenCode 谁更适合这个工作流”，而不是用 idle RSS 下结论。

### 12.3 其他解决方向

#### A. 队列 + worker pool（推荐）
- 不再“每个角色常驻一个 seat 等任务”；
- 建 2–3 个 worker，任务入队，worker 顺序领取；
- 每个 worker 可复用 session，空闲时不保留四个大上下文；
- 交互动作用独立 lane，保证有槽位。

适合：角色多、任务量波动大、用户不盯 UI 的场景。

#### B. 单 orchestrator + 短生命周期 subagent
- 一个 orchestrator 维护工作流状态；
- 每个阶段启动一个 subagent，完成后退出；
- 上下文通过磁盘 artifact/结构化摘要交接，不靠巨型 prompt；
- 失败重试只重跑当前阶段。

适合：archivist → critic → architect → QA 这种有明确阶段的流程。  
代价：需要设计清晰的输入/输出契约和重试语义。

#### C. 分阶段串行/有限并行
- 当前四个角色不必同时跑；
- 先串行验证 1 个流程，再只并行真正独立的阶段；
- 例如 evidence 和 initial architecture 可并行，critic 依赖两者，QA 最后。

这通常比“4 个 seat 全部常驻”更省资源，也更容易定位慢点。

#### D. 异构 runtime
- DSH：高层规划、审查、长上下文推理；
- OpenCode：代码修改、构建、测试；
- 脚本：文件扫描、格式转换、确定性检查。

把每类任务放到最合适的 runtime，而不是所有任务都塞进同一个 agent。

#### E. 外部化记忆
- 长报告、日志、工具输出落盘；
- agent 只拿摘要 + 文件引用；
- 定期 compaction、裁剪工具结果；
- 限制图片/截图/附件直接进入上下文。

内存峰值很多时候不是 runtime 本身，而是上下文和附件规模。

#### F. 分离控制面与执行面
- 控制面：队列、角色、状态机、预算、日志；
- 执行面：无状态/短生命周期 worker；
- 执行面可以独立重启、限流、扩缩容，不拖累控制面。

#### G. 容器/微虚拟机
- 只有在需要“安全隔离/不可信代码”时才考虑；
- 对当前本地可信 agent，systemd cgroup + worker pool 的收益/成本比更高。

### 12.4 对当前 workflow 的建议

第一阶段不要直接上四个常驻 seat。建议：

1. 保留一个 DSH 交互 seat（轻量、可随时看）；
2. 后台建 2 个 worker 槽位；
3. archivist/critic/architect/QA 改为队列任务；
4. 产物只通过 `runs/<id>/reports/` 和摘要交接；
5. 先测 1 个 worker / 2 个 worker 的 P95；
6. 最后再决定是否需要 3–4 个并发，以及是否切 OpenCode。

### 12.5 初步基准：DSH / OpenCode / DSH 修枝

2026-10-22 在空 `/tmp` 目录、同一简单提示词（“只回复两个字：收到”）、
非严格同模型/同工具集条件下，单次测量的结果如下。样本量很小，不能当作
生产容量结论，但足以说明“换 runtime”不应靠直觉拍板。

| 方式 | 墙钟 | Max RSS | 备注 |
|---|---:|---:|---|
| DSH `--profile headless --json` | 4.5s | 381 MB | 完整 headless 插件面 |
| DSH `worker-bench`（禁用部分可选插件） | 3.2s | 386 MB | 38 个可选 entry 被 disable；RSS 没有明显下降 |
| OpenCode `run --standalone --format json` | 4.2s | 330 MB | 私有 server；简单提示词 |

观察：

1. **DSH 和 OpenCode 的单 worker 基础内存都在 300–400 MB 量级**，OpenCode
   在这一个样本里低约 13%，但没有数量级差异。
2. **DSH 的“修枝”并没有立刻降低 RSS**。Node/runtime 基座、模型客户端、会话
   和工具基础设施占了大头；禁用几十个插件主要可能改善启动时间和工具面，
   而不是把 380 MB 变成 150 MB。
3. 真正的容量差异来自：
   - 共享一个长期 Web 进程 vs 每 worker 独立进程；
   - 同时保留多少个上下文/附件/会话；
   - 是否让空闲 seat 常驻；
   - 任务上下文和工具输出是否失控。
4. 因此“做 workflow 特化轻量版”仍然有价值，但成功标准应该是：
   - 启动更快；
   - 工具 schema/提示面更小；
   - 权限面更小；
   - 可测试、可维护；
   - **不要把“内存降低 50%”作为未经验证的前提。**

### 12.6 对“多并发还是队列”的结论

这两个不是互斥选项：

- **队列 + bounded worker pool** 本身就是多并发；
- 例如 `queue + 4 workers` 仍然可以 4 路并发；
- 单 seat 常驻四个角色，只是“无限期占着槽位”，不等于更高性能。

建议把目标定义为：

```text
max_workers = 2..4（先测再调）
max_active_turns = 2..4
per_provider_concurrency = 独立限流
per_task_budget = 时间/步数/token/工具调用
```

这样可以在 DSH、OpenCode 或混合 runtime 之间切换，而不让并发模型绑死在
某一种 runtime 上。

