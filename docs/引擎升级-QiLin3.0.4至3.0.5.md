# QiLin 引擎升级计划：3.0.4 → 3.0.5（修订版）

**Goal:** 把 KStock 锁定的上游引擎从 `9798395b`（tag `v3.0.4`）升到 `d456452786`（tag `v3.0.5`），
消除 3 个必然失败项（2 处补丁锚点失配 + 1 处上游门禁空转）、完成 1 次单向数据迁移的准备，
并按两条**产品决策**改造引擎面：
**① 保留自研 `@kstock/automation`（定时任务），显式下架引擎新增的 `schedule` / `ui-schedule`；
② 启用上游内置的「动效技能库」`dsh-animations`（8 个 HTML 动画技能 + 侧边栏工作台）。**

**Architecture:** KStock 是 QiLin「一切皆插件」平台上的产品层：引擎源码以快照落在 `vendor/qilin`
（`scripts/sync_upstreams.py` 整树重建 + 两个幂等补丁脚本重放本地定制）；KStock 的 13 个插件包与
Electron 壳**不声明任何 `@qilin/*` 依赖**，只经编译期（tsc typeRoots）与运行期（slots / 服务注入）消费引擎面；
运行形态是一个**自建 profile**（`~/.kstock/qilin-home/profiles/kstock/package.json`，由桌面壳程序化生成），
其 `qilin.profile.bundles` 决定叠层顺序。

**Tech Stack:** Node ≥22.19（Electron 44 内置 Node）、pnpm 11.7.0（`scripts/qilin-pnpm.sh` 钉版）、
tsdown / esbuild / tsc、Python 3（补丁与契约校验脚本）、Bash（构建与打包）。

**状态:** 本文件为**计划**，尚未执行；代码与快照均未改动（只读分析产出）。

> 配套**执行手册**：[plans/2026-09-28-qilin-3.0.5-implementation.md](2026-09-28-qilin-3.0.5-implementation.md)（逐步命令、期望输出、红路径与失败处置）。
> 本修订版取代同日的前一稿，变更集中在第 2 章（新增「产品决策与落地口径」）与 Phase 4。
> 已核实项未变的，沿用前一稿结论与证据。

---

## 0. 结论摘要（TL;DR）

| # | 结论 | 级别 |
|---|---|---|
| C1 | **两处补丁锚点在 3.0.5 失配**：`SettingsRoot.tsx` 导入块锚点（**响亮失败**，构建中断）、`ui-chat/apply.ts` 的 `openExternalLink` 锚点（**静默跳过**，外链白屏修复无声丢失） | **阻断** |
| C1b | **上游 `verify-runtime-closure` 门禁指向不存在的目录**（后续分析见附录复现命令）→ 门禁 exit 1，而它是 exe 流水线**第一步**、也是运行时闭包构建的必经步 ⇒ **两条打包路径同时中断** | **阻断** |
| C2 | 会话格式 `SESSION_FORMAT_VERSION` **3 → 4**，写打开自动迁移（只读浏览不落盘）→ 单向门 + 需先备份 | **高** |
| **P1** | **决策一**：保留 `@kstock/automation`；在 `kstock/web/cordis.patch.yml` 显式 `disabled: true` 下架引擎 `schedule` + `ui-schedule`；保留无 UI 的 `time-context` | 已定 |
| **P2** | **决策二**：启用 `dsh-animations`。**它已在安装闭包里**（`@qilin/cli` 的生产依赖，3.0.4 闭包实测含同类传递包），因此**唯一必需改动是 profile 的 `bundles` 数组**（+ 存量 profile 迁移 + 构建门禁） | 已定 |
| C3 | 启用动画包会新增**第二个侧边栏面板**（id `anim-panel`，`order: 120`），与 `@kstock/automation`（id `kyl-automations`，`order: 120`）**撞序**（id 不撞）；建议把 automation 改为 `order: 110` | 低 |
| C4 | 新增**插件 runtime 版本兼容准入**：KStock 插件无 `peerDependencies` → 不受影响；`dsh-animations` 的 peer 全是 `@deepseek-ai/` 作用域 → 机制**不检查**，也不会被拒 | 低（约束） |
| C5 | 上游删除 `apps/desktop` + `apps/desktop-host`（−34k 行）→ KStock 自研壳**零引用，无源码影响** | 无 |
| C6 | `kstock/pnpm-workspace.yaml` 缺 `news-ui` / `chan-ui` 两个成员（既有缺陷） | 中（顺带修） |
| C7 | 编译期面（20 处 `@qilin/*` import、`PLATFORM_MODULES`、`client/modules` 契约、`ui-slots`、bundle patch 目标行、25 个 preset 引用包名）**全部未变**；8 个动画技能与 KStock 现有 47 个技能**零重名** | 无 |
| C8 | 运行期防回归门禁 `verify_engine_client_faces` 的 10 条锚点**全绿** | 无 |

---

## 1. 基线与差异规模

| 项 | KStock 当前锁定 | 上游 3.0.5 | 差异 |
|---|---|---|---|
| commit | `9798395b03baf6035442cc4220d187fe5c6189fe` | `d456452786f1e8c71dd5aea8515632a76f1c085a` | **74 个提交** |
| tag | `v3.0.4` | `v3.0.5` | — |
| package.json version | `3.0.4` | `3.0.5` | 版本号真正对齐 |
| 差异规模 | — | — | **4439 文件，+383,247 / −121,874** |
| KSkills | `fd01489` | `fd01489`（未动） | **跳过 `--sync-skills`** |

> 版本口径：本跳上游 HEAD 的 `package.json` 已是 `3.0.5`，`upstream.lock.json` 将记录 `3.0.5`
> （上次记 `3.0.4` 是因为当时上游 tag 领先 package.json 一号）。`docs/上游同步.md` 的「版本口径」段随之简化。

---

## 2. 产品决策与落地口径（本次修订核心）

### 2.1 决策一：保留 `@kstock/automation`，下架引擎日程三件套

**引擎侧变化**：`@qilin/web-app` 的 patch 行由 108 → 114，新增
`schedule`（`@qilin/schedule`，host 能力 + `schedule_*` 工具）、`ui-schedule`（客户端 UI）、
`time-context`（请求时钟上下文）、`job-controller`、`shortcuts`、`ui-shortcuts`；
其中 `ui-schedule` 的 `disabled: true` 被去掉（`eca807f0ad`「schedule 能力随附启用」）。

**冲突事实**：

| 面 | `@kstock/automation` | 引擎 `ui-schedule` |
|---|---|---|
| 侧边栏面板 | `sidebar.panellist`，id **`kyl-automations`**，`order: 120` | `sidebar.panellist`，id **`schedules`**，`order: 10` |
| 主面板 | `main`，key `kyl-automations` | `main`，key `schedules` |
| 模型工具 | `automation_*` 六工具 | `schedule_create/delete/list/update` |

**落地口径**：在 `kstock/web/cordis.patch.yml` 末尾追加两行 `disabled: true`
（下架 host 能力 + 其唯一 UI 消费者），**保留 `time-context`**（纯上下文注入、无 UI、有助于时间感知）。

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

**验收**：真机侧边栏只有「定时任务」一个任务面板（`kyl-automations`，无 `schedules`）；
工具名册无 `schedule_*`；`kstock/web/cordis.patch.yml` 既有的 5 个目标 id 未被破坏
（`verify_package_resources.py --source-only` 通过）。

### 2.2 决策二：启用上游内置「动效技能库」`dsh-animations`

#### 2.2.1 它是什么

| 项 | 事实 |
|---|---|
| 包 | `dsh-animations`（npm 公共包，MIT，仓库 `github.com/kkutysllb/dsh-animations`），引擎侧声明 `apps/cli/package.json:108` → `^1.2.3`，lockfile 实锁 **1.2.3** |
| 形态 | 树外组合包：`qilin.bundle.patch = ./cordis.patch.yml`（只 `insert` 一行自身） + `qilin.client = {platform: web, inject: [4 个 @deepseek-ai/dsh-client-*]}`，客户端产物 `exports["./client"] = ./lib/client.js` |
| 宿主半端（`entry.js`） | `inject = ['skills','systemPrompt']`；激活时读包内 `skills/manifest.json`，把 **8 个 HTML 动画技能**注册为 runtime skill（`source:'runtime'`，`resourceBase` 指向包内技能目录 → **全局层，对该 profile 下所有会话可见**）；并向 systemPrompt 注入一段能力通告（`order: 207`，可经 `config.annotateToAgent` 关闭）；激活时向 stdout 打印一行诊断 |
| 8 个技能 | `ppt-animation`、`flowchart`、`network-protocol-viz`、`dynamic-archify`、`scholar-notes`、`card-theater`、`video-shot-demos`、`phone-ui-demos` |
| 客户端半端 | 左侧栏「动效技能库」工作台：`sidebar.panellist` id **`anim-panel`** + `main` key `anim-panel`，`order: 120` |
| 通道语义 | `ANIMATIONS_BUNDLE = 'dsh-animations'`，且 `PROFILE_OWNED_BUNDLES = ['dsh-animations']` —— **唯一「profile 优先解析」的随附层**：装进 profile 的副本（`qilin plugin add dsh-animations@latest` 或插件页更新）优先于安装实例的种本 |

#### 2.2.2 为什么 KStock 的 `kstock` profile 不会自动获得它

