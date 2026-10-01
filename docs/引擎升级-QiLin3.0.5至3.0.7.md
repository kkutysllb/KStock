# QiLin 3.0.5 → 3.0.7 引擎升级：差异分析与实施计划

**Goal:** 把 KStock 内置的 vendored QiLin 引擎快照从 3.0.5（`10ed0a598`）升级到 3.0.7（`f91c39f6` = tag `v3.0.7`），同步重放全部本地定制；**并把定时任务承载从自研 `@kstock/automation` 切换为麒麟原生调度三件套**（3.0.7 的 `@qilin/experimental-schedule-bundle`），重建分发产物并通过桌面端烟测。

**Architecture:** KStock 是 QiLin「一切皆插件」平台上的产品层：引擎源码以快照落在 `vendor/qilin`（由 `scripts/sync_upstreams.py --sync-qilin` 整树重建），本地定制经 `scripts/patch_vendor_engine.py`（SettingsRoot 图标 2 处）与 `scripts/patch_vendor_skills.py`（引擎补丁 14/15/21/22/23/24 共 6 文件，fail-loud）幂等重放；Electron 壳不声明任何 `@qilin/*` 依赖，只经编译期（tsc paths）与运行期（profile bundles / slots）消费引擎面；产品层组合在 `kstock/web/cordis.patch.yml`。

**Tech Stack:** Node ≥22.19（Electron 44 内置）、pnpm 11.7.0（`scripts/qilin-pnpm.sh` 钉版，3.0.7 未变）、Python（`scripts/python.sh` 包装）、Git Bash（Windows 执行环境）。

**状态:** 本文为**差异分析 + 实施计划**（2026-09-30 落盘，尚未执行）。执行完毕后按 3.0.5 惯例迁入 `docs/引擎升级-QiLin3.0.5至3.0.7.md`。

> 方法与红线沿袭 [2026-09-28-qilin-3.0.5-implementation.md](2026-09-28-qilin-3.0.5-implementation.md)（执行手册）：快照整树重建会冲掉直接改动（L1）；产物必须强制重建（L3）；补丁锚点失配 fail-loud（S3）。

---

## 0. 结论速览

| 维度 | 结论 |
|---|---|
| 升级难度 | **低—中**。低于 3.0.4→3.0.5：无数据迁移（会话格式 v4→v4）、无 apps 删除、闭包清单（`python/sdk-runtime/package.json`）零变化、编译期面（tsconfig paths / 符号 / 图标）零失配、preset 引用的 24 个包全部存在 |
| 引擎侧差异量 | 62 提交 / 1068 文件（+28507/−85054）；引擎面（packages+apps+scripts+python）实际 757 文件（+18668/−4043）。删除大头：snapshots 重灌（226 文件）、B4 持久化 schema 生成物压缩、`ui-brand-official` 整删、docs |
| **必改点（引擎同步面）** | ① 补丁 22（`verify-runtime-closure.ts`）——**唯一锚点失配**，且 3/4 的补丁内容已被上游原生化，可大幅瘦身；② `kstock/web/cordis.patch.yml`——删 2 个指向已消失行的 `disabled` 行 + 删 `kstock-automation` 组合行 |
| **必改点（定时任务切换面）** | ③ `apps/desktop/electron/lib/profile-bundles.ts` + `engine.ts`——profile bundles 增 `@qilin/experimental-schedule-bundle`（原生调度三件套随 bundle 挂载，含 `time-context`）+ 存量 profile 幂等迁移 + 退役插件死链清理；④ `scripts/build-engine-bundle.sh` 两处插件清单剔除 `automation`；⑤ `kstock/automation/` 包退役（推荐整目录删除）；⑥ 存量自动化数据处置（D4） |
| 必改点（流程面） | ⑦ `upstream.lock.json` QiLin 条目（本机无 KSkills 仓，**手改**而非 `--refresh-lock`）；⑧ 三处文档口径（`docs/上游同步.md`、`docs/发布说明.md`、`docs/配置说明.md` 的 schedule/automation 描述） |
| **必改点（侧栏置顶面）** | ⑨ `kstock/client-brand/src/client`——「动效技能库」侧栏入口用同 id `priority:-1` 遮蔽条目改 `order:20` 置于第二；「自动化任务」为引擎原生 `order:10` 已居首，无需动作（Task 2D） |
| 无需动作 | 补丁 14/15/21/23/24、SettingsRoot 图标补丁（锚点逐字健在）；`@kstock/accounts-local` fork（上游 `accounts-local` 零变更）；数据层（无迁移）；CI 发布链（`release-pipeline-refit` 已固化的引擎引导步骤原样适用）。**本次决策反转了 3.0.5 的 P1**（自研 automation → 原生调度），`docs/引擎升级-QiLin3.0.4至3.0.5.md` 为存档历史不改 |

---

## 1. 差异分析

### 1.1 版本与提交总览

| 版本 | 提交 | 日期 | 主题 |
|---|---|---|---|
| 3.0.5（当前快照） | `10ed0a59806e5b31bab67a85c1b2b7500ccf4fb5` | 2026-09-28 | 上次升级基线 |
| 3.0.6 | `bd8d35d6` | 2026-09-29 | 品牌面恢复（删 `ui-brand-official`、APP_IDENTITY 归位 qilin） |
| **3.0.7（目标）** | `f91c39f6438a56045e4622f97767fcc1ec7a5d38` | 2026-09-30 | 0.2.0-rc 对齐批次收口 + sidebar-right 修 |

本地引擎仓：`D:\Projects\QiLin`（main == v3.0.7，工作树干净）。3.0.5 是 v3.0.7 的祖先（merge-base 验证通过），线性演进、无分叉合并。

62 个提交是一批「对齐上游 dsh 0.2.0-rc.1/rc.2」的移植（内部编号 B0–B9 + B5-2a/2b/2c），引擎架构无破坏性变更：**只新增 2 个包**（`packages/experimental/schedule-bundle`、`packages/telemetry/otel`），**零删除、零改名**（`ui-brand-official` 删除属于品牌提交，非包结构重组）。

### 1.2 上游变更 → KStock 影响映射

