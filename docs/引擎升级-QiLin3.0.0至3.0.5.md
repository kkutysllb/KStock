# QiLin 引擎升级差异分析与升级计划（3.0.0 → 3.0.5）

> 状态：**已执行完成**（2026-09-21，分支 `upgrade/qilin-3.0.5`）。
> 本文基于 2026-09-21 对上游仓库与 KStock 集成面的逐项核查，
> 所有结论附提交号/文件级证据。执行结果见文末「执行记录」。

## 1. 升级范围

| 项 | 当前锁定（vendor 快照） | 上游现状 | 差异 |
|---|---|---|---|
| QiLin commit | `eb3524b5`（2026-09-17 锁定） | `563274a2`（main，工作区干净） | **20 个提交** |
| QiLin 版本 | package.json `3.0.0`（tag v3.0.0） | package.json `3.0.4`（tag **v3.0.5**） | 4 个版本线 |
| 差异规模 | — | — | 3073 文件，+117,381 / −37,571 行 |
| KSkills | `fd01489` | `fd01489`（未动） | **无需同步技能** |

版本号口径说明：HEAD 打的是 tag `v3.0.5`，但其 package.json 版本为 `3.0.4`
（release 提交 `d35f4016` 为 3.0.4，其后为文书提交并统一 tag 规则 `v<version>`）。
`sync_upstreams.py --refresh-lock` 以 package.json 为准，锁定记录将写 **3.0.4**。

## 2. 差异分析（20 个提交归类）

### 2.1 破坏性变更：`@qilin` scope 迁移（`0e542de0` `refactor!`）

上游把 fork 遗留的三处旧命名全部迁到 `@qilin` 命名空间：

- `@deepseek-ai/cosmokit` → `@qilin/cosmokit`、`@deepseek-ai/schemastery` → `@qilin/schemastery`
  （manifest、模块说明符、tsconfig paths、workspace overrides 全量改写）；
- `@deepseek-ai/node-addon-system*` → `@qilin/node-addon-system*`（含平台可选依赖与发布流程）;
- 发布元数据：所有 release 成员补 `engines` 与仓库 source 声明。

**对 KStock 的影响：被引擎工作区内部消化。** 全仓 grep 证据：`kstock/`、`apps/`、
`scripts/` 中对 `@deepseek-ai/(cosmokit|schemastery|node-addon-system)` 与
`@cordisjs/` 的引用为 **0 处**；KStock 插件依赖的 9 个 `@qilin/*` 包名升级前后
**均未改名**（仅有新增包）。间接要求：`vendor/qilin` 快照后 node_modules 必须
全量重装（scope 改名改变依赖布局）。

### 2.2 引擎核心合并：dsh-v0.1.6-alpha.2（`8464fe95`，体积主体）

上游合并了 dsh 引擎 alpha.2，构成本次差异的大头：

- `packages/client/modules` +1542 行：客户端插件运行时/组合系统增强，
  slots 体系新增 **Factory** 能力（`SlotFactoryMap` / `SlotFactoryDef` 等，加法式扩展）；
- `packages/client/ui-renderer` +1784 行、`ui-conversation` +1349 行：渲染与会话面增强；
- `packages/api/session-controller` 约 +1.9k/−1.6k：会话控制器重构；
- `packages/boot` / `llm` / `subprocess` / `experimental` 等广泛更新；
- 持久化：新增 `2026-09-14-workspace-changes-event` 事件（**格式内载荷修订**，
  非格式版本变更）。

**会话数据兼容性：无迁移风险。** `SESSION_FORMAT_VERSION` 在 `eb3524b` 与
`563274a2` 两端**均为 3**（`packages/core/session/src/types.ts:88`）；
`session-format-v0/v1/v2` 迁移包在两端均已存在。KStock 用户
`~/.kstock/qilin-home` 存量会话可直接被新版读写。

### 2.3 客户端 UI 变化（升级后用户可见）