- `PROFILE_TEMPLATES` 只在 `web` 与 `qilin` 两个模板里种下 `dsh-animations`；
- KStock 的 profile 名是 **`kstock`**，不在 `PROFILE_TEMPLATES` 键内 → `normalizeShippedProfile`
  （`app-boot/src/profile.ts:997`）首行 `template === undefined` 直接返回，
  **既不补层、也不改写 bundle 列表**（这一点对既有 profile 是保护，对本次决策则是障碍）；
- 因此必须由 KStock 显式把 `dsh-animations` 写进 profile 的 `qilin.profile.bundles`。

#### 2.2.3 「要不要把包装进产物」——已核实：**不需要，它已在安装闭包里**

三个关键事实：

1. 运行时闭包的 deploy 根是 **`python/sdk-runtime`（包名 `qilin-python-runtime-closure`）**，
   而它 `dependencies` 里含 **`@qilin/cli: workspace:^`**（= `apps/cli`）；
   `dsh-animations` 是 `apps/cli` 的生产依赖 → **随 `pnpm deploy --prod` 进入闭包**。
2. **实测旁证**：KStock 现有的 3.0.4 闭包（`staging/kstock-runtime/`，2026-09-22 构建）里
   已有 `@qilin/base@3.0.4`、`@qilin/web-app@3.0.4`、`@qilin/cli@3.0.4`、`@qilin/agent-presets@3.0.4`
   ——这些同样只是 `apps/cli` 的依赖，证明**传递依赖确实落进闭包**；
   该闭包没有 `dsh-animations`，是因为 **3.0.4 的 `apps/cli` 尚未声明它**。
3. 两条打包路径都能带上它：
   - **运行时闭包路径**（`build-runtime-bundle.sh` + `materialize-runtime-closure.mjs`）：
     `pnpm --filter qilin-python-runtime-closure deploy --legacy --prod` 整棵复制 → 含
     `node_modules/dsh-animations/` 全量（含 `skills/`、`entry.js`、`cordis.patch.yml`、`lib/client.js`）；
   - **旧 SEA 单文件路径**（`build-engine-bundle.sh`）：`ASSET_GLOBS` 已新增
     `node_modules/dsh-animations/skills/**/*`（上游 `1943249699`），且既有 glob 覆盖
     `**/*.js`、`**/*.yml`、`**/package.json`、`**/*.md` → 补丁、入口与技能正文均能入包。

**解析链**（`resolveBundleDir`，`app-boot/src/profile.ts:1089-1103`）：
`dsh-animations` 属 `PROFILE_OWNED_BUNDLES` → 锚点顺序为
`[<profileDir>/package.json, <安装锚点>]`；安装锚点 `INSTALL_ANCHOR = <apps/cli>/package.json`
（`apps/cli/src/profile-boot.ts:81`）。两个锚点在本项目都能命中：

- dev/源码态：`vendor/qilin/apps/cli/node_modules/dsh-animations`（`pnpm install` 后按 lockfile 就位）；
- 打包态：闭包内 `node_modules/dsh-animations`（`createRequire` 从 `node_modules/@qilin/cli` 向上找到
  `node_modules/` 层即可命中）。

> ⚠️ 反过来说：**一旦 profile 声明了该层而闭包里没有它，`loadProfileDirectory` 会直接抛错 → 引擎启动失败**
> （不是软降级）。而且这个错误在**构建期完全不报**：
> - `pkg` 的资产 glob 空匹配时返回 `[]` 并静默跳过（无空集合校验）→ SEA 路径构建成功、运行时 ENOENT；
> - `verify-runtime-closure` 只遍历 **workspace 包**（`if (!workspace.has(dependency)) continue`），
>   对 `dsh-animations` 这类非 workspace 依赖**完全不可见**。
>
> 因此 Phase 4 的**构建期门禁（T4.5）是唯一能拦住它的闸门**，必须做实。

#### 2.2.4 方案对比（为什么选「profile 清单加一行」）

| 方案 | 改哪 | 副作用 | 结论 |
|---|---|---|---|
| **A（推荐）profile 清单加一行** | 仅 KStock 侧 profile `bundles`；包由安装闭包提供 | 闭包 +82MB 未压缩（`skills/` 80MB、108 个 HTML）；tar.gz 估算 +10~25MB；公证面只多非 Mach-O 资源 | ✅ 采用 |
| B 给 `python/sdk-runtime/package.json` 加依赖 | 上游快照 | **无效**（闭包经 `@qilin/cli` 本就含它）且引入 sync 冲突 | ❌ 不做 |
| C profile 自持副本（`qilin plugin add dsh-animations`） | profile 目录 | 对闭包零依赖、可自行升级；但需联网 npm、用户机多占 82MB | ⏸ 留作「不发版即升级」通道（`PROFILE_OWNED_BUNDLES` 已支持） |
| D 从 `apps/cli` 移除该包 | 上游 | **打破上游门禁**：`PROFILE_TEMPLATES.web.bundles` 含该名，门禁要求它必须是 workspace 包或 `apps/cli` 的运行时依赖 | ❌ 不做 |

> 硬约束：`apps/cli` 的声明与 `PROFILE_TEMPLATES.web` 的名单被上游 `verify-default-product-isolation`
> 门禁绑死，不能拆开 —— 因此只有「随附」或「profile 自持」两条路，本次选随附。
> 供应链门禁已放行：`pnpm-workspace.yaml:93` 的 `minimumReleaseAgeExclude` 含 `dsh-animations@1.2.3`。

#### 2.2.5 最小改动面（三处，全部在 KStock 侧）

| # | 文件 | 改动 |
|---|---|---|
| 1 | `apps/desktop/electron/lib/engine.ts`（`ensureKstockProfile()`） | 新 profile 写入的 `bundles` 增加 `dsh-animations`（位置对齐上游模板：紧跟 `@qilin/web-app`）；**并给 else 分支补存量迁移**（现在只刷新 `dependencies`，不碰 `bundles`） |
| 2 | `scripts/register-profile-plugins.sh` | 自愈脚本同样补 bundle 列表（现有安装升级后无需重装即可获得该层） |
| 3 | `scripts/verify_package_resources.py` | 新增门禁：产物闭包里必须存在 `node_modules/dsh-animations/{package.json,skills/manifest.json,cordis.patch.yml,entry.js,lib/client.js}`；且桌面壳源码必须把 `dsh-animations` 写进 `bundles` |

**代码片段（T4.2 用）**：

```ts
/** 产品 bundle 叠层（顺序即 patch 应用顺序，末位最权威）。 */
const PROFILE_BUNDLES = ["@qilin/base", "@qilin/web-app", "dsh-animations", "@kstock/web"];
...
  if (!existsSync(manifestPath)) {
    mkdirSync(profileDir, { recursive: true });
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  } else {
    try {
      const existing = JSON.parse(readFileSync(manifestPath, "utf8")) as {
        dependencies?: Record<string, string>;
        qilin?: { profile?: { bundles?: string[]; patchReload?: string } };
      };
      const deps = existing.dependencies ?? {};
      const bundles = existing.qilin?.profile?.bundles ?? [];
      const staleDeps = packages.some(([name, dir]) => deps[name] !== `link:${join(pluginRoot, dir)}`);
      // 幂等补层：只在缺失时插入，插入点对齐上游模板（@qilin/web-app 之后），
      // 保留用户或引擎自行追加的其它条目，不改 patchReload。
      let nextBundles = bundles;
      if (!bundles.includes(ANIMATIONS_BUNDLE)) {
        const anchor = bundles.indexOf("@qilin/web-app");
        nextBundles = [...bundles];
        nextBundles.splice(anchor >= 0 ? anchor + 1 : nextBundles.length, 0, ANIMATIONS_BUNDLE);
      }
      const staleBundles = nextBundles !== bundles;
      if (staleDeps || staleBundles) {
        if (staleDeps) existing.dependencies = dependencies;
        if (staleBundles) {
          existing.qilin = {
            ...existing.qilin,
            profile: { ...existing.qilin?.profile, bundles: nextBundles },
          };
        }
        writeFileSync(manifestPath, `${JSON.stringify(existing, null, 2)}\n`);
        logMain("kstock profile 已更新（插件依赖 / 动效技能库层）");
      }
    } catch (error) {
      logMain(`kstock profile 清单读取失败，保留原样：${String(error)}`);
    }
  }
```

其中 `const ANIMATIONS_BUNDLE = "dsh-animations";`。注意：`bundles` 为空（损坏/极老 profile）时，
`splice(0, 0, …)` 会得到 `["dsh-animations"]`，缺 `@qilin/base` / `@qilin/web-app` → 引擎起不来；
因此**当 `bundles.length === 0` 时整体写入 `PROFILE_BUNDLES`**（在实现里补这一支）。

#### 2.2.6 交互面影响

| 面 | 变化 | 处置 |
|---|---|---|
| 侧边栏 | 多一个「动效技能库」面板（`anim-panel`，`order: 120`） | 与 `kyl-automations`（`order: 120`）**撞序**；契约是「升序，平序按注册顺序」（`ui-sidebar/src/client/contract/slots.ts:83`），而注册顺序取决于插件激活序 → 实际不稳定。**建议把 `@kstock/automation` 面板改为 `order: 110`**（定时任务在前，动效技能库在后） |
| 技能名册 | 每个 preset 的会话都会多出 8 个技能 | 与 KStock 现有 47 个技能**零重名**（已逐一比对）；`includeShippedRoot:false` 不影响 bundle 全局层 |
| 系统提示 | 多一段能力通告（`order: 207`） | 保留（正是「要使用」的语义）；如后续要静默，可在 bundle 行的 `config.annotateToAgent` 关闭 |
| stdout | 激活时打印一行 `dsh-animations: 8 runtime skills registered (...)` | 无害（桌面壳的就绪正则只匹配 `/workspace?token=…`） |
| 插件管理页 | `builtInBundles = PROFILE_TEMPLATES['kstock'] ?? []` → `[]`，故该层显示为 **user/可移除/可更新** | 与上游「随附层不可移除」口径不同。**可选增强**：给引擎补一个 `kstock` 模板（见下） |
| 更新通道 | `PROFILE_OWNED_BUNDLES` 使 profile 副本优先 → 用户可 `qilin plugin add dsh-animations@latest` 就地升级 | 保留通道，不与产品升级冲突 |