| # | 上游变更（提交） | 内容 | KStock 影响 | 动作 |
|---|---|---|---|---|
| 1 | **B5 Schedule 转可选 bundle**（`377a8eac`） | web-app patch 撤掉 `time-context`/`schedule`/`ui-schedule` 三行默认启用，整体移入新包 `@qilin/experimental-schedule-bundle`（`qilin.bundle.patch` 标准 bundle，`OPTIONAL_BUNDLES` 第四项；deps = 三件套 workspace 包，闭包经 `@qilin/cli` 可达；UI 面 = 侧栏 TaskManagerPage + sidebar-right 任务 tab + 会话内 schedule 卡片；模型工具 = `schedule_create/delete/list/update`） | **核心必改，且承载产品决策反转**。3.0.5 时 KStock 下架引擎调度、保留自研 `@kstock/automation`；本次改为**启用原生 bundle、退役自研插件**：① 旧 patch 里 `- id: schedule` / `- id: ui-schedule` 两个 `disabled: true` 行的目标行消失——组合器语义是「命不中的 patch 告警并跳过」（`vendor/include/index.ts:51`），且与新方向直接冲突（我们恰恰要启用）；② `time-context` 不再默认挂载（随 bundle 而来，无需单独补行）；③ `kstock-automation` 组合行随之退役 | Task 2（patch 修订）+ Task 2B（profile bundles + 桌面壳迁移）+ Task 2C（构建清单与包退役） |
| 2 | **B9 runtime-closure 重写**（`1104ef2d`） | `scripts/verify-runtime-closure.ts` 重写（+78/−80）：`AGENT_PRESET_GLOB` 原生指向 `packages/preset/agent-presets/presets/*/agent.cordis.yml`；「组合文件本身即 preset」（整文件=单定义，id=目录名）原生化；新增 platforms.json 三平台目标与 per-platform `disabled` 评估 | **核心必改**。补丁 22 四段锚点中三段（path 导入 / 定义回退 / presetCount）已被上游实现，补丁可瘦身；唯一残留缺口：上游 glob 不覆盖 KStock 产品预设（`kstock/presets`）→ 门禁对产品预设空转假绿 | 重写补丁 22（Task 1） |
| 3 | 品牌面（`bd8d35d6`） | 删 `packages/client/ui-brand-official` 整包与 `ui-primitives` 的 `BrandWordmark`；APP_IDENTITY `deepseek-harness` → `qilin`（User-Agent / otel service.name） | KStock 不消费 `ui-brand-official`（自有 `kstock/client-brand`，且 profile 不叠 `@qilin/web-brand`）；`qilin-seal.svg` 提取源 `ui-brand` 仅版本号变化。APP_IDENTITY 归位对 KStock 中性偏正面 | 无源码动作；烟测品牌面（Task 7-2/3） |
| 4 | B7.x ui-chat 重构（`f4fd42ff`/`f32c117d`/`7db60e9f`/`0eedd987`，45 文件） | RunningStatus/TextShimmer/DisclosureRow、字号 10–22、transcript 默认 Detailed、模型选择器 fuzzy 搜索 | KStock 唯一 ui-chat 定制（补丁 21 外链预检）锚点**逐字健在**（`apply.ts:205-211` 与 3.0.5 相同）；UI 行为升级随快照自动获得 | 无源码动作；烟测外链（Task 7-5） |
| 5 | B5-2c sidebar-right 重写（`f451cb68` + `9b34ca90`） | on-screen Session 命名替代 seat 绑定；`RESOURCE_SCHEME` 归位 `qilin-resource://`（修「打开计划文档 no registered tab type claims 抛错」） | KStock 消费 sidebar-right 的 browser tab（补丁 21 的 `openTab('browser')` 链路）；重写已由上游真机验证收口 | 无源码动作；烟测 browser/plans tab（Task 7-6） |
| 6 | B4 timed questions（`eb3b6dbe`，默认 legacy 关闭） | 实验性异步问答全链路 | 默认关闭；web-app patch 新增 `ui-user-questions` 行随上游组合 | 无动作（不开启） |
| 7 | B3 OTel 遥测（`bd7e577e`） | 新包组 `packages/telemetry/otel` + 字节有界 session-log 通道 + 上传开关 | 闭包经 `@qilin/cli` 传递可达；KStock 不配置上传 | 无动作 |
| 8 | B1/B2 执行内核（`2586fdf7`/`ec7c5143`/`4b586e68`） | pwsh 补空格完成态正则、失败步结算未决工具结果、Koffi 钉 3.1.1、pi-ai 0.87.1 | Windows 实机直接受益（KStock 主战场）；无 API 面 | 无动作 |
| 9 | B6 Windows 修复（`dd17021d`/`05489edd`/`6dc7bc82`/`0fa2cb68`） | native-command 显式窗口、pty 提示符尾部 grace、ACL 诊断技能化、会话 JSON 兼容 WebKit | Windows 实机受益 | 无动作 |
| 10 | B0 生成器堆预算（`dd9dbaac`） | `gen-scoped-events` 改 `node --max-old-space-size=4096 --import tsx/esm` | KStock 构建路径（install→build→verify-runtime-closure→build-exe）不触达该生成器 | 无动作 |
| 11 | 其余（快照 226 文件、docs 47、`.agents` 27、生成物压缩 `b65716be`） | 测试夹具/文档/生成物 | 快照体积略降（types 池压缩）；`.agents`/`plans` 本就在 sync 排除清单 | 无动作 |

### 1.3 集成面核对矩阵（全部已对 3.0.7 工作树实测）

| 集成面 | 核对内容 | 3.0.7 结果 |
|---|---|---|
| 引擎补丁锚点 | 补丁 14（`build-exe-for-python-sdk.ts` 两锚点 :306/:402）、15（`install-lefthook.mjs` :17/:599）、21（`ui-chat/apply.ts` :205-211 逐字）、23（`client-build-environment.ts` :136/:143）、24（`SidebarRoot.module.css` :188/:198） | ✅ 全部健在，零改动 |
| SettingsRoot 图标补丁 | `OLD_IMPORTS`（:23-24 相邻）与 `OLD_NAVICON`（:131-133）；5 个图标 `IconApiOutline14/IconDatabaseOutline16/IconGaugeOutline16/IconPanelLeftOutline16/IconSkillOutline16` 在 `ui-primitives/src/icons/index.tsx`（:641/:767/:786/:89/:877） | ✅ 健在；icons index 3.0.5→3.0.7 **零 diff** |
| 编译期 tsconfig paths | `kstock/client-brand/tsconfig.json` 8 条映射（kylin→`vendor/cordis`、locale、ui-theme、ui-sidebar、ui-conversation、ui-settings、ui-slots） | ✅ 路径全部存在 |
| 编译期符号 | `Button`/`Tag`（ui-primitives）、`InjectFace`/`PropsLocale`/`PropsRuntime`（ui-slots :257/:93/:251）、`ThemeTokenOverrides`（ui-theme/client :69）、`HeroBrandMarkOwnerProps`（ui-conversation/client :69）、`SidebarBrandMarkOwnerProps`（ui-sidebar/client :20）、`SnapshotStore`（client-store :27）、`Context`（kylin）、api-remotes/api-session-controller client 入口 | ✅ 全部存在 |
| preset 引用面 | `kstock/presets/*/agent.cordis.yml` 引用的 24 个 `@qilin/*` 包 | ✅ 全部存在（含 `compaction-tool-result-pruner`、`tool-ask-user`） |
| preset 平台条件行 | `disabled: !!js process.platform === 'win32'`（bash/pwsh 分裂行） | ✅ 新版 closure 门禁的 `disabledOnPlatform` 原生支持该形态（三平台逐个评估） |
| 运行时闭包 | `python/sdk-runtime/package.json` | ✅ **零变化**（python/ 仅改 1 个测试文件）；`dsh-animations` 仍是 `@qilin/cli` 依赖（`^1.2.3`）；`@qilin/time-context`/`@qilin/schedule`/`@qilin/experimental-schedule-bundle` 均在 cli 依赖 → 闭包可达 |
| 工具链 | 根 `package.json`：`packageManager pnpm@11.7.0`、`engines ^22.19.0 || >=24.0.0` | ✅ 未变（仅版本号与 gen-scoped-events 行变化） |
| 数据层 | `SESSION_FORMAT_VERSION`（`packages/core/session/src/types.ts:89`） | ✅ 4 → 4，**无会话迁移**；`migrate:sessions-to-v4` 脚本仍在（无需再跑） |
| 插件兼容门禁 | `packages/boot/app-boot/src/plugin-compatibility.ts` | ✅ 零变化（KStock 插件无 `@qilin/*` peer，机制不检查） |
| profile 机制 | `PROFILE_TEMPLATES` 仍种 `dsh-animations`（profile.ts:260/:266）；`PROFILE_OWNED_BUNDLES` 未变；`OPTIONAL_BUNDLES` 增第四项 schedule-bundle（:301） | ✅ kstock profile 仍不在模板表 → 显式补层机制沿用（Task 2B 在此机制上增调度层）；bundle 经引擎安装 node_modules 解析，无需 profile link 依赖 |
| agent-presets 配置 | `default`/`roots`/`includeShippedRoot`/`includeUserRoot`（KStock patch 行使用的键） | ✅ preset 组仅 version bump + 参考文档，config 面零变化 |
| accounts fork | 上游 `@qilin/accounts-local` | ✅ 零变化（不在 757 文件清单内），`@kstock/accounts-local`（3.0.0 fork）无需动 |
| web-app patch 目标行 | KStock patch 按 id 命中的 `system-prompt`/`web-runtime`/`accounts`/`agent-presets`/`ui-agent-preset` | ✅ 全部仍在 web-app `cordis.patch.yml`；schedule 三行已撤（见 1.2-1） |