| 变化 | 提交 | 兼容性 |
|---|---|---|
| 侧边栏 list 槽注册选项新增**可选 `section`**，面板按分区渲染标题 | `93e2a804` | 向后兼容（可选项；KStock 的 `slots.register` 用法不受影响，可选利用） |
| **插件管理页迁移为设置页的一个标签页**（原独立面板收尾） | `b5d862a2`、`aff05948` | 引擎自带 UI 重组；KStock 未引用 `client-ui-plugin-manager` |
| 新增 locale 键（section 分区标题、插件管理迁移分区） | `b39fa29f` | 需人工核对新键的中文回退是否完整（见风险 R3） |
| scaffold 默认关闭 accounts 门（上游 e2e 场景修复） | `57c895eb` | 上游测试脚手架默认值；KStock 账户门由 `@kstock/web` 自己的 bundle patch 显式开启，不受影响 |

### 2.4 运行时修复（KStock 直接受益）

- **webserver 请求头上限提高**（`64b51972`）：修复组合 URL 被 431 拒绝导致客户端
  起不来的问题——对桌面端（壳 + 浏览器面同源加载）是直接可靠性收益。
- gates 清理（`3dafce9a`）、发布前已安装 Web 面启动自证（`00c9c2b5`）。

### 2.5 发布工程与文书（不触运行时）

`dfffbf92`（tag 统一 `v<version>`）、`d35f4016`（release 3.0.4）、`70613ff`/`8237013`/`563274a2`
（LICENSE/README/npm 不发布声明）、`.agents/notes` 与 `docs/` 大量文档重组、
`website/tests` 快照扩充。

## 3. KStock 集成面兼容性核查表

| 核查项 | 3.0.0（锁定） | 3.0.5（目标） | 结论 |
|---|---|---|---|
| 引擎 exe 产物基名 | `deepseek-harness-sdk-runtime` | 同（`build-exe-for-python-sdk.ts:24` 两端一致） | `build-engine-bundle.sh` **无需改** |
| Node engines | `^22.19.0 \|\| >=24.0.0` | 同 | 无 |
| pnpm | `11.7.0`（`qilin-pnpm.sh` 钉住） | 同 | 无 |
| 会话格式写入器 | V3 | V3 | **存量用户数据无迁移** |
| KStock 依赖的 9 个 `@qilin/*` 包名 | `api-remotes`、`api-session-controller`、`client-locale`、`ui-conversation`、`ui-layout`、`ui-renderer`、`ui-settings`、`ui-sidebar`、`ui-theme` | 全部同名未改（仅新增包） | 无 |
| CLI 启动参数 `--profile kstock --port --no-open` | ✓ | ✓（args.ts 重构为任意 profile 缩写，旧参数语义保留） | 壳**无需改** |
| 就绪信号 token URL（`/workspace?token=...`） | ✓ | 同 | 壳**无需改** |
| kstock profile bundles（`@qilin/base` + `@qilin/web-app` + `@kstock/web`） | ✓ | 同名 | profile 清单**无需改** |
| KStock 对被改名包（`@deepseek-ai/*`、`@cordisjs/*`）的引用 | — | **0 处** | scope 迁移影响隔离在引擎内 |
| KSkills 技能源 | `fd01489` | 未动 | 跳过 `--sync-skills` |

## 4. 风险清单