**可选增强（不列入本次必须项）**：在 `patch_vendor_engine.py` 里新增一条引擎补丁，
给 `PROFILE_TEMPLATES` 加 `kstock: { bundles: ['@qilin/base', '@qilin/web-app', 'dsh-animations'] }`。
收益：`normalizeShippedProfile` 会在每次加载时**自动收敛** bundle 列表（存量 profile 免费获得该层），
且插件页显示为 builtin/不可移除。代价：多一处引擎源码补丁（补丁面 5 → 6 个文件）、
依赖上游 `normalizeShippedProfile` 语义稳定、且与上游门禁 `verify-default-product-isolation`
「模板层须是 workspace 包或 apps/cli 的运行时依赖」的口径存在张力（`@kstock/web` 不满足，
但该门禁只在引擎仓 CI 运行、KStock 不跑）。**建议本次不做，留作后续简化项。**

---

## 3. 3.0.5 变更分析（对 KStock 有影响的部分）

### 3.1 结构性 / 破坏性

| 变更 | 提交 | 对 KStock |
|---|---|---|
| 删除桌面壳 `apps/desktop` + `apps/desktop-host`（501 文件、−34,403 行） | `ebbfe1d312` `feat!` | **零引用**（`grep -rn "desktopUpdate\|desktopHost\|desktop-host" apps/ kstock/ scripts/` 无命中）→ 无源码改动；`vendor/qilin/apps/` 只剩 `cli` + `web` |
| 删除 `agent-team-web-profile`（197 文件） | `76cd179c08` `feat!` | 未引用 → 无 |
| 设置页删除桌面更新桥（`DesktopUpdateIndicator` / `desktop-update-bridge.ts` / `desktop-update-source.ts`），`SettingsRootInjected` 删 `openDesktopUpdate`/`desktopUpdate` | `ebbfe1d312` | KStock 自研壳走 `apps/desktop/electron/lib/updater.ts` → 无 |
| 设置页「模态框化 → 撤回整页布局」 | `d91d6b2109` → `b4e462bb52` | **触发 B1**（`navIcon` 补丁锚点） |

### 3.2 数据格式：会话 v3 → v4（最高风险面）

- `packages/core/session/src/types.ts:89` `SESSION_FORMAT_VERSION` **3 → 4**；
  `session-format-catalog/src/generated.ts:19` `currentVersion: 4`，迁移链 `v0→v1→v2→v3→v4` 完整；
  新增迁移包 `packages/session/session-format-v3-to-v4`。
- 实质变更（`docs/persistence-changes/2026-09-16-session-format-v4.md`）：14 个 event root 版本跳变；
  `Message` 移除 `tool-result`、新增一等 tool-role 结果与 producer-owned source；新增 `developer/message`；
  `turn/end.reason` 新增 `forked`。
- **自动迁移**：只读打开不落盘（`session-persistence-jsonl/src/index.ts:378-400`）；
  **写打开才发布 v4 后继**（`:417` → `publishStoredMigration:722`）。
- **显式脚本**：`pnpm run migrate:sessions-to-v4 [--sessions-dir PATH] [--jobs N]`
  （`scripts/migrate-sessions-to-v4.ts`）：前置断言 writer/catalog 均为 v4（`:214-215`）→ **必须在 3.0.5 检出上跑**；
  **非原地**（源 v3 保留，`generation.ts:891-950`）；幂等；有失败即 exit 1。
- **回滚单向**：`resolveGenerationInDirectory` 取版本最高者（`:1477-1508`）；回滚 = 删该会话目录的
  `session.v4*.jsonl.zstd`。
- 另两条：`schedule/change` 的 `title` 变可选；`subagent/catalog` payload v1 加 unknown 模式（旧读者拒绝）。
- `storage-json` 收紧：`format.ts:69-75` 拒绝「数组形态 tables」（此前静默当空表并覆盖）。
- 路径语义未变（`home-paths` 区间零逻辑改动）→ `QILIN_HOME=~/.kstock/qilin-home` 仍被识别；
  HEAD `d456452786` 修了迁移脚本默认目录（`~/.dsh/sessions` → `qilinHomePath('sessions')`），**本跳必须包含**。

### 3.3 运行时新机制：插件 runtime 版本兼容准入（3.0.5 新增）

- 3.0.4 无此机制（`git grep "incompatible-version\|getQilinRuntimeVersion" 9798395b` → 0 命中）。
- 规则（`packages/boot/app-boot/src/plugin-compatibility.ts`）：只比对 `peerDependencies` 中 `@qilin/` 作用域的键；
  `@qilin/kylin`、`@qilin/cosmokit`、`@qilin/schemastery`、`@qilin/node-addon-system`、`@qilin/kylin-plugin-*` 豁免；
  `workspace:^|~|*` 表示「正在运行的 runtime」。四条准入路径：插件行（挂 `disabled`）、
  **bundle 行**（`profile.ts:1293` → **启动即抛**）、preset 行、安装前检查。豁免文件为 profile 目录下 `compatibility.json`。
- **KStock 影响（无）**：13 个 KStock 包无 `peerDependencies` → 首行即返回 `undefined`；
  `@kstock/web` 同样无 peer；`@qilin/base` 仅 peer `@qilin/kylin`（豁免）；`@qilin/web-app` 的 peer
  为 `@qilin/kylin` + `@qilin/kylin-plugin-loader`（豁免）+ `@qilin/shell-env`/`@qilin/system-prompt`（`workspace:*`）。
- **`dsh-animations` 影响（无）**：其 5 个 peer 全是 `@deepseek-ai/dsh*` 且 `optional: true` →
  不在 `@qilin/` 作用域内，机制**根本不检查**。
- **遗留约束**：今后给 KStock 插件加 `@qilin/*` peer 必须写 `workspace:^`。

### 3.4 工程与依赖

- Node engines `^22.19.0 || >=24.0.0` 未变；`packageManager` 仍 `pnpm@11.7.0`。
- `@earendil-works/pi-ai` 0.85.1 → 0.87.1；`@qilin/kylin` 4.0.2 → 4.0.3（名未变）；
  `patchedDependencies` 去掉 `@electron/osx-sign`（KStock 不直接依赖）。
- 依赖范围政策：全仓 `workspace:^` 统一改写（harness `*` / vendor 系 `~`），316 个 manifest 重写 → KStock 无 `@qilin` 依赖，无影响。
- **Office kit 0.0.1 → 0.1.0**（`packages/skill/skill-office/package.json:43` 新增 `@deepseek-ai/libreoffice-kit: ^0.1.0`）
  → 闭包多出 `@qilin/skill-office`、`@qilin/tool-workspace-dependencies`；tar.gz 体积/公证面上升。
- 随附层通道（`1943249699`）：模板 `web`/`qilin` 各加 `dsh-animations`；`normalizeShippedProfile` 改为「补回模板层 + 保留用户条目」。
- `dsh-animations` 相关的两处上游声明：`apps/cli/package.json:108` 的 `^1.2.3` 与
  `ASSET_GLOBS` 新增 `node_modules/dsh-animations/skills/**/*`。

---

## 4. KStock 集成面核查表

### 4.1 无需改动（附证据，节选关键项）

| 核查项 | 结论 |
|---|---|
| CLI 参数 `--profile kstock --port --no-open`、就绪信号 `/workspace?token=` | 未变 → 壳无需改 |
| exe 产物基名 `deepseek-harness-sdk-runtime-<target>`、伴随 `-rg`/`-spawn-helper`/`-office` | 未变 → `build-engine-bundle.sh` 无需改 |
| Node/pnpm 版本 | 未变 |
| `KSTOCK_PRESETS_DIR` → `agent-presets.config.roots` 机制与 schema（4 键） | 未变 |
| bundle patch 目标 5 行（`system-prompt`/`web-runtime`/`accounts`/`agent-presets`/`ui-agent-preset`） | 五个 id 全在，**行 config 逐字相同** |
| KStock preset 引用的 25 个 `@qilin/*` 包名 | 全部存在 |
| 上游 `standard` 预设 3.0.4 ↔ 3.0.5 | **逐字节相同**（266 行 diff 为空）→ KStock fork 无漂移 |
| `PLATFORM_MODULES`、`client/modules/src/client/manifest.ts`、`packages/client/ui-slots/src` | 未变 / diff 为空 / 区间零改动 |
| KStock 用的 11 个槽名 + 20 处编译期符号 + 14 个图标 | 全部存在 |
| 宿主服务面（`webServer.register`、`host/webserver`、`frontend-static`、`agents.*`、`workspaceRegistry.*`、`agentDefaultModel`、`connection.requestRejection`） | 区间零改动 |
| `@qilin/accounts-local`、`@qilin/skill-filesystem` 源码；`dsh` 旧键与别名表；`window.__ModuleLoader__.load` 头契约 | 未变 |
| **`dsh-animations` 的 4 个 inject 别名** | `@deepseek-ai/dsh-client-locale` / `-ui-slots` / `-ui-conversation` / `-ui-workspace` 逐条映射到存在的 `@qilin/*` 包 |
| **`dsh-animations` 客户端产物契约** | 宿主按 `exports["./client"]` 取产物（`client/modules/src/index.ts:220-230`），其 `./lib/client.js` 为 `window.__ModuleLoader__.load({id,factory})` 手写形态 → 与 KStock 自研客户端插件同款，契约未变 |
| **技能名冲突** | `dsh-animations` 8 个技能名 与 KStock 47 个技能名 **零交集** |