### 1.4 差异驱动的必改清单

1. **`scripts/patch_vendor_skills.py` 补丁 22 重写**（锚点失配 → fail-loud 会中止 `--sync-qilin` 之后的第一次构建；且旧补丁 4 段中 3 段已与上游重复）
2. **`kstock/web/cordis.patch.yml`**：删 `- id: schedule` / `- id: ui-schedule` 两个 disabled 行（目标行已不存在，且方向反转为启用）；删 `- id: kstock-automation` 组合行（插件退役）
3. **`apps/desktop/electron/lib/profile-bundles.ts` + `engine.ts`**：`PROFILE_BUNDLES` 增 `@qilin/experimental-schedule-bundle`（位置：`dsh-animations` 之后、`@kstock/web` 之前）+ `withScheduleBundle` 存量幂等迁移 + 退役插件死链清理
4. **`scripts/build-engine-bundle.sh`**：两处插件清单（构建循环 :49 / 组装循环 :113）剔除 `automation`，并删除 automation 专用 esbuild 分支（:58-70 一带）
5. **`kstock/automation/` 包退役**（D5，推荐 `git rm -r` 整目录 + 刷新根 workspace lockfile）
6. **存量自动化数据处置**（D4）：`@kstock/automation` 的定义/运行史存在引擎 storage-domain（`automationDomainSpec`），插件退役后数据滞留但不再执行
7. **`upstream.lock.json`**：QiLin 条目更新（本机无 KSkills 仓 → 手改）
8. **文档口径**：`docs/上游同步.md:69-71`、`docs/发布说明.md:109-111`、`docs/配置说明.md:22`（schedule 下架/automation 保留的旧口径全部反转为新事实）
9. **侧栏菜单置顶**：`kstock/client-brand/src/client` 增「动效技能库」入口遮蔽条目（`anim-panel` 同 id、`priority:-1`、`order:20`）——dsh-animations 硬编码 `order:120` 夹在选股库与报告库之间，产品要求它与「自动化任务」（引擎 `order:10`，已居首）同处菜单最上；面板本体与点击接线不受影响（Task 2D）

> 附带发现（本次顺手修复）：`@kstock/automation` **从未进入** `engine.ts` 的 profile packages 链接列表（`git log -S` 零命中），本机 profile 里的 `node_modules/@kstock/automation` 链接指向 dev 目录（`D:\Projects\KStock\kstock\automation`）属存量手工/历史残留——全新打包安装上该组合行的解析本就存疑。退役该插件同时消除了这个潜在装配缺陷。

---

## 2. 决策点

| # | 决策 | 结论 | 理由 |
|---|---|---|---|
| D1 | `time-context` 去留 | **保留，且无需单独处理**——随 `@qilin/experimental-schedule-bundle` 的 patch 三件套（`time-context`/`schedule`/`ui-schedule`）整体挂载 | 启用原生 bundle 即获得与上游官方组合完全一致的三行；比 3.0.5「撤二留一」的裁剪更贴近上游测试面 |
| D2 | `upstream.lock.json` 维护方式 | 本机**手改** QiLin 条目 | 本机（`D:\Projects`）无 KSkills 仓，`--refresh-lock` 会对 KSkills 路径执行 `git rev-parse` 直接失败；后续拉取 KSkills 后再恢复 `--refresh-lock` 全量刷新 |
| D3 | 定时任务承载：引擎原生 vs 自研 `@kstock/automation` | **启用引擎原生**（用户已拍板，反转 3.0.5 P1）：profile bundles 增 `@qilin/experimental-schedule-bundle`，`@kstock/automation` 退役 | 产品决策。附带工程红利：少维护一个自研调度器（scheduler/recurrence/executor/store 约 10 源文件 + 8 测试文件），直接获得上游任务页/sidebar-right 任务 tab/会话内卡片/`schedule_*` 工具与后续演进；同时消除 1.4 附带发现的装配存疑 |
| D4 | 存量 `@kstock/automation` 数据（定义 + 运行史，存于引擎 storage-domain `automationDomainSpec`） | **不做自动迁移**：数据原地滞留（不再执行），发布说明引导用户在引擎任务页按需重建 | 两代模型语义不同（automation = 到期开**全新会话**执行；engine schedule = 到期在**原会话**投递 follow-up），1:1 映射会 silently 改变行为；cron/daily/weekly 可手工重建，量小（个人桌面产品） |
| D5 | `kstock/automation` 源码处置 | **整目录删除**（`git rm -r kstock/automation` + 根 workspace 重装刷 lockfile） | 「不再使用」的干净落地；包无任何外部依赖方（全部 kstock/*/package.json 零引用，preset/lead_soul 零 `automation_*` 引用）；MIT 收编溯源保留在 git 历史。保守替代（不推荐）：仅摘组合行与构建清单、源码留仓 Dormant |

---

## 3. 实施计划

> 执行环境：Windows + Git Bash。`scripts/python.sh` 是项目惯用的 Python 包装（规避 Windows Store 桩）。**T1/T2/T2B/T2C 落盘后、T3 同步完成前，不要单独跑 `pnpm build:engine`**（其步骤 0 会用新锚点补丁打旧快照，预期 fail-loud 红——属中间态，非故障）。
>
> **Mac 开发机适配（已实测核对，2026-10-01）**：本计划原以 Windows 机落盘，Mac 机（`/Users/libing`）同样适用，差异四处——① Step 0.1 仓库路径为 `/Users/libing/kk_Projects/KStock` 与 `/Users/libing/kk_Projects/QiLin`（后者即 `sync_upstreams.py` 的 `DEFAULT_QILIN_ROOT`，**Step 3.1 可省略 `--qilin-root`**）；② Mac 机存在 KSkills 仓且其 HEAD（`fd01489`）与 lock 现值一致，**Step 3.4 可用 `--refresh-lock` 替代手改**（D2 手改的前提「本机无 KSkills 仓」在 Mac 不成立，refresh 结果与手改目标完全一致）；③ **前置清理 QiLin 工作树未跟踪残留**：`packages/api/job-controller/src/types.{js,d.ts,js.map}` 是构建产物且不在 sync 排除规则内，会污染快照（`.agents/tmp-*` 已被顶层排除规则挡住，无碍）；④ S8 等 Windows 专属症状 Mac 烟测不覆盖，由 CI 发布链兜底。Mac 机锚点预检结论（2026-10-01 实测）：补丁 14/15/21/23/24 双锚点 + 图标补丁 + 5 图标符号全部命中，旧补丁 22 glob 锚点确认失配（fail-loud 必然触发），与 §1.3 矩阵一致。

### Task 0：准备与基线固化

**Files:** 无（只读操作 + 分支）

- [ ] **Step 0.1：确认两端仓库状态**

```bash
git -C /d/Projects/KStock status -sb        # 期望：干净工作树（当前 main）
git -C /d/Projects/QiLin  status -sb        # 期望：main...origin/main，无在飞改动
git -C /d/Projects/QiLin  rev-parse v3.0.7  # 期望：f91c39f6438a56045e4622f97767fcc1ec7a5d38
node -p "require('/d/Projects/QiLin/package.json').version"   # 期望：3.0.7（bash 下用 node -p "require('D:/Projects/QiLin/package.json').version"）
```

- [ ] **Step 0.2：建升级分支**

```bash
git checkout -b upgrade/qilin-3.0.7
```

- [ ] **Step 0.3：备份 profile（低危，照 3.0.5 手册惯例）**

```bash
STAMP=$(date +%Y%m%d)
cp ~/.kstock/qilin-home/profiles/kstock/package.json ~/kstock-profile-backup-$STAMP.json
```

会话目录**无需备份**：会话格式 v4→v4 无迁移、无单向转换。

- [ ] **Step 0.4：提交基线**

```bash
git commit --allow-empty -m "chore(qilin): 开始 3.0.7 升级——基线 3.0.5 @ 10ed0a598"
```

### Task 1：重写补丁 22（verify-runtime-closure 的 3.0.7 适配）

**Files:**
- Modify: `scripts/patch_vendor_skills.py:1460-1515`（整个「补丁 22」区段）

- [ ] **Step 1.1：替换补丁 22 区段**

把现有区段（从 `# ── 补丁 22：verify-runtime-closure 的 preset 门禁 3.0.5 适配 ──` 到 `_fix_qilin_verify_closure_glob` 函数结尾，行 1460-1515）整体替换为：

```python
# ── 补丁 22：verify-runtime-closure 的 preset 门禁纳入 KStock 预设（3.0.7 适配）──
# 3.0.7 上游（B9，1104ef2d）重写本门禁：AGENT_PRESET_GLOB 原生指向 shipped
# 预设目录 packages/preset/agent-presets/presets/*/agent.cordis.yml，「组合文件
# 本身即 preset」（整文件 = 单定义，id = 目录名，见 presetCompositions）也已
# 原生化——3.0.5 补丁的另外三段（path 导入补 basename/dirname、定义回退、
# presetCount 口径）随上游实现整体退役。
# 残留缺口：KStock 产品态预设在引擎树之外（KStock 仓 kstock/presets），上游
# glob 覆盖不到 → 门禁对产品预设空转假绿。本补丁只扩 glob 一处。
_VERIFY_CLOSURE_REL = "qilin/scripts/verify-runtime-closure.ts"
_VERIFY_CLOSURE_MARKER = "KStock patch: preset glob 扩展"
_VERIFY_CLOSURE_GLOB_ANCHOR = "const AGENT_PRESET_GLOB = 'packages/preset/agent-presets/presets/*/agent.cordis.yml'"
_VERIFY_CLOSURE_GLOB_REPLACEMENT = (
    "// KStock patch: preset glob 扩展——上游 glob 只覆盖引擎 shipped 预设，\n"
    "// KStock 产品态预设（kstock/presets，随包分发的真正预设面）在引擎树\n"
    "// 之外，纳入后才受本门禁保护，否则对产品预设空转假绿。\n"
    "const AGENT_PRESET_GLOB = '{packages/preset/agent-presets/presets/*/agent.cordis.yml,"
    "../../kstock/presets/*/agent.cordis.yml}'"
)