| # | 风险 | 等级 | 缓解 |
|---|---|---|---|
| R1 | **陈旧引擎缓存**：`build-engine-bundle.sh` 仅在 exe 缺失时构建；`--sync-qilin` 会整体清空 `vendor/qilin`（含其 `dist-exe/`），但若 `dist-exe/kstock-engine`（仓库级）仍在，`--skip-exe-build` 路径会打包出旧 3.0.0 引擎 | **高（静默）** | 本次必须 `--force-exe-build` 强制重建 |
| R2 | **客户端运行时契约大改**（modules/slots Factory、渲染器 +1.7k 行）：KStock 客户端插件（client.cjs）经 `slots.register/inject` 消费引擎 API，类型检查覆盖不了运行时时序问题 | 中高 | Phase 4 真机冒烟清单（登录→四库→报告→设置）必跑 |
| R3 | **新增 UI 文案的中文完整性**：sidebar 分区标题、插件管理设置分区新增 locale 键，KStock 品牌层本地化若未覆盖会回退英文 | 低 | 冒烟时逐屏核对中文文案 |
| R4 | **构建耗时**：快照约 137.4 MB / 9988 文件；`pnpm install --frozen-lockfile` + `pnpm run build` + exe 构建（首次 3-10 分钟） | 低 | 计划内预留；无网络受限点（lock 随快照同步） |
| R5 | **版本口径**：lock 将记 `3.0.4`（package.json 真源），tag 为 `v3.0.5` | 低 | 在 lock 与本文档注明口径，避免后续困惑 |

## 5. 升级计划

> 前提确认（已核）：上游 QiLin 工作区干净（HEAD = `563274a2`）；KStock 工作区干净。
> 快照复制的是上游**工作树**而非 git 提交，故上游干净是硬前提。

### Phase 0 — 基线与分支（5 分钟）

```bash
git checkout -b upgrade/qilin-3.0.5
# 回滚锚点：当前 vendor 快照对应 eb3524b，已在 upstream.lock.json 记录
```

**验收**：分支创建成功，工作区干净。

### Phase 1 — 同步快照与锁（约 2 分钟）

```bash
python3 scripts/sync_upstreams.py --refresh-lock   # 锁定 → 563274a / 3.0.4
python3 scripts/sync_upstreams.py --sync-qilin     # 整体替换 vendor/qilin（约 137MB）
# 跳过 --sync-skills：KSkills 上游未动（fd01489）
```

**验收**：
- `upstream.lock.json` 的 QiLin commit = `563274a2...`、version = `3.0.4`；
- `vendor/qilin/package.json` version = 3.0.4；
- `vendor/qilin` 内无 `lib/`、`dist/`、`dist-exe/`、`node_modules/`（同步排除规则生效）。

### Phase 2 — 引擎依赖与产物重建（约 5-15 分钟）

```bash
# 1) 重装引擎依赖（scope 迁移后 node_modules 布局变化，必须全量）
scripts/qilin-pnpm.sh install --frozen-lockfile
# 2) 重建 lib/ 产物 —— 同步排除了 lib/dist，而 exe 构建 --skip-build 要求 lib 已存在
scripts/qilin-pnpm.sh run build
```

> 注：`docs/上游同步.md` 未写 `run build` 一步（历史上 exe 缓存命中时被掩盖）；
> 本计划显式补上，构建幂等可重入。本次升级完成后回写该文档。

**验收**：`install` 无 peer/resolve 错误；`run build`（`tsx scripts/build.ts`）退出码 0。

### Phase 3 — 引擎分发束（约 5-15 分钟，exe 首建 3-10 分钟）

```bash
bash scripts/build-engine-bundle.sh --force-exe-build
```

**必须 `--force-exe-build`**（风险 R1）：强制重建单文件引擎，避免仓库级
`dist-exe/kstock-engine` 残留 3.0.0。脚本同时重建 12 个 KStock 插件包并重放技能补丁。

**验收**：
- `dist-exe/kstock-engine` 存在且为新构建（`dist-exe/kstock-engine --help` 正常退出）；
- `dist-exe/plugins/` 12 个包齐全（accounts…chan-ui）；
- `dist-exe/presets/` 与 `kstock/presets` 一致。

### Phase 4 — 验证（CI 门禁 + 双冒烟）

```bash
# 4a. CI 门禁：插件构建 + 对新引擎类型的全量类型检查 + 单测 + 资源契约
bash scripts/check-ci.sh
```

`check-ci.sh` 中 `kstock/*` 的 `tsc --noEmit`（typeRoots 指向 `vendor/qilin/node_modules`）
是**捕获 @qilin API 漂移的自动闸门**——若引擎类型破坏了 KStock 插件，这里必红。

