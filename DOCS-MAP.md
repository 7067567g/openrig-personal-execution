# DOCS-MAP — OpenRig 源码仓文档入口

> **这是源码开发面（`10-openrig-deepseek`）的本地地图。**
> 跨仓总图在 [KB workflow-group/docs/openrig](../../deepseek-知识库/workflow-group/docs/openrig/README.md)；
> 用户/运维文档在 [usage 仓 DOCS-MAP](../../openrig-custom-complete-usage/DOCS-MAP.md)。
> 更新时间：2026-11-15

## 1. 先确定你在做哪类事

| 你在做什么 | 读这个 | 不要从这里开始 |
| --- | --- | --- |
| 装起来、跑第一个 rig | [`docs/reference/getting-started.md`](docs/reference/getting-started.md) | `packages/cli/README.md` |
| 查命令/字段/配置语义 | [`docs/reference/`](docs/reference/README.md)（按主题）+ `rig <cmd> --help` | usage 仓示例 |
| 改某个模块、找代码归属 | [`docs/as-built/README.md`](docs/as-built/README.md) | `docs/releases/v0.1.x.md` |
| 看架构总览与模块边界 | [`ARCHITECTURE.md`](ARCHITECTURE.md) → `docs/as-built/architecture/*` | 根 `README.md` 的安装段 |
| 看某个版本改了什么 | [`docs/releases/README.md`](docs/releases/README.md) | 根 `README.md` |
| 看最近案例/经验 | usage [case 04](../../openrig-custom-complete-usage/docs/cases/04-multi-repo-docs-governance.md)、[case 05](../../openrig-custom-complete-usage/docs/cases/05-openrig-rework-loops.md)；[ideas](../../openrig-custom-complete-usage/process/ideas/2026-11-openrig-ideas.md) | 把案例当源码事实 |
| 贡献 / 跟进上游 | [`CONTRIBUTING.md`](CONTRIBUTING.md)、[`docs/reference/fork-and-upstream.md`](docs/reference/fork-and-upstream.md) | `packages/cli/README.md` |
| 给 agent 配"开发 OpenRig"技能 | [`.agents/skills/developing-openrig/SKILL.md`](.agents/skills/developing-openrig/SKILL.md)（`.claude/` 下同内容） | 根 `skills/`（运行期技能套件） |
| 查归档证据 | `var/openrig-archive/MANDATORY.md`（**只读**） | 把归档规则当运行规则 |

## 2. `docs/` 四个子域的分工（最容易混的地方）

| 子域 | 是否随包发布 | 讲什么 | 权威性 |
| --- | --- | --- | --- |
| `docs/reference/` | **是**（`scripts/build-package.sh` 暂存到包内，运行时落到 `$OPENRIG_HOME/reference/`） | 面向用户/操作员的参考：安装、命令、运维 | 行为与代码冲突时以代码为准 |
| `docs/as-built/` | **否** | 面向开发者的 as-built：模块、代码归属、测试层 | 每页带 `last-verified-against-source` |
| `docs/releases/` | **不随包**（`scripts/build-package.sh:133-136` 只把 `docs/reference/` 暂存进 `packages/cli/daemon/docs/reference/`） | 各版本发布说明（v0.1.x），随版本对外发布 | **历史事实**，不代表当前行为 |
| `DESIGN.md` | 随仓 | 设计取舍 | 非规范 |

**两条硬边界**：

1. `docs/reference/README.md` 在 `packages/cli/daemon/docs/reference/README.md` 有一份**逐字节副本**（发版暂存）。**改源头，不要改副本**；副本由构建刷新。
2. `docs/as-built/architecture.md` 的 frontmatter 是 `status: superseded`，只为兼容旧链接而存在。当前模块请从 [`docs/as-built/README.md`](docs/as-built/README.md) 进。

## 3. 包内与技能目录

| 路径 | 说明 |
| --- | --- |
| `packages/*/README.md` | **3 个**（本行 glob 的计数）。`packages/cli/README.md` 是**项目落地页的近重复副本**（比根 README 少「本地私有线 + 使用仓地址」那几行），**不是**开发入口 |
| `skills/` | 运行期技能套件（`_canonical/`、`rigs/`），不是"怎么开发 OpenRig"的文档 |
| `.agents/skills/`、`.claude/skills/` | agent 技能；`developing-openrig/SKILL.md` 两份必须同步（当前同 sha256） |
| `test/`、`scripts/` | 测试与检查脚本；`scripts/check-docs-guard.mjs`、`check-docs-facts.mjs` 是文档门禁 |

## 4. 不要从这里开始

- ❌ `packages/cli/README.md` 当项目入口 —— 它是落地页副本，缺"本地私有线 + 使用仓地址"这 3 行。
- ❌ `docs/releases/v0.1.x.md` 当当前行为 —— 那是历史发布事实。
- ❌ `var/openrig-archive/**` 当现行规则 —— 79M 历史归档，`MANDATORY.md` 只约束归档本身。
- ❌ 把 [usage 仓](../../openrig-custom-complete-usage/DOCS-MAP.md) 的示例当源码事实 —— 它是 sanitized 示例。
- ❌ 在 `packages/cli/daemon/docs/reference/` 里改文档 —— 那是构建暂存副本。

## 5. 文档门禁（改完必跑）

```bash
node scripts/check-docs-guard.mjs   # 结构/引用守卫
node scripts/check-docs-facts.mjs   # 事实漂移检查（0 drift 才算过）
```

两者都必须以**无管道退出码**记录：`cmd > /tmp/out 2>&1; echo $?`。

## 6. 跨仓

- 跨仓总图：[`workflow-group/docs/openrig/README.md`](../../deepseek-知识库/workflow-group/docs/openrig/README.md)
- 使用/运维面：[`openrig-custom-complete-usage/DOCS-MAP.md`](../../openrig-custom-complete-usage/DOCS-MAP.md)
- 控制面规则：[`workflow-group/WORKFLOW.md`](../../deepseek-知识库/workflow-group/WORKFLOW.md)

## 7. 本页数字的复跑命令

> 在本仓根目录执行。命令放在围栏块里：表格单元格中的 `|` 会被 GFM 切成列。

```bash
# 3 个 packages/*/README.md（本页该行的 glob 口径）
find packages -maxdepth 2 -name README.md | wc -l

# 根 README vs 包内 README 的差异行数（2026-11-15T12:34:44Z 实测 5 行）
# 该数随两文件变动而变，以本行命令的当前输出为准
diff README.md packages/cli/README.md | wc -l

# docs/releases 不随包：构建只暂存 docs/reference
sed -n '133,136p' scripts/build-package.sh
ls packages/cli/daemon/docs        # 只有 reference
```