### 4.2 必须改动（阻断项）

| # | 位置 | 问题 | 证据 |
|---|---|---|---|
| **B1** | `scripts/patch_vendor_engine.py:26-38` `OLD_IMPORTS` | 3.0.5 import 块末行变为 `IconSettingsOutline16, useModalLayer,`（`useModalLayer` 由 `040ffa3382` 引入）→ 锚点失配 → `return 1`，`build-engine-bundle.sh:19 set -euo pipefail` + `:42` ⇒ **构建中断** | `marker in text` 同语义验证：**FAIL** |
| **B2** | `scripts/patch_vendor_skills.py` `_UI_CHAT_OPEN_LINK_ANCHOR`（`:1401-1408`） | 3.0.5 该处条件变为 `linkOpening.getSnapshot() === 'sidebar' && ctx.get('sidebarRightTabs')?.get('browser') !== undefined)` → 锚点失配 → `_fix_qilin_chat_link_preflight` **静默返回 None** ⇒ 外链白屏修复无声丢失 | 同语义验证：**FAIL**；函数注释自述「锚点失配静默跳过」 |
| **B3** | `scripts/build-engine-bundle.sh` 步骤顺序（`:74-78` exe 构建 vs `:80-83` 技能补丁） | `repairStagedScope` 补丁晚于 exe 构建应用 | 脚本行号比对 |
| **B4** | `vendor/qilin/scripts/verify-runtime-closure.ts:33` `AGENT_PRESET_GLOB` | 上游 `b1696f535b` 改为 `packages/bundle/web-app/presets/*.patch.yml`，该目录在 HEAD **不存在**（`git ls-tree -r … packages/bundle \| grep -c presets/` = 0；工作树亦无）→ `presetPaths=[]` → `failures` 非空 → `process.exitCode=1`；调用点 `build-exe-for-python-sdk.ts:633`（流水线**第一步**）与 `build-runtime-bundle.sh:73` ⇒ **两条打包路径同时中断**；`.gitlab-ci.yml:39,137`、`run-gates.ts:265/288/299` 同样红 | `globSync(...)` → `[]`；3.0.4 的 glob → 4 命中 |

> B1 / B2 / B3 / B4 都是「同步后必然发生」的确定性事件；B1 与 B4 会让两条打包路径同时中断，是最高优先级动作项。

### 4.3 需要决策 / 顺带修

| # | 事项 | 建议 |
|---|---|---|
| D1 | 引擎日程三件套 vs `@kstock/automation` | **保留 KStock，下架引擎 `schedule`+`ui-schedule`**（决策一，§2.1） |
| D2 | `dsh-animations` 启用方式 | **显式写进 profile `bundles` + 存量迁移 + 构建门禁**（决策二，§2.2.5） |
| D3 | 侧边栏撞序（`anim-panel` 120 vs `kyl-automations` 120） | `@kstock/automation` 改 `order: 110` |
| D4 | `kstock/pnpm-workspace.yaml` 缺 `news-ui`、`chan-ui` | 补两行 |
| D5 | 会话 v4 迁移 | 升级前整目录备份 + 在 3.0.5 检出上跑预检 |
| D6 | 文档口径：`KSTOCK_SKILLS_DIR` 在引擎（3.0.4/3.0.5）**无任何读取点** | 收尾时澄清；技能实走 `KSTOCK_PRESETS_DIR` + preset 自带 `skills/` |
| D7 | KSkills 工作树有 1 个未提交删除 | 本次**不跑 `--sync-skills`** |

### 4.4 在飞未提交改动（P0 必须先落地）

`main`（`73497853`）工作树有 **21 项**未提交改动，主体是**桌面端打包路径迁移**：
新增 `scripts/build-runtime-bundle.sh`、`scripts/local/{materialize-runtime-closure.mjs,smoke-runtime-closure.cjs,build-signed-macos.sh,presign-engine-macos.sh,entitlements-nested.plist}`、
`apps/desktop/electron-builder.local.yml`；改 `apps/desktop/electron-builder.yml`（`extraResources` 改为
`staging/kstock-runtime.tar.gz` + `staging/plugins` + `staging/presets`）、
`apps/desktop/electron/lib/engine.ts`（+81/−9，闭包解压到 `~/.kstock/runtime` 后用 `ELECTRON_RUN_AS_NODE=1` 直跑 `runtime-bootstrap.mjs`）、
`scripts/build-desktop.sh`（离线构建开关）。产物：`staging/kstock-runtime.tar.gz`（145MB，2026-09-22 23:58）。

**影响**：升级必须在两条打包路径上都成立（旧 SEA / 新闭包）；闭包路径是 `build-exe-for-python-sdk.ts`
的独立复刻，故 B3 的 `repairStagedScope` 修复在闭包路径**没有对应实现**，需一并移植（T5.2）。

---

## 5. 风险清单

| # | 风险 | 等级 | 缓解 |
|---|---|---|---|
| R1 | **补丁锚点失配**：B1 响亮 / B2 静默 | **高（B2 静默）** | T1.1/T1.2 修锚点；T1.3 让引擎补丁失配 fail-loud |
| R2 | **会话 v4 单向迁移** | **高** | 备份 `$QILIN_HOME/sessions`；先跑迁移预检；回滚删 v4 generation |
| R3 | **迁移硬拒绝**（淘汰语法 `retired-syntax.ts:27-40`、未知事件 `migration.ts:98-101`、子会话 catalog 冲突 `facts.ts:15-56`） | 中高 | 预检输出 `failureGroups`；整目录一起迁移 |
| R4 | **客户端运行时缝**：`SessionSummary.blank` 语义收紧（可能影响 `presets-ui` chip 禁用态）；`ui-sidebar-right` inject 4→7 → `news-ui` 必需 inject | 中高 | 只能真机冒烟（T6.4 第 5/6 项）；`blank` 经复核已折进 `byId[*].blank`，退为观察项（T5.3），**不做预防性改动** |
| R5 | **`verify-runtime-closure` 空转失败**（B4）→ 两条打包路径同时中断 | **高** | T1.5 回退 glob；建议回报上游 |
| R6 | **动画层的启动硬依赖**：profile 声明了 `dsh-animations` 而闭包缺包 → `resolveBundleDir` 抛错 → **引擎起不来**；且 `pkg` 资产空匹配静默跳过、`verify-runtime-closure` 对非 workspace 依赖不可见 → **构建期不会报错** | **高** | T4.5 构建期门禁（断言闭包内 `node_modules/dsh-animations/{package.json,skills/manifest.json(8 项),cordis.patch.yml,entry.js,lib/client.js}`）；T6.3 冒烟首项；T3.5 在产物重建处即断言 |
| R7 | **闭包体积/公证**：`dsh-animations` 未压缩 **+82MB**（`skills/` 80MB、**108 个 HTML**）+ Office kit 0.1.0 + 2 个新 `@qilin` 依赖 | 中 | 重建后对比 `staging/kstock-runtime.tar.gz`（3.0.4 基线 145MB / 未压缩 546MB）与 `presign-engine-macos.sh` 耗时；公证失败则回退「不带 office kit」并接受办公转换降级 |
| R8 | **构建路径分叉**：闭包路径无 `repairStagedScope` | 中 | T5.2 移植等价修复；靠 T1.5 恢复的门禁兜底 |
| R9 | **陈旧产物缓存**：快照后必须 `--force-exe-build`；闭包路径需先清 `staging/` | 中 | Phase 3 显式强制 |
| R10 | **工作树污染**：21 项在飞改动与升级 diff 混在一起 | 中 | P0 先独立提交，再开分支 |
| R11 | **storage-json 收紧**致畸形 KV 抛错 | 低 | T6.4 第 11 项回归 automation 定义/历史 |
| R12 | **preset 行新受兼容准入**（`mountPreset` 套 `prepareProfileEntries`）→ 被拒行「声明为有意不活动」，**静默** | 中 | T1.5 已把 `kstock/presets/*` 纳入 `verify-runtime-closure`（装配层可查）+ T6.4 第 12 项核对工具/技能面（运行层） |
| R13 | **侧边栏撞序**（`anim-panel` 与 `kyl-automations` 同为 120） | 低 | T4.3 把 automation 调为 110 |

---

## 6. 升级计划（分阶段）

> 前提：KStock 工作树干净（21 项在飞改动已独立提交）；上游 QiLin 工作树干净
> （`sync_upstreams.py` 复制的是**工作树**而非提交）。

### Phase 0 — 基线固化与分支（10 分钟）

- [ ] **T0.1 固化在飞改动**

```bash
cd /Users/libing/kk_Projects/KStock
git status --short                 # 期望：21 项
git add scripts/build-runtime-bundle.sh scripts/local apps/desktop/electron-builder.yml \
        apps/desktop/electron-builder.local.yml apps/desktop/package.json \
        apps/desktop/electron/lib/engine.ts scripts/build-desktop.sh .gitignore pnpm-lock.yaml
git commit -m "feat(desktop): 桌面端运行时闭包装配（staging 闭包 + Electron Node 直跑 + 本地签名流水线）"
```