```bash
# 4b. 引擎独立冒烟（浏览器直连，无 Electron）
cd vendor/qilin
KSTOCK_APP_DATA_DIR=~/.kstock QILIN_HOME=~/.kstock/qilin-home \
KSTOCK_SKILLS_DIR=$PWD/../vendor/skills \
node --import tsx/esm apps/cli/src/bin.ts --profile kstock --port 18001
```

**验收**：
- stdout 打印 `/workspace?token=...` 就绪 URL（壳依赖的就绪信号未变）；
- `curl -s http://127.0.0.1:18001/kstock/kstock-logo.svg` 匿名 200 + svg（壳的引擎识别探针）；
- 存量会话列表可打开（V3 格式无迁移）。

```bash
# 4c. 桌面端真机冒烟
pnpm dev:desktop
```

逐屏核对（覆盖风险 R2/R3）：
1. 启动 → 账户门 → 登录/注册 → 进入工作台（`@kstock/accounts` 链路）；
2. 侧边栏：KStock 公共页 + 四库面板正常注册；**新分区标题渲染位置不破坏现有面板**；
3. 设置页：**新的插件管理标签页**可见且列出的 12 个 `@kstock/*` 插件状态正常；
4. 四库：策略/因子/选股/报告 各页数据读写（`/kstock-api` 数据面）；
5. 报告生成与归档（html-report 技能 + `POST /kstock-api/reports`）；
6. 中文文案完整性（重点：侧边栏分区标题、插件管理分区）。

### Phase 5 — 收尾与提交

1. 回写 `docs/上游同步.md`：补 `run build` 步骤与版本口径说明；
2. `docs/发布说明.md` 增补引擎升级条目（3.0.0 → 3.0.5：431 修复、设置页插件管理、侧边栏分区）；
3. 提交：`vendor/qilin` 快照 + `upstream.lock.json` + 文档；
4. 发布链路（单独窗口执行）：`bash scripts/check-release.sh`（内含 CI → 引擎束 → 桌面打包）。

## 6. 回滚方案

- **代码层**：升级在独立分支进行，`git checkout main` 即回到 3.0.0 快照；
  main 合并前风险为零。
- **产物层**：回滚后重跑 `build-engine-bundle.sh --force-exe-build` 重建旧引擎
  （`vendor/qilin/dist-exe` 随快照回退一并失效，必须强制重建）。
- **数据层**：无需回滚——会话格式两端均 V3，四库 SQLite（`~/.kstock/product/kstock.db`）
  由 KStock 自有插件管理，与引擎版本解耦。

## 7. 总验收清单

- [x] `upstream.lock.json` → QiLin `563274a2` / 3.0.4
- [x] `vendor/qilin` 快照 = 上游工作树（干净 HEAD）
- [x] `qilin-pnpm.sh install --frozen-lockfile` 通过
- [x] `qilin-pnpm.sh run build` 通过
- [x] `build-engine-bundle.sh --force-exe-build` 通过，`kstock-engine --help` 正常
- [x] `check-ci.sh` 全绿（含对引擎新类型的类型检查）
- [x] 引擎独立冒烟：token URL + logo 探针 + 账户门 + workspace 页面
- [ ] 桌面端冒烟 6 项逐屏通过（待人工：见「遗留观察」）
- [x] 文档回写 + 提交

## 8. 执行记录（2026-09-21）