def _fix_qilin_verify_closure_glob(text: str) -> str | None:
    """verify-runtime-closure 的 preset glob 纳入 KStock 预设；已修/锚点失配返回 None。"""
    if _VERIFY_CLOSURE_MARKER in text:
        return None
    if _VERIFY_CLOSURE_GLOB_ANCHOR not in text:
        return None
    return text.replace(_VERIFY_CLOSURE_GLOB_ANCHOR, _VERIFY_CLOSURE_GLOB_REPLACEMENT, 1)
```

`apply_skill_patches()` 里的注册行（行 2190-2193）**不变**（函数名、rel 路径、marker 参数引用同名常量）。

- [ ] **Step 1.2：语法自检**

```bash
scripts/python.sh -m py_compile scripts/patch_vendor_skills.py && echo OK
```

- [ ] **Step 1.3：提交**

```bash
git add scripts/patch_vendor_skills.py
git commit -m "patch(qilin): 补丁 22 适配 3.0.7——上游已原生实现三段，补丁瘦身为 glob 扩展一处"
```

### Task 2：修订 kstock/web/cordis.patch.yml（调度承载切换的组合面）

**Files:**
- Modify: `kstock/web/cordis.patch.yml`

- [ ] **Step 2.1：删除 `kstock-automation` 组合行（行 113-123）**

删除整段（含注释）：

```yaml
    # 定时任务插件（内置收编自 dsh-kylin-automation 0.1.2，MIT）：durable
    # 自动化定义 + 调度钟 + 全新会话执行器 + 运行历史持久化；侧边栏
    # 「定时任务」管理页 + agent automation_* 六工具。产品默认：并发 2 /
    # 单次超时 60min / 停机补跑宽限 15min / 历史 200 条。
    - id: kstock-automation
      name: '@kstock/automation'
      config:
        maxConcurrentRuns: 2
        runTimeoutMinutes: 60
        misfireGraceMinutes: 15
        historyLimit: 200
```

> 组合语义：引擎原生三件套改由 profile bundles 里的 `@qilin/experimental-schedule-bundle` 挂载（Task 2B），本层不再出现任何调度行；`time-context` 也随 bundle 挂载，**无需**在 insert 块补行。

- [ ] **Step 2.2：删除尾部两个 disabled 死行（行 145-156）**

删除整段（含注释）：

```yaml
# 引擎 3.0.5 默认启用 schedule/time-context 三件套（web-app 的 eca807f0ad 变更）。
# KStock 已有内置定时任务（@kstock/automation），保留引擎侧会在侧边栏多出
# 第二个任务面板、并在工具名册里多出一族 schedule_* 工具 —— 与固定功能集的
# 产品口径冲突。故下架 host 能力 + 其唯一消费者 UI；time-context 是纯上下文
# 注入、无 UI、且有助于时间感知，保留。
- id: schedule
  name: '@qilin/schedule'
  disabled: true

- id: ui-schedule
  name: '@qilin/client-ui-schedule'
  disabled: true
```

保留其上方的 `- id: ui-agent-preset ... disabled: true`（行 141-143，目标行在 3.0.7 仍存在）。

- [ ] **Step 2.3：提交**

```bash
git add kstock/web/cordis.patch.yml
git commit -m "feat(web): 定时任务切换为麒麟原生调度——kstock-automation 组合行退役，撤除引擎三件套下架行"
```

### Task 2B：profile 层启用原生调度 bundle + 桌面壳存量迁移

**Files:**
- Modify: `apps/desktop/electron/lib/profile-bundles.ts`
- Modify: `apps/desktop/electron/lib/engine.ts:36`、`:126`、`:147-197`（符号链接区）
- Test: `apps/desktop/electron/lib/profile-bundles.test.ts`

- [ ] **Step 2B.1：profile-bundles.ts 增加调度层常量与迁移函数**

`ANIMATIONS_BUNDLE` 定义之后追加，并改写 `PROFILE_BUNDLES`：

```ts
/**
 * 引擎原生调度 bundle（3.0.7 `OPTIONAL_BUNDLES` 成员）：随包挂载
 * time-context / schedule / ui-schedule 三行开启态组合——KStock 2.x 的
 * 定时任务承载（替代已退役的 @kstock/automation）。
 */
export const SCHEDULE_BUNDLE = "@qilin/experimental-schedule-bundle";

/** 产品 bundle 叠层：新 profile 的初始值，也是空列表的回退。 */
export const PROFILE_BUNDLES = [
  "@qilin/base",
  "@qilin/web-app",
  ANIMATIONS_BUNDLE,
  SCHEDULE_BUNDLE,
  "@kstock/web",
] as const;