验收：`git status --short` 只剩已被 `.gitignore` 覆盖的 `lib/` 构建产物。

- [ ] **T0.2 确认上游干净并开分支**

```bash
git -C /Users/libing/kk_Projects/QiLin status --short     # 期望：空
git -C /Users/libing/kk_Projects/QiLin log -1 --format='%H' # 期望：d456452786…
git checkout -b upgrade/qilin-3.0.5-2
```

> 用 `-2` 后缀：`upgrade/qilin-3.0.5` 是上次升级遗留分支（`43931980`，2026-09-21），勿复用。

---

### Phase 1 — 阻断项修复（先于同步，40 分钟）

- [ ] **T1.1 修 `SettingsRoot.tsx` 导入块锚点（B1）**

把 `scripts/patch_vendor_engine.py` 的锚点改为只锁定稳定子串，避免上游新增/重排导入再次打断：

```python
# 只锚定「IconQuestionOutline14, IconSettingsOutline16,」到作用域包名之间的行。
OLD_IMPORTS = """  IconQuestionOutline14, IconSettingsOutline16,
} from '@qilin/client-ui-primitives'"""

NEW_IMPORTS = """  IconApiOutline14, IconDatabaseOutline16, IconGaugeOutline16,
  IconPanelLeftOutline16, IconQuestionOutline14, IconSettingsOutline16,
  IconSkillOutline16,
} from '@qilin/client-ui-primitives'"""
```

（5 个新增图标在 3.0.5 的 `@qilin/client-ui-primitives/src/icons/index.tsx` 中均已存在；
`OLD_NAVICON` 锚点仍命中，不动。）

- [ ] **T1.2 修 `ui-chat/apply.ts` 外链预检锚点（B2）**

3.0.5 的实现：

```ts
          openExternalLink: (url) => {
            if (linkOpening.getSnapshot() === 'sidebar' && ctx.get('sidebarRightTabs')?.get('browser') !== undefined) {
              ctx.sidebarRight.openTab('browser', { params: { url } })
            } else {
              window.open(url, '_blank', 'noopener,noreferrer')
            }
          },
```

把 `_UI_CHAT_OPEN_LINK_ANCHOR` / `_UI_CHAT_OPEN_LINK_REPLACEMENT` 更新为该形态，
替换体保留 `linkOpening.getSnapshot() === 'sidebar'` 条件（否则改变上游「外链在侧栏打开」的用户偏好），
并同样先 `fetch('/kstock-api/frame-check?...')`、`embeddable === true` 才 `openTab`。

验收（两条）：`python3 -c` 对 `git show d456452786:…` 做 `anchor in text` 断言 → `True`。

- [ ] **T1.3 让引擎补丁「失配可感知」**

现状：`patch_vendor_skills.py` 的四个引擎补丁全部「锚点失配静默跳过」，且 `main()`（`:2085-2092`）
无论如何退出 0。改法：记录每个引擎补丁的 `applied` / `skipped-already` / `anchor-mismatch`，
第三者收集为失败清单，`main()` 打印后 `raise SystemExit(1)`：

```python
def main() -> None:
    changed = apply_skill_patches()
    ...
    if _ENGINE_PATCH_FAILURES:
        print("✗ 引擎补丁锚点失配（本地定制未重放，上游可能重构了该处）：", file=sys.stderr)
        for rel_path in _ENGINE_PATCH_FAILURES:
            print(f"  - vendor/{rel_path}", file=sys.stderr)
        raise SystemExit(1)
```

验收（红路径）：临时把 `_UI_CHAT_OPEN_LINK_ANCHOR` 改成不存在的串 → 非零退出并打印清单；改回后退出 0。

- [ ] **T1.4 修 `build-engine-bundle.sh` 步骤顺序（B3）**

把「重放技能补丁」从步骤 3 提前到步骤 0（与 `patch_vendor_engine.py` 并列）：

```bash
echo "==> 重放引擎本地补丁（patch_vendor_engine + patch_vendor_skills，幂等）"
"$REPO_ROOT/scripts/python.sh" "$REPO_ROOT/scripts/patch_vendor_engine.py"
"$REPO_ROOT/scripts/python.sh" "$REPO_ROOT/scripts/patch_vendor_skills.py"   # ← 提前
```

步骤 3 保留（幂等），只更新注释。验收：`bash -n scripts/build-engine-bundle.sh` 通过；行号比对顺序。

- [ ] **T1.5 修 `verify-runtime-closure` 的空转门禁（B4）**

在 `patch_vendor_skills.py` 新增第 5 条引擎补丁（纳入 T1.3 的失配告警）：

```python
# ── 补丁 22：verify-runtime-closure 的 preset glob 回退到可命中的 shipped 预设 ──
# 上游 b1696f535b 把 glob 改为 packages/bundle/web-app/presets/*.patch.yml，而该目录
# 在 3.0.5 既未入库也不在工作树 → globSync 返回 [] → failures 非空 → exit 1；
# 该门禁是 build-exe-for-python-sdk 流水线首步与 build-runtime-bundle.sh 的必经步。
_VERIFY_CLOSURE_REL = "qilin/scripts/verify-runtime-closure.ts"
_VERIFY_CLOSURE_MARKER = "KStock patch: preset glob 回退"
_VERIFY_CLOSURE_ANCHOR = "const AGENT_PRESET_GLOB = 'packages/bundle/web-app/presets/*.patch.yml'"
_VERIFY_CLOSURE_REPLACEMENT = (
    "// KStock patch: preset glob 回退 + 覆盖 KStock 自有预设——上游指向的 bundle presets\n"
    "// 目录不存在，会让本门禁以 exit 1 空转失败；kstock/presets 是产品态真正随包发的那批。\n"
    "const AGENT_PRESET_GLOB = '{packages/preset/agent-presets/presets/*/agent.cordis.yml,"
    "../../kstock/presets/*/agent.cordis.yml}'"
)
```

**为什么可以一并覆盖 KStock 预设（已核实）**：`kstock/presets/*/agent.cordis.yml` 引用的
**25 个包名全部**是 `python/sdk-runtime/package.json` 的直接 `workspace:` 依赖 →
纳入校验不会误报；`node:fs.globSync` 的花括号 glob 实测在本仓库命中 **11** 个文件
（4 shipped + 7 KStock）。这条扩展同时兑现了 R12 的预设装配覆盖。

验收：`cd vendor/qilin && ../../scripts/qilin-pnpm.sh run verify-runtime-closure`
→ 打印 `verify-runtime-closure: N agent presets and M workspace packages form a closed runtime dependency graph.`，
其中 **N ≥ 11** 且无 failures。

- [ ] **T1.6 提交**

```bash
git add scripts/patch_vendor_engine.py scripts/patch_vendor_skills.py scripts/build-engine-bundle.sh
git commit -m "fix(upgrade): 修复 3.0.5 阻断面——SettingsRoot/ui-chat 锚点失配、verify-runtime-closure 空转 glob、引擎补丁失配可感知、exe 构建步骤顺序"
```

---

### Phase 2 — 上游同步与锁（约 3 分钟）

- [ ] **T2.1 刷新锁**：`python3 scripts/sync_upstreams.py --refresh-lock`
  验收：`QiLin.commit == d456452786…`、`version == "3.0.5"`；`KSkills.commit == fd01489…`
- [ ] **T2.2 同步快照（跳过技能）**：`python3 scripts/sync_upstreams.py --sync-qilin`
  验收：`vendor/qilin/package.json` = `3.0.5`；`apps/` 只剩 `cli`+`web`；无 `node_modules/`、`lib/`、`dist/`、`dist-exe/`。
- [ ] **T2.3 复核本地定制面完整重放**

```bash
grep -c "kstock-quant-workspace" vendor/qilin/packages/client/ui-settings-general/src/client/SettingsRoot.tsx  # 1
grep -c "KStock patch: X-Frame-Options" vendor/qilin/packages/client/ui-chat/src/client/apply.ts                # 1
grep -c "repairStagedScope" vendor/qilin/scripts/build-exe-for-python-sdk.ts                                    # 2
grep -c "KStock patch: 生产安装" vendor/qilin/scripts/install-lefthook.mjs                                      # 1
grep -c "KStock patch: preset glob 回退" vendor/qilin/scripts/verify-runtime-closure.ts                         # 1
```

- [ ] **T2.4 提交快照**

---

### Phase 3 — 引擎依赖与产物重建（30–60 分钟）

- [ ] **T3.1** `scripts/qilin-pnpm.sh install --frozen-lockfile`（验收：退出码 0，无 peer 错误）
- [ ] **T3.2** `scripts/qilin-pnpm.sh run build`（验收：退出码 0）
- [ ] **T3.3** `scripts/qilin-pnpm.sh run verify-runtime-closure`（前置 T1.5；验收：退出码 0）
- [ ] **T3.4 校验 `dsh-animations` 已进入源码依赖树**

```bash
ls -d vendor/qilin/apps/cli/node_modules/dsh-animations        # dev 态解析锚点
python3 -c "import json;d=json.load(open('vendor/qilin/apps/cli/package.json'));print(d['dependencies']['dsh-animations'])"
grep -c "^  dsh-animations@" vendor/qilin/pnpm-lock.yaml       # 期望 ≥1
```

- [ ] **T3.5 产物重建（按所用打包路径）**