| 阶段 | 结果 |
|---|---|
| P0 分支 | `upgrade/qilin-3.0.5`；上游工作区干净（HEAD `563274a2`） |
| P1 同步 | lock → `563274a2` / 3.0.4；快照 158MB；lib/dist/dist-exe/node_modules 已按规则排除 |
| P2 重建 | install 48.8s（lockfile 供应链校验 1648 项通过，1360 包）；`run build` 通过 |
| P3 引擎束 | exe 262.4MB 构建成功；**计划外适配 1 处**（见下）；四件套齐全 |
| P4a CI | `check-ci.sh` 全绿（类型检查 / quant 3 + accounts 13 单测 / 58 项资源契约 / 技能包 / 图标） |
| P4b 冒烟 | 打包 exe 直启 ~2s 就绪；token URL 格式与壳解析一致；logo 探针 200 svg；落地页 200；`/workspace` 匿名 302 回 landing（账户门在）；token→cookie 引导 303 正常；workspace HTML 200 且 `@kstock` 静态资源由新引擎服务；`/kstock-api` 路由注册正常 |
| P5 收尾 | 上游同步文档回写（`run build` 步骤 / office sidecar / 版本口径）；本记录 |

### 计划外适配：office sidecar（`scripts/build-engine-bundle.sh`）

差异分析未识别的一处：dsh-alpha.2 合并为引擎 exe 新增 **`-office` sidecar
目录**（LibreOffice 转换依赖闭包，约 302MB），KStock 组装脚本的 `cp` 把它当
文件复制而失败。已按运行时解析规则（SEA 引导按 `<execPath>-office/package.json`
重定向 `@deepseek-ai/libreoffice-kit` 解析）适配：

- 目录类产物 `cp -R` 整树复制为 `dist-exe/kstock-engine-office/`（该目录
  随 extraResources 整体进安装包；**不可省略**——kstock profile 叠层的
  `@qilin/web-app` bundle 依赖 `@qilin/office-to-pdf`，其静态 import 在
  SEA 模式必须命中该 sidecar）；
- 清理命令 `rm -f` → `rm -rf`（覆盖目录残留）；
- macOS 预签循环跳过目录（codesign 只签可执行文件）。

### 遗留观察（非本次升级引入）

- 用户侧 MCP 配置请求 `@playwright/mcp@0.0.82`（npm 不存在该版本），
  引擎启动时反复重试报 ETARGET——属 `~/.kstock/qilin-home` 内的 MCP 配置
  问题，建议改为存在的版本。
- 桌面端真机逐屏冒烟（P4c 六项：登录/侧边栏分区/设置页插件管理/四库/报告/
  中文文案）需人工过一遍后合并分支。

### 升级后修复：客户端运行时缝破坏（桌面冒烟发现，即风险 R2 兑现）

**现象**：点击新闻/选股库「解读」菜单报 `sessions.open is not a function`。

**根因**：3.0.2 引擎把会话导航从 `sessions` 服务移交视图拥有者——
`ISessions.open(id)` 删除，`SessionListState.current` 移除；替身为
`uiWorkspace.openSession(target)` 与 `uiWorkspace.selection`。该缝为
运行时动态注入（kstock 插件不解析 @qilin 模块、只声明最小结构面），
tsc 与 check-ci 均无法拦截——正是差异分析风险清单 R2 预判的
「客户端运行时契约大改，类型检查覆盖不了」。

**修复**（`kstock/quant-ui/src/task-target.tsx`）：
- 打开会话改 `uiWorkspace.openSession(id)`（retain mainView + 切选择 +
  selectPanel(null) 的完整旧语义）；
- 「跟随当前会话」读 `uiWorkspace.selection.getSnapshot().sessionId`
  （旧 `sessions.list.getSnapshot().current` 已不存在，若不改会静默
  每次新建会话——第二个隐性破坏）；
- `SessionsFace` 收敛为 `create`/`scope`。

**防回归**：`verify_package_resources.py` 新增 `verify_engine_client_faces`
——对引擎契约源码盯标记（sessions create/scope、uiWorkspace
openSession/connectWorkspace/pickDirectory、workspaces create、layout
selectPanel），并对 KStock 桥接做双向锚点（必须含新成员、禁止
`sessions.open(`/`.list.getSnapshot().current` 残留）。红路径已验证
（故意回退立即 FAIL）。随 check-ci.sh 每次运行。