/**
 * 幂等补上引擎调度层。缺失时插到 `dsh-animations` 之后（无动效层则锚定
 * `@qilin/web-app` 之后），保证 `@kstock/web` 始终末位最权威；已存在时
 * 返回同一引用表示无需写盘（与 withAnimationsBundle 同收敛语义）。
 *
 * @param bundles - profile 现有的 `qilin.profile.bundles`。
 * @returns 下一次应写入的列表；与入参同一引用即无需改动。
 */
export function withScheduleBundle(bundles: readonly string[]): readonly string[] {
  if (bundles.length === 0) return PROFILE_BUNDLES;
  if (bundles.includes(SCHEDULE_BUNDLE)) return bundles;
  const animations = bundles.indexOf(ANIMATIONS_BUNDLE);
  const anchor = animations >= 0 ? animations : bundles.indexOf("@qilin/web-app");
  const next = [...bundles];
  next.splice(anchor >= 0 ? anchor + 1 : next.length, 0, SCHEDULE_BUNDLE);
  return next;
}
```

文件头部叠层注释同步更新为五层：`@qilin/base → @qilin/web-app → dsh-animations → @qilin/experimental-schedule-bundle → @kstock/web`。

- [ ] **Step 2B.2：engine.ts 接线迁移与死链清理**

三处改动：

① 行 36 导入增加 `withScheduleBundle`：

```ts
import { PROFILE_BUNDLES, withAnimationsBundle, withScheduleBundle } from "./profile-bundles";
```

② 行 126 的迁移链改为两层串联：

```ts
      const nextBundles = withScheduleBundle(withAnimationsBundle(bundles));
```

日志行（:137-140）的括号数组追加 `"调度 bundle 层"`。

③ 符号链接循环之后（`return profileDir;` 之前）追加退役插件死链清理：

```ts
  // 退役插件的残留链接清理：3.0.7 起定时任务改用引擎原生调度 bundle，
  // @kstock/automation 不再装载；旧装机 profile 里可能残留指向已删目录的链接。
  const retiredAutomationLink = join(modulesDir, "automation");
  if (existsSync(retiredAutomationLink)) rmSync(retiredAutomationLink, { force: true });
```

- [ ] **Step 2B.3：补单测（profile-bundles.test.ts 追加）**

```ts
test("缺调度层时插到 dsh-animations 之后（@kstock/web 保持在末位）", () => {
  assert.deepEqual(
    withScheduleBundle(["@qilin/base", "@qilin/web-app", "dsh-animations", "@kstock/web"]),
    ["@qilin/base", "@qilin/web-app", "dsh-animations", SCHEDULE_BUNDLE, "@kstock/web"],
  );
});

test("已含调度层时返回同一引用（写盘收敛）", () => {
  const current = ["@qilin/base", "@qilin/web-app", "dsh-animations", SCHEDULE_BUNDLE, "@kstock/web"];
  assert.equal(withScheduleBundle(current), current);
});

test("无动效层时锚定 @qilin/web-app 之后", () => {
  assert.deepEqual(
    withScheduleBundle(["@qilin/base", "@qilin/web-app", "@kstock/web"]),
    ["@qilin/base", "@qilin/web-app", SCHEDULE_BUNDLE, "@kstock/web"],
  );
});
```

既有 `withAnimationsBundle` 用例与 `PROFILE_BUNDLES` 断言需同步五层化。

- [ ] **Step 2B.4：跑单测**

```bash
pnpm -C apps/desktop test -- profile-bundles   # 或项目惯用的单测入口；期望全绿
```

- [ ] **Step 2B.5：提交**

```bash
git add apps/desktop/electron/lib/profile-bundles.ts apps/desktop/electron/lib/engine.ts apps/desktop/electron/lib/profile-bundles.test.ts
git commit -m "feat(desktop): profile bundles 增引擎原生调度层（存量幂等迁移）+ automation 死链清理"
```

### Task 2C：构建清单剔除 automation + 插件包退役

**Files:**
- Modify: `scripts/build-engine-bundle.sh:49`、`:58-70`、`:113`
- Delete: `kstock/automation/`（D5）

- [ ] **Step 2C.1：build-engine-bundle.sh 三处剔除**

① 行 49 构建循环与 ② 行 113 组装循环的包清单均去掉 `automation`：

```bash
for pkg in accounts client-brand presets-ui datasources-ui web quant quant-strategies quant-factors quant-selections quant-reports news-ui chan-ui; do
```

③ 删除 automation 专用 esbuild 分支（`if [ "$pkg" = "automation" ]; then ... else ... fi` 整段，保留 tsdown 通用分支）。头部产物注释（:12）的 plugins 示例同步去掉 automation。

- [ ] **Step 2C.2：删除插件包（D5）**

```bash
git rm -r kstock/automation
pnpm install          # 根 workspace（kstock/*）成员变化，刷新 lockfile
```

- [ ] **Step 2C.3：残留引用断言**

```bash
grep -rn "kstock/automation\|automation_create\|automation_run_now" \
  kstock/ apps/ scripts/ config/ --include='*.ts' --include='*.tsx' --include='*.yml' --include='*.json' --include='*.sh' \
  | grep -v node_modules   # 期望：零命中
```

- [ ] **Step 2C.4：提交**

```bash
git add -A scripts/build-engine-bundle.sh kstock/ pnpm-lock.yaml
git commit -m "feat(build): 定时任务插件 @kstock/automation 退役——构建/组装清单剔除，包删除（改用引擎原生调度）"
```

### Task 2D：侧栏菜单置顶——自动化任务与动效技能库

**Files:**
- Modify: `kstock/client-brand/src/client/index.ts`
- Add: `kstock/client-brand/src/client/AnimNavIcon.tsx`

**机制背景（3.0.7 实测）**：`sidebar.panellist`（list 槽）按 `options.order` 升序排（缺省 0），侧栏 `syncPanels` 读取每个 cell 的胜出条目后按 order 排序。order 分布：引擎 ui-schedule 任务页（「自动化任务」）`order:10`；KStock 六面板 100–150（策略 100 / 因子 110 / 选股 120 / 报告 130 / 新闻 140 / 缠论 150）；dsh-animations 的「动效技能库」（`anim-panel`）硬编码 `order:120`（夹在选股库与报告库之间）。**「自动化任务」已是菜单首位，无需动作**；「动效技能库」需提至第二。dsh-animations 是闭包 npm 依赖（`@qilin/cli` → `^1.2.3`），改上游需发版 + 引擎 lockfile 联动，不走——改用槽系统原生遮蔽：list 槽**同 id 同 cell，`priority` 升序、最低者渲染；同 priority 二次注册抛错（fail-loud）**（ui-slots `index.ts:1142-1148`）。KStock 层注册同 id（`anim-panel`）`priority:-1` 的遮蔽条目即可覆盖 order，原条目保持存活但不渲染。

落点 `@kstock/client-brand`：产品客户端壳层（已注入 `slots`/`locale`，已用 `ctx.slots.inject` 等 ui-sidebar 声明），每个 profile 必载。

- [ ] **Step 2D.1：新增 `AnimNavIcon.tsx`（图标与 dsh-animations `PanelIcon` 同款四角星，视觉零变化）**

```tsx
/**
 * 动效技能库侧栏入口图标（anim-panel 遮蔽条目用）。
 *
 * 与 dsh-animations `lib/client.js` 的 `PanelIcon`（MIT，自家包）同款
 * sparkle——被遮蔽的原条目不再渲染，入口视觉零变化；尺寸/激活态由
 * 侧栏按 `SidebarPanelIconOwnerProps` 传入（同 TaskManagerIcon 模式）。
 */
