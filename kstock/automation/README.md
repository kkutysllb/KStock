# dsh-kylin-automation

**DSH 原生定时任务插件**：把可复用、可边界化的编码任务按时间计划投递到
**全新根 Agent 会话**独立执行，运行历史持久可审计。Web 侧边栏独立页面与
Agent 工具双入口管理。

**DSH native automation plugin**: dispatch reusable, bounded coding tasks to
**fresh root Agent sessions** on a schedule — once, fixed interval, daily, or
weekly — with durable, auditable run history. Managed from the web sidebar's
own page or by any Agent through six scoped tools.

参考 [titanwings/dsh-automation](https://github.com/titanwings/dsh-automation)
的产品模型，按 kcoder 0.1.6-alpha.1 框架能力原生重写（官方槽位注册、新版
工具契约、零 `@deepseek-ai/*` 运行时导入）。

## 安装 / Install

```bash
# npm registry（推荐：版本可被插件管理检测，用户手动更新）
# npm registry (recommended: version detection with manual updates)
dsh plugin --profile web add dsh-kylin-automation

# GitHub 直装（锁定版本 tag）/ install straight from GitHub at a tag
dsh plugin --profile web add github:kkutysllb/dsh-kylin-automation#v0.1.2

# 或从 dsh-plugins 镜像仓 / or from the dsh-plugins mirror monorepo
git clone git@github.com:kkutysllb/dsh-plugins.git
dsh plugin --profile web add ./dsh-plugins/dsh-kylin-automation
```

从源码安装 / install from a local checkout（Node.js ≥ 22.19）：

```bash
git clone git@github.com:kkutysllb/dsh-kylin-automation.git
cd dsh-kylin-automation
pnpm install && pnpm check        # typecheck + 47 tests + 双 bundle 构建
dsh plugin --profile web add /绝对路径/dsh-kylin-automation
```

安装后重启 `dsh web`（或 KCoder）生效。每个版本的变更说明见
[`release/`](release/)；`package.json` 的 `version` 是插件管理检测新版本的
信号，更新由用户手动触发。首次发布与发版流程（含 npm 发布步骤）见
[`release/README.md`](release/README.md)。

Restart `dsh web` (or KCoder) after installing. Per-version changes live
under [`release/`](release/); the `package.json` version drives update
detection, and the release process (including npm publishing) is documented
in [`release/README.md`](release/README.md).

## QiLin（麒麟）双通道适配（v0.1.2 起）

manifest 同时声明 `qilin` 与 `dsh` 两个通道的 `bundle.patch` / `client`：
QiLin（dsh 0.1.6-alpha.2 合并后）的插件管理器只认原生键
`qilin.bundle.patch`（缺失会报「没有声明组合包」），DSH 宿主仍读
`dsh.*`；两通道指向同一份 `cordis.patch.yml` 与 client 交付物，
行为完全一致。

## 麒麟（QiLin）引擎安装

```bash
# npm registry（推荐：版本可被插件管理检测，用户手动更新）
qilin plugin --profile qilin add dsh-kylin-automation

# GitHub 直装 / install straight from GitHub
qilin plugin --profile qilin add github:kkutysllb/dsh-kylin-automation
```

装完在 QiLin 设置 → 插件里可见、可启停；定时调度、Web 侧边栏任务页与
六个 Agent 工具随之生效；运行历史落宿主 home（storageDomain），随 QiLin
家目录迁移。

### 注意事项（QiLin）

- **必须经 `qilin plugin add` 装进 profile**：包会落到 profile 私有的
  `~/.qilin/profiles/<name>/node_modules`——裸包名原生解析的第一跳。
  **不要**手工把包目录放进共享的 `~/.qilin/profiles/node_modules`：
  dsh alpha.2 合并后的 runtime+enforce 解析把该目录划为安装保留区，
  放那里的 bundle 层包激活时直接 `failed to import`。
- **引擎版本**：运行需要带 dsh 兼容层的 QiLin 3.0.0+；插件**管理**
  （设置页展示/启停）要求 3.0.2+（alpha.2 合并后只认
  `qilin.bundle.patch` 原生键）。
- **运行时解析**：dsh alpha.2 起依赖解析默认运行时模式（PR #4471），
  插件运行期导入由 profile 安装图经进程内 generation 解析；引擎包按
  框架契约声明于 peerDependencies，由宿主安装副本统一解析。

## 快速开始 / Quick start

### 🖥️ 从 DSH Web / from DSH Web

1. 打开一个工作区里的会话（面板跟随当前会话定位工作区；创建任务时可自选绑定任意已注册工作区）。
2. 侧边栏点「定时任务 / Automations」。
3. 填写自包含任务、时间计划、时区、模型目标（跟随全局 / 钉住 provider+model+推理力度）、权限边界（只读 / 工作区可写）。
4. 先点「立即运行 / Run now」验证一次，再依赖调度。

Open a session in the target workspace, click the Automations sidebar entry,
fill in the self-contained task, schedule, zone, model target, and permission
boundary — then **Run now** once before relying on the schedule.

### 💬 让 Agent 管理 / ask an Agent

```
创建一个只读定时任务"工作日回归分诊"，周一到周五 09:30（Asia/Shanghai）运行：
检查本地测试证据，归类失败原因，在新会话里留下简短报告。不要修改文件。
```

| 工具 Tool | 用途 Purpose |
|---|---|
| `automation_create` | 创建绑定当前工作区的规则（缺省跟随全局模型；可钉住 provider/model/effort） |
| `automation_list` | 读规则、下次运行时刻与最近结果 |
| `automation_update` | 部分更新（仅单独暂停豁免人工审批） |
| `automation_run_now` | 以相同边界排队一次手动运行 |
| `automation_runs` | 读运行历史、错误、摘要与结果 Session id |
| `automation_delete` | 删除定义（运行历史保留） |

创建/更新/立即运行/删除会触发插件级人工审批——Agent 创建或扩大无人值守
未来工作需要人确认（**仅 status=paused 的单独暂停豁免**）。

Mutating verbs (create/update/run-now/delete) are escalated for human
approval; a pause-only update is exempt.

## 它解决什么 / why automations

DSH Core Schedule 是当前对话内的提醒工具（"十分钟后回到这个会话"）。
`dsh-kylin-automation` 处理另一件事："每个工作日独立跑一遍这个任务，
并给我留下可检查的结果。"

| | DSH Core Schedule | dsh-kylin-automation |
| --- | --- | --- |
| 执行上下文 Context | 回到同一个活跃 Agent | 全新根 Agent + 全新 Session |
| 输入 Input | 现有上下文里的追问 | 保存下来的自包含任务 |
| 范围 Scope | 当前会话 | 精确绑定一个工作区 |
| 历史 History | 会话事件 | 定义修订版 + 持久运行记录 |

## 特性 / Features

### 📅 人读得懂的时间计划 / readable schedules

一次性（ISO 时刻）/ 固定间隔（≥5 分钟）/ 每天 / 每周，daily/weekly 使用
IANA 时区本地 `HH:mm`；DST 不存在的墙面时间**跳过而不是平移**（luxon 求解）。

派发语义 / dispatch semantics：at-most-once（确定性 occurrence key + 持久
游标）· 宽限窗口（默认 15 分钟）内只补跑最新一个到期 occurrence · 同任务
重叠记 `skipped(overlap)` · 运行超时（默认 60 分钟）取消并记 `failed` ·
宿主重启把 queued/running 记 `failed(host_interrupted)`，绝不秘密重跑 ·
每任务终态历史保留上限 200（活跃记录永不裁剪）。

Once / interval (≥5 min) / daily / weekly with IANA zones; nonexistent DST
wall times are skipped, never shifted. Dispatch is at-most-once with a
misfire-grace catch-up of only the latest due occurrence; overlap, timeouts,
and host restarts are recorded, never replayed silently.

### 🧼 干净的执行边界 / a clean execution boundary

- 全新 Session + 全新根 Agent：不带来源会话的历史、收件箱、授权、过往审批；
- 两档权限 `read-only` / `workspace-write`；`approval policy = never`（fail closed）；
- 能力允许清单：bash/pwsh（禁后台进程）、读写检索、web、skill、会话检索；
  交互提问/计划/目标/嵌套 Agent/后台任务/递归自动化管理一律拒绝；
- 任务消息带 `source.kind = automation`（automation/run 身份 + 计划时刻），
  从不冒充人类消息；
- 无自动副作用重试——手动「立即运行」是唯一的重试。

A fresh Agent and Session with no inherited authority; two permission modes
only; an unattended tool allowlist enforced by an agent-scoped guard; explicit
`source.kind = automation`; no blind retries.

### 🧾 失败也被解释的历史 / history that explains failure

运行经历 `queued → running → succeeded / failed / skipped / cancelled`；每条
记录保留定义版本号、提示词与目标快照、计划时刻、结果 Session id、有界摘要
与结构化错误。更新定义递增 revision，历史运行仍能对上"当时执行的是什么"；
删除定义不抹掉运行记录。

Runs carry definition revisions, prompt/target snapshots, scheduled time,
result Session ids, bounded summaries, and structured errors — so a failed
run explains itself long after the definition changed.

### 🖥️ 双入口，一个控制面 / one control plane, two ways in

- **DSH Web**：侧边栏「定时任务」菜单项（官方 `sidebar.panellist` slot，
  shell 拥有按钮/Tooltip/active 态）→ 独立管理页面（官方 `main` keyed slot，
  不依赖会话视图）：任务列表、创建/编辑、暂停/恢复、立即运行、运行历史
  （状态/耗时/摘要/错误/跳过原因）、打开结果会话、跨工作区过滤。
- **任意根 Agent**：自然语言管理，六个工具只绑定调用者自己的工作区。
- 数据通道：`/dsh-kylin-automation` RPC 直挂注入的 webServer，复刻 connection
  传输语义（同一 Host/Origin + 浏览器鉴权围栏、client-request/server-response
  信封、4MB 体积上限）；zh/en 双语。

## ⚙️ 配置 / Configuration

bundle 自带 `cordis.patch.yml`（编辑部署 profile 的 bundle 行即可调整）：

| 选项 | 默认 | 含义 Meaning |
| --- | --- | --- |
| `maxConcurrentRuns` | `2` | 本 Host 全局并发执行闸 Global execution capacity |
| `runTimeoutMinutes` | `60` | 单次运行墙钟上限 Run wall-clock limit |
| `misfireGraceMinutes` | `15` | 停机补跑宽限 Catch-up grace window |
| `historyLimit` | `200` | 每任务终态历史保留 Terminal-run retention |

调大并发/超时等于扩大无人值守工作量，按策略决策对待。
Raising concurrency or timeout expands unattended work — treat it as policy.

## 🧰 好的自动化候选 / good automation candidates

| 任务 | 建议边界 | 为什么有用 |
| --- | --- | --- |
| 工作日回归分诊 Weekday regression triage | `read-only` | 检查测试证据、归类失败、留下诊断 |
| 每周仓库健康报告 Weekly repo health report | `read-only` | 陈旧 TODO、依赖清单、被忽略的失败 |
| 一次性验证 One-shot verification | `read-only` | 稍后复查不稳定失败并留档 |
| 生成代码刷新 Generated-code refresh | `workspace-write` | 重建已知产物、聚焦检查、报告精确 diff |
| 维护修复窗口 Maintenance fix window | `workspace-write` | 复现一个有界问题、最小修复、验收即停 |

强任务提示词说清：目标、要检查的证据、允许的改动、验收标准、停止条件。
避免"继续我们之前说的"或"把所有事都修了"——定时任务不继承创建它的对话。

A strong task states goal, evidence, allowed changes, acceptance, and stop
condition; scheduled runs do not inherit the conversation that created them.

## 🛡️ 计划不等于权限 / a schedule is not permission

无人值守编码需要比交互聊天更小的信任边界：无继承授权、两档权限、
fail closed 审批、精确工作区绑定（Agent 工具按调用者 cwd 解析；Web 创建
的 cwd 一律由服务端 registry 解析）、回环 RPC 围栏（isTrusted + 浏览器鉴权）、
可追溯来源（`source.kind = automation`）。用「立即运行」验证过再开启
无人值守写入。

Unattended coding needs a smaller trust boundary than interactive chat —
review every task with **Run now** before enabling unattended writes.

## 🚧 当前限制 / current limits (v0.1)

不做：同会话心跳（请用 DSH Core Schedule）、原生 cron、无人值守 full access、
运行结果确认/重试闭环、多工作区 DAG、外部投递（邮件/短信/推送）、外部副作用
的恰好一次保证；仅本地执行，运行依赖 DSH Host 进程存活。

Not provided: same-chat heartbeats, raw cron, unattended full access,
run-resolution confirm/retry loops, multi-workspace DAGs, external delivery,
or exactly-once external side effects. Only local execution; the DSH Host
must be running.

## 🧪 开发 / development

```bash
pnpm install
pnpm typecheck    # tsc 严格类型（exactOptionalPropertyTypes）
pnpm test         # 47 用例：recurrence/DST、domain、scheduler、rpc、client、tools
pnpm build        # esbuild Host ESM + Web client（__ModuleLoader__ 契约）+ 声明产物
pnpm check        # 三者串联
node scripts/smoke-plugin.mjs                  # 发布面契约冒烟（manifest/patch/bundle）
node scripts/create-github-releases.mjs        # release/*.md → GitHub Release 页
node scripts/sync-to-dsh-plugins.mjs --check   # dsh-plugins 镜像对账
```

## 📄 License

MIT。产品模式参考 [titanwings/dsh-automation](https://github.com/titanwings/dsh-automation)
（independent community plugin for DeepSeek Harness）。