```bash
# 新路径（运行时闭包）
rm -rf staging/kstock-runtime staging/kstock-runtime.tar.gz
bash scripts/build-runtime-bundle.sh
# 旧路径（SEA 单文件，如仍需产出）
bash scripts/build-engine-bundle.sh --force-exe-build
```

验收（新路径，**含动画包的存在性**）：

```bash
python3 -c "import json;print(json.load(open('staging/kstock-runtime/node_modules/dsh-animations/package.json'))['version'])"  # 1.2.3
ls staging/kstock-runtime/node_modules/dsh-animations/{entry.js,cordis.patch.yml,skills/manifest.json,lib/client.js}
python3 -c "import json;print(len(json.load(open('staging/kstock-runtime/node_modules/dsh-animations/skills/manifest.json'))['skills']))"  # 8
python3 -c "import json;print(json.load(open('staging/kstock-runtime/.runtime-version'))['version'])"   # 3.0.5
find staging/kstock-runtime/node_modules/dsh-animations -name '*.html' | wc -l          # 108
du -sh staging/kstock-runtime{,.tar.gz}    # 记录体积并与 3.0.4 基线（546M / 145M）对比，供 R7 与公证评估
```

（旧路径对应检查：`dist-exe/kstock-engine --help` 退出 0；`dist-exe/kstock-engine-office/` 存在；
`vendor/qilin/python/sdk-runtime/.../runtime/node/node_modules/dsh-animations` 已入包。）
若 `dsh-animations` 缺失 → **停在此处**（见 R6），不要继续。

---

### Phase 4 — 产品面适配：决策一 + 决策二（代码阶段）

- [ ] **T4.1 下架引擎日程能力（决策一）**

在 `kstock/web/cordis.patch.yml` 末尾追加 §2.1 给出的两行 `disabled: true`。

- [ ] **T4.2 启用动效技能库（决策二，核心）**

按 §2.2.5 修改 `apps/desktop/electron/lib/engine.ts` 的 `ensureKstockProfile()`：

1. 新增常量 `const ANIMATIONS_BUNDLE = "dsh-animations";` 与 `const PROFILE_BUNDLES = ["@qilin/base", "@qilin/web-app", "dsh-animations", "@kstock/web"];`
2. 新 profile 分支：`bundles: PROFILE_BUNDLES`；
3. else 分支：补「缺层即插（锚点 `@qilin/web-app` 之后）」的幂等迁移；`bundles.length === 0` 时整体写 `PROFILE_BUNDLES`；
4. 日志改为 `kstock profile 已更新（插件依赖 / 动效技能库层）`。

验收：把本地 profile 的 `bundles` 手动改回旧三元素 → 启动壳 → 重新变为四元素且 `patchReload` 未被改写；
再启动一次 → 不写盘（幂等）。

- [ ] **T4.3 消除侧边栏撞序（R13）**

`kstock/automation/src/client/index.tsx`：`sidebar.panellist` 的 `order: 120` → **`110`**
（契约：升序、平序按注册顺序 → 平序不稳定，需消歧）。

- [ ] **T4.4 自愈脚本同步**

`scripts/register-profile-plugins.sh`：除补依赖与符号链接外，同样检查并补
`qilin.profile.bundles` 中的 `dsh-animations`（现脚本只处理 `dependencies`）。

- [ ] **T4.5 构建/资源门禁（R6）**

`scripts/verify_package_resources.py` 新增 `verify_animations_channel()`：

1. 壳源码锚点：`apps/desktop/electron/lib/engine.ts` 必须含 `"dsh-animations"` 且
   `kstock/web/cordis.patch.yml` 必须含 `disabled: true` 的 `schedule` / `ui-schedule` 两行；
2. 产物锚点（product 模式）：`dist-exe/plugins` 之外，断言闭包目录存在
   `node_modules/dsh-animations/{package.json, cordis.patch.yml, entry.js, lib/client.js, skills/manifest.json}`，
   且 `skills/manifest.json` 的 `skills.length === 8`；
3. 红路径：临时把闭包里的 `skills/manifest.json` 改名 → 门禁 FAIL。

纳入 `check-ci.sh`（source-only 分支跑第 1 条；product 分支跑第 2 条）。

- [ ] **T4.6 提交**

```bash
git add kstock/web/cordis.patch.yml kstock/automation/src/client/index.tsx \
        apps/desktop/electron/lib/engine.ts scripts/register-profile-plugins.sh \
        scripts/verify_package_resources.py
git commit -m "feat(upgrade): 保留 @kstock/automation 并下架引擎日程三件套；启用上游动效技能库 dsh-animations（profile 层 + 存量迁移 + 构建门禁）"
```

---

### Phase 5 — 其余适配

- [ ] **T5.1 补 `kstock/pnpm-workspace.yaml` 成员**：加 `news-ui`、`chan-ui`
  验收：`cd kstock && pnpm install --lockfile-only` 后 lockfile 出现两个新 importer。
- [ ] **T5.2 把 `repairStagedScope` 等价修复移植到 `scripts/local/materialize-runtime-closure.mjs`（R8）**
  在 `restoreLegacyHoists` 之后、`materializeStagedLinks` 之前插入：扫 `@qilin`/`@deepseek-ai` 作用域，
  把「存在于 `python/sdk-runtime/node_modules` 但缺失于 staging」的包整树拷入（跳过嵌套 `node_modules`），
  再为其非作用域依赖补拷。（实施手册 E5.2 给出完整 JS 片段。）
- [ ] **T5.3 观察项：`SessionSummary.blank`（R4，不改代码）**

  复核结论（与前一稿不同）：3.0.5 的 `blank` 由 `effectiveBlank = summary.blank && !engagedSessions`
  派生（`api/session-controller/src/client/sessions/manager.ts:287`），并在投影列表行时**已经折进**
  `byId[id].blank`（同文件 `:764`）→ KStock 读 `byId[sessionId].blank` 的口径与旧版一致，
  只是更早把「已 engage 过的会话」判为非空白，方向与上游意图一致。
  故**不做预防性改动**，改为在 T6.4 第 6 项真机确认；若复现「选不上」，按实施手册 E5.4 的诊断顺序处理
  （先看 `byId[id].blank` 实际值 → 看该会话是否已 engage → 确认误判再改并补单测）。
- [ ] **T5.4 KStock 自有预设装配门禁：由 T1.5 的 glob 扩展覆盖（只做验证）**

  本机**无 PyYAML**，而 T1.5 已把 `kstock/presets/*` 纳入引擎的 `verify-runtime-closure`，
  因此**不再新增** `verify_preset_assembly()` 解析器；本任务只跑一次门禁并记录 N 值：
  `scripts/qilin-pnpm.sh run verify-runtime-closure`（期望 N ≥ 11、无 failures）。
- [ ] **T5.5 提交**

---

### Phase 6 — 验证（CI + 数据迁移 + 双冒烟）

- [ ] **T6.1 CI 门禁**：`bash scripts/check-ci.sh` → 全绿。
- [ ] **T6.2 会话数据迁移预检（真机前必做）**

```bash
tar -czf ~/kstock-sessions-backup-$(date +%Y%m%d).tar.gz -C ~/.kstock/qilin-home sessions
cd vendor/qilin && ../../scripts/qilin-pnpm.sh run migrate:sessions-to-v4 -- \
    --sessions-dir "$HOME/.kstock/qilin-home/sessions"
```

验收：退出码 0 = 全部成功；`1` = 有失败，按 `failureGroups` 处置；源 `session.v3*.jsonl.zstd` 仍在；重跑全部计 `alreadyV4`。

- [ ] **T6.3 引擎独立冒烟（浏览器直连）**

```bash
cd vendor/qilin
KSTOCK_APP_DATA_DIR=~/.kstock QILIN_HOME=~/.kstock/qilin-home \
KSTOCK_PRESETS_DIR=$PWD/../../kstock/presets \
node --import tsx/esm apps/cli/src/bin.ts --profile kstock --port 18001
```

验收：启动无 `cannot resolve profile bundle "dsh-animations"` 报错（**R6 的第一道实机闸**）；
stdout 出现 `dsh-animations: 8 runtime skills registered (...)`；打印 `/workspace?token=…`；
`curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:18001/kstock/kstock-logo.svg` = `200`；
匿名 `/workspace` 302 回落地页。

- [ ] **T6.4 桌面端真机冒烟（逐屏）**

```bash
KSTOCK_OFFLINE_BUILD=1 pnpm dev:desktop     # 或先 build-runtime-bundle.sh 再打包
```

| # | 检查项 | 关注点 |
|---|---|---|
| 1 | 启动无报错 → 账户门 → 登录/注册 → 工作台 | **R6**：`dsh-animations` 解析成功；`compatibility.json` 无告警 |
| 2 | 侧边栏：KStock 公共页 + 四库 + **「定时任务」与「动效技能库」两个面板，顺序确定** | 决策一（无 `schedules`）+ T4.3 消歧 |
| 3 | **动效技能库面板可用**：技能列表、选技能投递会话 | 决策二（`anim-panel`） |
| 4 | **8 个动画技能在 agent 技能名册可见**（ppt-animation / flowchart / …） | 决策二（runtime skill 全局层） |
| 5 | 财经新闻面板与侧栏项出现；内嵌浏览器 `openTab('browser',{scope})` 落对会话视图 | R4（`ui-sidebar-right` inject 4→7） |
| 6 | 角色 preset 选择器：新建会话即可选 6 角色；发送后 chip 进禁用态 | R4（`blank` 语义） |
| 7 | 设置页两个 KStock 分区 + navIcon 图标正确 | B1 补丁重放 |
| 8 | 「解读」任务目标菜单全链路 | `uiWorkspace.openSession`/`selection` |
| 9 | 四库读写 + 报告归档（`POST /kstock-api/reports`） | 数据面 |
| 10 | 外链预检：券商研报等外链不可嵌时转系统浏览器，无白屏 | B2 补丁重放 |
| 11 | automation 定义/历史读写（含畸形 storage 文件） | R11 |
| 12 | 7 个 KStock preset 逐个切换：工具名册与随行技能目录齐全 | R12 |
| 13 | 中文文案完整性 | 品牌层本地化 |