export function AnimNavIcon({ size }: { size: number; active?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 0-1.3-1.3Z" />
    </svg>
  )
}
```

- [ ] **Step 2D.2：`index.ts` 注册遮蔽条目（`disposeMarks` 声明之后追加，cleanup 链 LIFO 对应接入）**

```ts
    // 动效技能库入口置顶（遮蔽条目）：dsh-animations 的 anim-panel 入口
    // order:120（夹在选股库与报告库之间），产品口径要求它与「自动化任务」
    // （引擎 ui-schedule 任务页，order:10）同处菜单最上。list 槽同 id 同
    // cell，priority 更低者渲染（同 priority 抛错 fail-loud）——priority:-1
    // 遮蔽原条目、order:20 落位第二；面板本体（main keyed 同 id）不受影响，
    // 点击接线 layout.selectPanel('anim-panel') 不变。
    const disposeAnimNavPinned = ctx.slots.inject('sidebar.panellist', () =>
      ctx.slots.register(
        { name: 'sidebar.panellist', id: 'anim-panel', order: 20, priority: -1, label: '动效技能库' },
        AnimNavIcon,
      ),
    )
```

cleanup 链（现有倒序释放风格）在 `disposeMarks()` 之前插入 `disposeAnimNavPinned()`。文件头 import 区追加 `import { AnimNavIcon } from './AnimNavIcon.tsx'`。

- [ ] **Step 2D.3：提交**

```bash
git add kstock/client-brand/src/client/
git commit -m "feat(client-brand): 动效技能库侧栏入口遮蔽置顶（anim-panel 同 id priority:-1，order 120→20）"
```

> 边界说明：① 不动「自动化任务」——引擎原生 `order:10` 已居首，若未来引擎新增更低 order 条目再评估同样手法；② 若用户手动摘除 dsh-animations bundle，遮蔽条目会渲染一个指向不存在面板的图标（点击无面板切换）——KStock profile 恒含动效层（`ANIMATIONS_BUNDLE`），该形态不可达，不设防；③ 遮蔽失效的显性症状是「同 priority 抛错」（启动日志 fail-loud）或「两个动效图标并存」（id 失配）→ S9。

### Task 3：同步快照 + 锚点验证

**Files:**
- 重建: `vendor/qilin`（整树）
- Modify: `upstream.lock.json`

- [ ] **Step 3.1：同步（显式 Windows 引擎仓路径；脚本默认路径是旧开发机的 Mac 路径）**

```bash
scripts/python.sh scripts/sync_upstreams.py --sync-qilin --qilin-root "D:/Projects/QiLin"
```

期望输出：`已同步 QiLin 引擎到：...vendor/qilin` + `patch_vendor_engine：应用 2 处，跳过（已应用）0 处`（SettingsRoot 图标两补丁；其余 5 个引擎补丁由下一步重放）。

- [ ] **Step 3.2：重放引擎补丁并验证全部锚点**

```bash
scripts/python.sh scripts/patch_vendor_skills.py
```

期望：列出 6 个 `qilin/...` 引擎补丁文件（build-exe-for-python-sdk / install-lefthook / ui-chat apply / verify-runtime-closure / client-build-environment / ui-sidebar CSS），**无** `✗ 引擎补丁锚点失配`（exit 0）。若报失配 → 症状 S1。

- [ ] **Step 3.3：快照断言**

```bash
node -p "require('./vendor/qilin/package.json').version"      # 3.0.7
ls vendor/qilin/apps/                                          # cli  web（无 desktop）
ls vendor/qilin/packages/experimental/ | grep schedule-bundle  # schedule-bundle（新包在快照内）
for d in node_modules lib dist dist-exe; do [ -e "vendor/qilin/$d" ] && echo "!! 残留 $d"; done; echo "排除规则 OK"
```

- [ ] **Step 3.4：手改 upstream.lock.json（D2）**

QiLin 条目改为（`generated_at` 用执行日；KSkills 条目与 `skills_manifest` 不动）：

```json
"QiLin": {
  "path": "D:\\Projects\\QiLin",
  "branch": "main",
  "commit": "f91c39f6438a56045e4622f97767fcc1ec7a5d38",
  "version": "3.0.7"
},
```

- [ ] **Step 3.5：提交快照**

```bash
git add -A vendor/qilin upstream.lock.json
git commit -m "chore(qilin): 同步引擎快照 3.0.5 -> 3.0.7（10ed0a598 -> f91c39f6，含 6 处本地补丁重放）"
git diff HEAD~1 --stat -- vendor/qilin | tail -3   # 留档变更量
```

### Task 4：引擎构建与闭包门禁

- [ ] **Step 4.1：安装（钉版 pnpm 11.7.0 自动就位）**

```bash
scripts/qilin-pnpm.sh install --frozen-lockfile
```

- [ ] **Step 4.2：构建（数分钟；KSTOCK_CLIENT_VERSION 徽章注入自动生效）**

```bash
scripts/qilin-pnpm.sh run build
```

- [ ] **Step 4.3：闭包门禁（重写后的补丁 22 首次实战）**

```bash
scripts/qilin-pnpm.sh run verify-runtime-closure
```

期望：`verify-runtime-closure: 11 agent presets and N workspace packages form a closed runtime dependency graph.`——**11 = 4 shipped（cordis/minimal/ptc/standard）+ 7 KStock**。若 presetCount 只有 4 → glob 扩展未生效（S3）；若报 `<preset> preset -> @qilin/xxx` → S2。

### Task 5：引擎分发束重建（产物全失效，强制重建）

- [ ] **Step 5.1：重建**

```bash
bash scripts/build-engine-bundle.sh --force-exe-build
```

期望：步骤 0 补丁重放全绿 → exe 构建数分钟 → dist-exe/ 产出 `kstock-engine(.exe)`、`-office/`、`plugins/`（12 个包，**无 automation**）、`presets/`。

- [ ] **Step 5.2：产物抽查**

```bash
ls dist-exe/ | head
ls dist-exe/plugins/          # 12 个目录；不应出现 automation
ls dist-exe/presets/          # 7 个 KStock preset
```

### Task 6：桌面端构建与既有测试

- [ ] **Step 6.1：根工作区安装与 CI 门禁**

```bash
pnpm install --frozen-lockfile
pnpm check:ci
```

期望：全绿（含 `apps/desktop/electron/lib/profile-bundles.test.ts`——Task 2B.3 新增的 `withScheduleBundle` 用例与五层化 `PROFILE_BUNDLES` 断言）。

- [ ] **Step 6.2：桌面端构建**

```bash
pnpm build:desktop
```

### Task 7：真机烟测（桌面端，逐项过）

启动 `pnpm dev`（或安装包形态），核对：

- [ ] 7-1 引擎以 3.0.7 启动，登录 → 主界面（`~/.kstock/qilin-home` profile 沿用，无迁移提示）
- [ ] 7-2 侧栏品牌徽章显示「桌面端 vX.Y.Z」（补丁 23 + qilin-pnpm.sh 注入）
- [ ] 7-3 设置页 5 个 KStock 分区图标（mcp / skills / sidebar-right / kstock-data-sources / kstock-quant-workspace）与红绿灯/品牌行两行布局（补丁 24）
- [ ] 7-4 四库 main 面板 + `sidebar.panellist` 导航正常（量化策略/因子/选股/报告）
- [ ] 7-5 **外链行为**（补丁 21）：会话中点可嵌链接 → 侧栏浏览器 tab 渲染；点不可嵌链接（如券商研报站）→ 系统浏览器打开，**无白屏**
- [ ] 7-6 **sidebar-right**：browser tab 可开；打开计划文档 tab 不抛 `no registered tab type claims`（上游 B5-2c RESOURCE_SCHEME 修复的回归验证）
- [ ] 7-7 **定时任务（本次变更核心验证）**：侧栏出现引擎任务页（TaskManagerPage，日历图标入口）；sidebar-right 可开任务 tab；会话内可建 schedule 卡片；会话工具名册含 `schedule_create/delete/list/update`；**不再有** `kyl-automations` 侧栏面板与 `automation_*` 六工具；旧自动化任务不再触发（D4：不迁移，发布说明引导重建）
- [ ] 7-7b 首启迁移验证：升级安装后首次启动，日志出现「kstock profile 已更新（… 调度 bundle 层）」，profile `bundles` 含 `@qilin/experimental-schedule-bundle`（`node -p "require('$HOME/.kstock/qilin-home/profiles/kstock/package.json').qilin.profile.bundles"`）；`node_modules/@kstock/automation` 死链已被清理
- [ ] 7-7c **侧栏菜单置顶（Task 2D 核心验证）**：菜单顺序为「自动化任务」第 1 →「动效技能库」第 2 → 策略库/因子库/选股库/报告库/财经新闻/缠论研究依次（100–150）；动效技能库图标为四角星 sparkle（与原版一致），点击仍打开 anim-panel 工作台（遮蔽条目 id 不变，selectPanel 接线不受影响）；**不出现**第二个动效图标
- [ ] 7-8 启动日志**无** `patch: ... matches nothing` / `name mismatch` 告警（Step 2.2 删干净的证明；若出现 → S5）
- [ ] 7-9 dsh-animations 技能可调用（动效技能库随闭包）
- [ ] 7-10 ui-chat 新面：字号设置 10–22 档、运行态 shimmer、transcript 默认 Detailed
- [ ] 7-11 历史会话（v4）列表与回放正常

### Task 8：upstream.lock 与文档收尾

**Files:**
- Modify: `docs/上游同步.md`、`docs/发布说明.md`、`docs/配置说明.md`（必要时 `docs/2.0-特性差异与迁移说明.md` 的版本口径）

- [ ] **Step 8.1：更新文档口径**

`docs/上游同步.md:69-71`、`docs/发布说明.md:109-111`、`docs/配置说明.md:22`：把「保留自研 `@kstock/automation`、下架引擎日程能力」的旧口径反转为 3.0.7 事实——「上游 3.0.7 起调度三件套撤入 `@qilin/experimental-schedule-bundle`；KStock profile bundles 挂载该 bundle 作为定时任务承载，`@kstock/automation` 退役（存量定义不迁移，见发布说明迁移段落）」。发布说明另补一段用户面迁移指引（旧任务在引擎任务页重建；语义差异：到期投递在原会话）。

```bash
grep -rn "3\.0\.5" docs/ 上游同步.md 2>/dev/null | grep -v 引擎升级   # 逐条判断是否需要随版本口径更新
```

- [ ] **Step 8.2：登记升级记录**

```bash
git mv plans/2026-09-30-qilin-3.0.7-upgrade.md docs/引擎升级-QiLin3.0.5至3.0.7.md
# 并在文末追加「执行记录」小节：日期、分支、关键验证输出、烟测结果
```

- [ ] **Step 8.3：提交**

```bash
git add docs/ upstream.lock.json plans/
git commit -m "docs(qilin): 3.0.7 升级记录与 schedule 三件套口径更新"
```

### Task 9：合并与清理

- [ ] **Step 9.1：合并**

```bash
git checkout main
git merge --no-ff upgrade/qilin-3.0.7
```

- [ ] **Step 9.2：删除升级分支**

```bash
git branch -d upgrade/qilin-3.0.7
```

---

## 4. 风险清单与症状处置

| 症状 | 根因 | 处置 |
|---|---|---|
| **S1** `patch_vendor_skills.py` 报「引擎补丁锚点失配」并 exit 1 | 上游重构了某锚点处 | 对照 `D:\Projects\QiLin` 的 3.0.7 实际形态更新锚点后重跑（fail-loud 设计意图；本次预检 6 处全中，理论上不应触发） |
| **S2** `verify-runtime-closure` 报 `<preset> preset -> @qilin/xxx` | 该包不在 `python/sdk-runtime` 直依赖 | 3.0.5 已全绿 + 闭包清单未变，理论不出现；出现则核对 preset 里包名拼写与闭包清单 |
| **S3** 门禁 presetCount = 4（缺 KStock 7 个） | glob 扩展补丁未生效或 `../../kstock/presets` 相对路径解析失败 | 确认 Step 3.2 重放输出含 `qilin/scripts/verify-runtime-closure.ts`；在 vendor/qilin 下验证 `ls ../../kstock/presets` 可达 |
| **S4** 侧栏**无**引擎任务页 / 工具名册**无** `schedule_*` | 调度 bundle 未挂载：profile bundles 缺层或 bundle 解析失败 | ① 查 profile `bundles` 是否含 `@qilin/experimental-schedule-bundle`（缺 → Task 2B 迁移未生效，跑一次桌面壳看启动日志）；② 启动日志 grep `experimental-schedule-bundle` 的解析错误；③ 确认闭包含该包：`ls vendor/qilin/apps/cli/node_modules/@qilin/experimental-schedule-bundle`（install 后存在） |
| **S4b** 侧栏**同时**出现引擎任务页与旧「定时任务」面板 | `kstock-automation` 组合行未删干净，或 dist-exe/plugins 残留旧 automation 目录 | grep `kstock/web/cordis.patch.yml` 的 `automation`（应零命中）；`ls dist-exe/plugins/`（不应有 automation，有则产物未重建 → `--force-exe-build`） |
| **S5** 启动日志 `patch: ... matches nothing` 告警 | cordis.patch.yml 残留 id-targeted 死行 | Task 2 的两段未删干净；grep `kstock/web/cordis.patch.yml` 里 `schedule` |
| **S6** 外链白屏回归 | 补丁 21 未重放 | `grep -c "KStock patch: X-Frame-Options" vendor/qilin/packages/client/ui-chat/src/client/apply.ts` 应 = 1 |
| **S7** 品牌徽章/图标/布局异常 | 补丁 23/24/图标补丁未重放 | 对应 grep：`KStock patch: 桌面端版本徽章`（client-build-environment.ts）、`KStock patch: 品牌行不再上提`（SidebarRoot.module.css）、`kstock-quant-workspace`（SettingsRoot.tsx）各 = 1 |
| **S8** Windows exe 启动即死（`ERR_MODULE_NOT_FOUND: @qilin/sandbox-windows-acl/runner`） | 补丁 14（repairStagedScope）未参与 exe 构建 | `grep -c repairStagedScope vendor/qilin/scripts/build-exe-for-python-sdk.ts` 应 = 2；然后 `--force-exe-build` 重建 |
| **S9** 动效技能库出现两个图标 / 排序未置顶 | 遮蔽失效：dsh-animations 改了 `PANEL_ID`（≠ `anim-panel`，两 cell 并存），或槽遮蔽语义变化（同 priority 会 fail-loud 抛错，启动日志可见） | dev 形态 `grep -n 'PANEL_ID =' vendor/qilin/node_modules/dsh-animations/lib/client.js` 应仍为 `"anim-panel"`；核对 ui-slots `register` 遮蔽语义（`packages/client/ui-slots/src/index.ts:1142` 一带）未变；双图标 = id 失配，按新 id 更新 `client-brand` 遮蔽条目 |
| **R-体积** 闭包/公证面变化 | +telemetry/otel、+schedule-bundle、−ui-brand-official | Step 5.1 后对比 `dist-exe` 体积与 3.0.5 基线；macOS 公证耗时异常则复查（预计净变化小） |

## 5. 回滚预案

- **合并前（分支上）**：直接弃分支；已同步的快照随分支丢弃。
- **合并后**：
  ```bash
  git checkout <升级前 main SHA> -- vendor/qilin upstream.lock.json kstock/web/cordis.patch.yml scripts/patch_vendor_skills.py scripts/build-engine-bundle.sh apps/desktop/electron/lib kstock/automation pnpm-lock.yaml
  pnpm install
  scripts/qilin-pnpm.sh install --frozen-lockfile && scripts/qilin-pnpm.sh run build
  bash scripts/build-engine-bundle.sh --force-exe-build   # 快照回退后产物必须重建
  ```
- **profile 面（定时任务切换回滚）**：`withScheduleBundle` 幂等但单向（只增不删）——回滚到旧桌面壳后，profile bundles 里残留的 `@qilin/experimental-schedule-bundle` 层在新快照（3.0.5）下解析失败会**阻断引擎启动**。回滚时需手工修剪 profile：
  ```bash
  node -e "const p=process.env.HOME+'/.kstock/qilin-home/profiles/kstock/package.json';const m=require(p);m.qilin.profile.bundles=m.qilin.profile.bundles.filter(b=>b!=='@qilin/experimental-schedule-bundle');require('fs').writeFileSync(p,JSON.stringify(m,null,2)+'\n')"
  ```
- **数据层**：无回滚需求（会话格式 v4 未变；automation 定义数据原地滞留、未被触碰）。

## 6. 计划自检

- **覆盖核对**：1.4 必改清单 9 项 → Task 1（补丁 22）、Task 2（cordis.patch.yml 组合面）、Task 2B（profile bundles + 桌面壳迁移 + 死链清理）、Task 2C（构建清单 + 包退役）、Task 2D（侧栏置顶遮蔽条目）、Task 3.4（lock）、Task 8.1（文档）；D4（数据不迁移）落在 Task 8.1 的发布说明迁移指引与烟测 7-7；1.2 表中所有「无动作」项在 Task 7 烟测有对应回归点（品牌 7-2/7-3、外链 7-5、sidebar-right 7-6、调度切换 7-7/7-7b、侧栏置顶 7-7c、动效 7-9、ui-chat 7-10）。✅
- **占位符扫描**：所有代码块为最终形态（补丁 22 全量替换体、yml 删除段、`withScheduleBundle` 全量实现与测试、死链清理片段、构建清单行、遮蔽条目注册体与图标组件、回滚 node 单行），无 TBD/TODO。✅
- **一致性**：`_fix_qilin_verify_closure_glob` 函数名与 `apply_skill_patches` 注册行（patch_vendor_skills.py:2190-2193）一致；`SCHEDULE_BUNDLE` = `@qilin/experimental-schedule-bundle` 与上游 `OPTIONAL_BUNDLES`（app-boot/src/profile.ts:297）、bundle 包名（packages/experimental/schedule-bundle/package.json）一致；`withScheduleBundle` 的锚定次序（动效层优先、`@qilin/web-app` 兜底）与 `PROFILE_BUNDLES` 五层顺序一致；Task 2C 的残留断言与 S4b 症状互证；Task 2D 的 `anim-panel` id 与 dsh-animations `PANEL_ID` 实值一致、`priority:-1` 遵循槽遮蔽语义（同 priority 抛错 → 不同 priority 合法遮蔽）、order 20 落位与 7-7c 断言互证。✅
- **方向核对**：文档中所有关于 schedule 的表述已统一为「启用原生、退役自研」——烟测 7-7/S4/S4b、决策 D1/D3/D4/D5、回滚 profile 面均已按新方向书写，无 3.0.5 旧口径残留。✅

---

## 执行记录（2026-10-01，upgrade/qilin-3.0.7，Mac 开发机）

**结论：升级完成，全链验证通过。** 10 个提交（基线 → 补丁 22 重写 → cordis 组合面 →
profile 调度层 → automation 退役 → 侧栏置顶 → 快照同步 → CI 断言反转 → runtime
bundle 清单剔除），合并前烟测 12 项全过（7-3 按上游形态修正为 4 分区，见下）。

**关键验证输出（实测）**：

- 补丁重放：6 个引擎补丁全绿（build-exe / lefthook / ui-chat / verify-runtime-closure /
  client-build-environment / SidebarRoot CSS），零锚点失配——重写后的补丁 22 首战命中
- 闭包门禁：`verify-runtime-closure: 11 agent presets and 145 workspace packages form a
  closed runtime dependency graph.`（11 = 4 shipped + 7 KStock，S3 未触发）
- 引擎构建：284 client artifacts；分发束 dist-exe 569M（kstock-engine 406M +
  12 插件**无 automation** + 7 presets）；staging 闭包 209M tar（解压端自检 104 条目通过）
- check:ci 全绿（含反转后的断言：`source engine schedule bundle layer` /
  `source engine schedule capability retired`）
- 首启迁移（7-7b 实测）：日志「kstock profile 已更新（插件依赖 / 动效技能库层 /
  调度 bundle 层）」；profile bundles 五层含 `@qilin/experimental-schedule-bundle`；
  `node_modules/@kstock/automation` 死链已清理
- 引擎 3.0.7 无头启动（打包闭包 + 系统 Node）：schedule bundle 解析成功、
  `dsh-animations: 8 runtime skills registered`、零 `patch: ... matches nothing` 告警
- 烟测（用户真机目检 + 无头验证）：7-1/7-2/7-4/7-5/7-6/7-7/7-7b/7-7c/7-8/7-9/7-11 ✅；
  7-3 按上游形态修正（4 分区）；7-10 随上游测试面（未逐项目检）

**计划外发现与处置（三项，均已提交）**：

1. `scripts/verify_package_resources.py` 的 CI 门禁仍断言旧口径（cordis.patch.yml
   必须含 `id: schedule` disabled 行）→ 反转为「bundle 层存在 + 退役标记零命中」
   双断言（c375a80f）。
2. `scripts/build-runtime-bundle.sh` 的构建/组装清单仍含 automation（Task 2C 只改了
   build-engine-bundle.sh）→ 同步剔除（2554f2a8）。
3. **计划流程缺口**：Task 6 `build:desktop` 依赖 `staging/` 由
   `build-runtime-bundle.sh` 预建——计划 Task 5 只重建了 dist-exe，本地首次打包进了
   旧闭包（症状即 S4：`cannot resolve profile bundle`）。后续升级手册需在 Task 5/6
   之间固定「runtime bundle 重建」步骤。

**上游行为变更（用户拍板接受）**：3.0.7 B5-2c sidebar-right 重写撤掉了设置页
「侧栏右侧」分区注册（tab 管理移至右栏内联 tab 菜单）；KStock 图标映射补丁保留
（分区若回归自动就位），设置页 KStock 分区为 4 个。

**环境备注（Mac 开发机执行）**：① DSH 会话上下文启动 Electron GUI 会被
`task_name_for_pid (os/kern) failure` 拒绝（responsible process 归因）——烟测以
「无头引擎（打包闭包 + 系统 Node 直跑 runtime-bootstrap）+ 用户浏览器目检」完成，
`open`/Finder 由用户发起不受影响；② 本地未签名构建（`KSTOCK_UNSIGNED_BUILD=1`）
在 electron-builder 26 跳签 + Electron 模板残留 seal 组合下出现
「code has no resources but signature indicates they must be present」，需
`codesign --force --deep -s -` 手动重签后方可启动（仅本地验证形态；CI 发布链
走正式签名不受影响）；③ lock 刷新按 Mac 适配用 `--refresh-lock`（结果与手改目标
一致：QiLin → f91c39f6/3.0.7，KSkills 不变）。