- [ ] **T6.5 发布链路**：`bash scripts/check-release.sh`（或新路径 `build-runtime-bundle.sh` + `build-desktop.sh`）
  > `check-release.sh` 目前串旧路径；若已迁到闭包，需同步换引擎步并把 `verify_package_resources.py`
  > 的 product 断言由 `dist-exe/` 改为 `staging/`。

---

### Phase 7 — 收尾

- [ ] **T7.1 文档回写**
  - 本计划提升为 `docs/引擎升级-QiLin3.0.4至3.0.5.md`（对齐上次先例），补「执行记录」；
  - `docs/上游同步.md`：版本口径（本跳 tag 与 package.json 一致）、补 `run verify-runtime-closure`、
    记明「引擎补丁失配现在 fail-loud」；
  - `docs/发布说明.md`：会话 v4、**保留自研定时任务并下架引擎日程能力**、**新增动效技能库（8 个动画技能）**、
    上游移除桌面壳、设置页整页布局；
  - `docs/配置说明.md` / `运行说明.md` / `README.md`：澄清 `KSTOCK_SKILLS_DIR` 无引擎读取点（D6）；
    新增一节说明动效技能库的来源与升级通道（`qilin plugin add dsh-animations@latest`）。
- [ ] **T7.2 提交**

---

## 7. 回滚方案

| 层 | 动作 | 说明 |
|---|---|---|
| 代码 | `git checkout main`（升级在 `upgrade/qilin-3.0.5-2` 分支） | main 合并前风险为零 |
| 快照 | 分支回退即恢复 `vendor/qilin`（回滚锚点 `9798395b`） | 记在 `upstream.lock.json` |
| 产物 | 重跑 `--force-exe-build`（旧）或 `rm -rf staging/ && build-runtime-bundle.sh`（新） | 快照回退使 `vendor/qilin/dist-exe` 失效，必须重建 |
| **动画层** | 从 profile 的 `bundles` 移除 `dsh-animations` 即回到「无动效技能库」 | 该层失败是**启动期硬错误**（R6），故回滚动作明确且局部 |
| **数据** | 删除迁移生成的 v4 generation：`rm ~/.kstock/qilin-home/sessions/<会话目录>/session.v4*.jsonl.zstd` | 源 v3 仍在 → 3.0.4 可读回；操作前用 T6.2 的 tar 备份兜底 |
| 四库数据 | 无需回滚 | `~/.kstock/product/kstock.db` 与 `~/.kstock/reports/` 由 KStock 自有插件管理 |

---

## 8. 总验收清单（2026-09-28 执行勾选）

- [x] 在飞改动已独立提交，工作树干净（P0）——`5f1f9ba0`（含 kstock lib 产物对齐）
- [x] B1/B2/B3/B4 四项修复完成，红路径验证通过（P1；B4 验收「N ≥ 11 且无 failures」→ 实测 **11 presets / 144 packages**）
- [x] `upstream.lock.json` → `d456452786` / `3.0.5`；`vendor/qilin` 快照 = 上游工作树（P2，3733 文件 +366k/−118k）
- [x] 6 处本地定制锚点全部存活（P2 T2.3 五命令 → 1/1/2/1/1）
- [x] `install --frozen-lockfile` / `run build` / `run verify-runtime-closure` 通过（P3）
- [x] `vendor/qilin/apps/cli/node_modules/dsh-animations` 存在（P3 T3.4，1.2.3 / 8 技能）
- [x] **产物闭包含 `dsh-animations`（package.json + skills/manifest.json 8 项 + cordis.patch.yml + entry.js + lib/client.js）**（P3 T3.5，113 个 HTML；E4.9 红路径验证门禁有效）
- [x] 引擎面：`schedule`/`ui-schedule` 已下架，`time-context` 保留（P4 T4.1）
- [x] profile 层：新 profile 与存量 profile 都带 `dsh-animations`，迁移幂等（P4 T4.2；单测 5/5 + 自愈脚本备份清单实测）
- [x] 侧边栏撞序已消歧（P4 T4.3 automation order 110）＋ 自愈脚本同步（P4 T4.4）
- [x] 构建门禁（动画通道 T4.5；预设装配 T1.5 + T5.4 验证）落地并红路径验证（E4.9：改名 manifest → exit 1 → 还原 → exit 0）
- [x] `kstock/pnpm-workspace.yaml` 补齐成员（P5，news-ui / chan-ui）
- [x] `check-ci.sh` 全绿（P6，exit 0；含新门禁两条 [OK]）
- [x] 会话迁移预检完成 + 用户数据已备份（P6 T6.2；83/94 发布 v4，11 个 write_locked 留 v3 待写打开自迁移——活跃旧实例持有，S8 保守口径）
- [x] 引擎独立冒烟通过（无 bundle 解析错误 + 8 技能注册日志 + logo 200 / workspace 302 / reports 200）（P6 T6.3；隔离 home:18011）
- [ ] 桌面端 13 项逐屏冒烟通过（P6 T6.4）——**待人工逐屏验证**（见执行记录遗留项）
- [ ] Office kit 0.1.0 的闭包体积已实测（147M）/ 公证耗时未测（R7）——公证在 A5 发布窗口实测
- [x] 文档回写完成（P7）

---

## 9. 附录：关键证据复现

```bash
# ── 版本基线与差异规模 ──────────────────────────────────────────────
git -C /Users/libing/kk_Projects/QiLin log -1 --format='%H %s' v3.0.4
git -C /Users/libing/kk_Projects/QiLin log -1 --format='%H %s' v3.0.5
git -C /Users/libing/kk_Projects/QiLin log --oneline 9798395b..d456452786 | wc -l   # 74
git -C /Users/libing/kk_Projects/QiLin diff --shortstat 9798395b d456452786

# ── 两棵对照树（后续断言都以它们为 cwd）──────────────────────────────
rm -rf /tmp/qilin-base /tmp/qilin-305 && mkdir -p /tmp/qilin-base /tmp/qilin-305
git -C /Users/libing/kk_Projects/QiLin archive 9798395b | tar -x -C /tmp/qilin-base
git -C /Users/libing/kk_Projects/QiLin archive d456452786 | tar -x -C /tmp/qilin-305

# ── 本地定制面（vendor 快照 = 3.0.4 + 本地补丁，与上游基线的全部差异）──
diff -rq /tmp/qilin-base /Users/libing/kk_Projects/KStock/vendor/qilin | grep '^Files.*differ'
# → 4 个文件：SettingsRoot.tsx / ui-chat apply.ts / build-exe-for-python-sdk.ts / install-lefthook.mjs
#   （3.0.5 起新增第 5 个：scripts/verify-runtime-closure.ts，见 T1.5）

# ── B4：verify-runtime-closure 的 glob 空转 ─────────────────────────
git -C /Users/libing/kk_Projects/QiLin ls-tree -r --name-only d456452786 packages/bundle | grep -c 'presets/'   # 0
node -e "console.log(require('node:fs').globSync('packages/bundle/web-app/presets/*.patch.yml',{cwd:'/tmp/qilin-305'}))"            # []
node -e "console.log(require('node:fs').globSync('packages/preset/agent-presets/presets/*/agent.cordis.yml',{cwd:'/tmp/qilin-305'}).length)"  # 4
git -C /Users/libing/kk_Projects/QiLin show d456452786:scripts/verify-runtime-closure.ts | sed -n '33p;68p;112p'

# ── 引擎 patch 行增删 ──────────────────────────────────────────────
python3 - <<'PY'
import pathlib, re
def ids(root, name):
    t = (root/f'packages/bundle/{name}/cordis.patch.yml').read_text()
    return {m.group(1) for m in re.finditer(r'^\s*- id: (\S+)\s*$', t, re.M)}
for b in ('base','web-app'):
    a, c = ids(pathlib.Path('/tmp/qilin-base'), b), ids(pathlib.Path('/tmp/qilin-305'), b)
    print(b, 'added', sorted(c-a), 'removed', sorted(a-c))
PY
# base: 89→89 无增删；web-app: 108→114，新增 job-controller/time-context/schedule/shortcuts/ui-shortcuts/cordis-inspect-providers

# ── dsh-animations：声明、解析、闭包 ────────────────────────────────
grep -n "dsh-animations" /Users/libing/kk_Projects/QiLin/apps/cli/package.json          # ^1.2.3
grep -n "dsh-animations" /tmp/qilin-305/pnpm-lock.yaml                                  # 1.2.3
grep -n "ANIMATIONS_BUNDLE\|PROFILE_OWNED_BUNDLES" /tmp/qilin-305/packages/boot/app-boot/src/profile.ts
sed -n '1089,1103p' /tmp/qilin-305/packages/boot/app-boot/src/profile.ts                # resolveBundleDir 锚点顺序
sed -n '255,268p' /tmp/qilin-305/packages/boot/app-boot/src/profile.ts                  # PROFILE_TEMPLATES 只有 web/qilin 种它
python3 -c "import json;d=json.load(open('/tmp/qilin-305/python/sdk-runtime/package.json'));print(d['dependencies'].get('@qilin/cli'))"  # workspace:^
grep -n "dsh-animations" /tmp/qilin-305/scripts/build-exe-for-python-sdk.ts             # ASSET_GLOBS 新增 skills/**/*
grep -n "dsh-animations" /tmp/qilin-305/pnpm-workspace.yaml                             # minimumReleaseAgeExclude 已放行

# 体积（直接影响闭包与公证耗时）
du -sh /Users/libing/kk_Projects/QiLin/node_modules/.pnpm/dsh-animations@1.2.3           # 82M（skills/ 占 80M）
find /Users/libing/kk_Projects/QiLin/node_modules/.pnpm/dsh-animations@1.2.3 -name '*.html' | wc -l   # 108
du -sh /Users/libing/kk_Projects/KStock/staging/kstock-runtime{,.tar.gz}                 # 3.0.4 基线：546M / 145M

# 3.0.4 闭包实测（传递依赖确实落进闭包，且当时无 dsh-animations）
cd /Users/libing/kk_Projects/KStock/staging/kstock-runtime && ls node_modules/@qilin/base node_modules/@qilin/web-app 2>/dev/null
ls node_modules/dsh-animations 2>/dev/null || echo "3.0.4 闭包无 dsh-animations（3.0.4 的 apps/cli 未声明它）"

# 「构建期不会报错」的两条依据
grep -n "expandFiles" /Users/libing/kk_Projects/QiLin/node_modules/pkg/lib-es5/walker.js | head -3   # 资产空匹配静默跳过
grep -n "workspace.has(dependency)" /tmp/qilin-305/scripts/verify-runtime-closure.ts                 # 门禁只遍历 workspace 包

# ── dsh-animations：形态与交互面 ───────────────────────────────────
P=/Users/libing/kk_Projects/QiLin/apps/cli/node_modules/dsh-animations
cat $P/cordis.patch.yml; cat $P/package.json | head -40
grep -n "PANEL_ID\|order:" $P/lib/client.js | head
python3 -c "import json;print([s['name'] for s in json.load(open('$P/skills/manifest.json'))['skills']])"

# ── 会话格式 v4 ────────────────────────────────────────────────────
git -C /Users/libing/kk_Projects/QiLin show d456452786:packages/core/session/src/types.ts | sed -n '89p'

# ── 兼容准入机制（3.0.5 新增）──────────────────────────────────────
git -C /Users/libing/kk_Projects/QiLin grep -l "incompatible-version" 9798395b            # 空
git -C /Users/libing/kk_Projects/QiLin grep -l "incompatible-version" d456452786 | head    # 有命中
```

**本次分析的边界**：全程只读（`git show` / `git archive` / `grep` / `diff` / Python 解析），
未改动 KStock 与 QiLin 的任何**源码**；未执行安装、构建、迁移脚本；
唯一动过的文件系统对象是分析用临时目录 `/tmp/qilin-base`、`/tmp/qilin-305`（已清理）。
KStock 已存在上次升级遗留的同名分支 `upgrade/qilin-3.0.5`（`43931980`），故本计划用 `-2` 后缀。

---

## 执行记录（2026-09-28，分支 upgrade/qilin-3.0.5-2）

### 锚点
- KStock 起始 SHA：`5f1f9ba0`（在飞改动固化后）→ 分支首提交 `049d6283`；上游 SHA：`d456452786`；旧 lock：`9798395b` / 3.0.4
- 会话备份：`~/kstock-sessions-backup-20260928-1313.tar.gz`（291 条）；profile 备份：`~/kstock-profile-backup-20260928-1313.json`

### 阶段结果
| 阶段 | 结果 | 证据（命令输出摘要） |
|---|---|---|
| E0 | ✅ | 分支 `upgrade/qilin-3.0.5-2`；modified-left=0；A1=跳过旧 SEA、A2=web-app 后、A3=110 |
| E1 阻断项 | ✅ | 五条 grep 1/1/2/1/1；fail-loud 红（锚点失配 exit 1）绿（重放 exit 0）；C1 `8a1adf0e` |
| E2 同步 | ✅ | 快照 d456452786/3.0.5，3733 文件 +366k/−118k；`patch_vendor_engine：应用 2 处`；C2 `46abcdfc` |
| E3 依赖与产物 | ✅ | install/build/闭包门禁 exit 0：**11 agent presets / 144 workspace packages**；闭包动画包 1.2.3 + 8 技能 + 113 HTML；tar.gz 209M（闭包 563M，净增 +17M：动效库 +82M 被上游移除桌面壳等抵消）；C3 `e4ecec03` |
| E4 产品面 | ✅ | patch 5 目标行 + 2 disabled；profile 迁移单测 5/5（红路径 4/1 验证）；门禁红（改名 manifest → exit 1）绿（exit 0）；C4 `4a2f184e` |
| E5 其余适配 | ✅ | kstock 工作区 +news-ui/chan-ui（lock 136 entries）；repairStagedScope 等价修复；blank 观察项不改代码；C5 `4b8d6ed1` |
| E6 验证 | ✅/⚠️ | check-ci 全绿（exit 0）；迁移预检：83/94 发布 v4，11 个 write_locked（活跃旧实例持有，留 v3 待写打开自迁移）；引擎独立冒烟（隔离 home:18011）五探针全过、8 技能注册；真机 13 项待人工；发布链路（A5）独立窗口 |
| E7 收尾 | ✅/⚠️ | 文档回写完成；**合并待真机 13 项确认后执行** |

### 计划外适配（执行中发现并处置）
| 现象 | 根因 | 处置 | 是否已补进门禁 |
|---|---|---|---|
| E1.2 计划锚点在 3.0.5 仍失配（图标行尾多了 ` useModalLayer,`） | 计划给的稳定锚点猜测有误 | 改锚「值导入块闭括号 → import type 行」收尾序列；插入只含 5 个新增图标（避免重复导入） | 否（一次性修正，锚点本身即门禁） |
| E1.6 红路径按计划 `git checkout --` 把未提交的 E1 编辑一并抹掉 | 计划步骤顺序 bug（checkout 先于 E1.8 提交） | 重放六处编辑；红路径改用反向替换 + 缺文件分支演练；真绿移到 E2 同步后 | 是（S3 已有处置条目） |
| E1.1 期望「三行均 FAIL」实际 2 FAIL + glob 行 OK | glob 锚点在 3.0.5 存在（病理是目录不存在），计划期望写反 | 以「锚点在 + 目录不在」为 B4 病理证据 | 否（文档性修正） |
| **verify-runtime-closure 指回 agent.cordis.yml 后 0 presets 假绿** | 3.0.5 起「组合文件本身即 preset」，presetDefinitions 提不出包装行 | 补丁 22 扩为四段（glob / path 导入 / 校验循环整文件回退 / 计数同口径）；门禁恢复真实语义（11 presets 校验通过） | 是（补丁 22 随 sync 重放） |
| build-runtime-bundle.sh 无条件要求 APPLE_SIGNING_IDENTITY | 在飞脚本按公证场景写死 | 未设身份→跳过预签（本地开发闭包）；发布窗仍强制 | 是（脚本内注释） |
| check-ci 首步 tsdown 失败（deps-status-check 触发自动安装失败） | E5.1 只 `--lockfile-only` 未同步 node_modules | `CI=true pnpm install`（kstock 工作区）后全绿 | 否（本地操作顺序问题，CI 无此路径） |
| 迁移预检 11 个会话 write_locked | 活跃旧桌面实例持有写句柄 | 按 S8 保守口径：留 v3，其所有者写打开时自迁移；备份在，可回滚 | 否（S8 已有处置条目） |
| E6.3 冒烟与活跃实例冲突（18001 被占、共享 home 有锁） | 计划假设无活跃实例 | 隔离 home + 备用端口 18011；profile 由备份清单 + register-profile-plugins.sh 现造 | 否（执行环境问题） |

### 遗留观察（不阻塞本次）
- 闭包内 dsh-animations 实测 113 个 HTML（计划估算 108；非门禁项）。
- 首次启动新构建会按 tar 指纹自动刷新 `~/.kstock/runtime` 并把 profile bundles 迁到四元素——两者都在引擎 spawn 前完成，无 R6 窗口（engine.ts `ensureRuntimeExtracted` + `ensureKstockProfile`）。
- 发布链路改造（R0–R7）见 [plans/2026-09-28-release-pipeline-refit.md](../plans/2026-09-28-release-pipeline-refit.md)，A5 独立窗口执行。

### 真机反馈适配（2026-09-28 下午）

| 现象 | 根因 | 处置 |
|---|---|---|
| 升级后每个工作区下多出与工作区同名的会话行 | 冷行会话的 `sessionListMetadata` 投影缓存是 v3 时代身份（87 条），v4 迁移后按版本键失配；host 回退 `blank: seq === 0` 把「创建后从未发消息」的空白会话误判为普通会话展示 | 这些会话零内容（0 用户消息/无标题/仅初始化事件），经 `scripts/local/purge-blank-sessions.mjs` 清除 5 个并同步修剪 `workspace.json` 成员引用（两级备份于 `~/.kstock/backup-purged-blank-sessions-2026-09-28T*`）。未来空白会话由 3.0.5 运行时重建的 v4 投影缓存正常隐藏，不复发 |
