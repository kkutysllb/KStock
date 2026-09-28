# KStock 发布与自动更新改造计划（参考 KCoder 三平台发布机制）

**Goal:** 把 KStock 的三平台发布与自动更新从「1.x 时代形态、2.0 重构后从未跑通」改造成
「本地一条命令准备 + CI 三平台可重试构建 + 产物层硬门禁 + 客户端静默更新」的可用链路，
并补齐 KCoder 已经用真金白银换来的五道产物门与平台化签名纪律。

**Architecture:** 发布链分四层，本计划的核心是**让四层对同一个产物形态达成一致**：
① 本地入口（`build-release.sh`：bump / 门禁 / commit / annotated tag / atomic push / watch / 资产校验）；
② CI（`.github/workflows/release.yml`：三平台矩阵构建 → 产物层门禁 → publish job 汇总发 Release）；
③ 打包契约（`apps/desktop/electron-builder.yml` + `scripts/build-runtime-bundle.sh` + `scripts/check-release.sh`）；
④ 客户端消费（`electron-updater` 读 `latest*.yml` 从 GitHub Release 更新，含 blockmap 增量）。

**Tech Stack:** GitHub Actions（ubuntu-22.04 / macos-latest / windows-latest）、pnpm（根 9.15.0 + 引擎侧钉版 11.7.0 走 `scripts/qilin-pnpm.sh`）、Node 24（引擎要求 `^22.19.0 || >=24.0.0`）、
electron-builder 26 + electron-updater 6、macOS `codesign` / `notarytool` / `stapler`、`gh` CLI、Bash + Python 3。

**状态:** 本文件为**改造计划**，尚未执行；本轮未改动任何代码（唯一新增文件即本计划）。
与既有计划的衔接：引擎升级见 [执行手册](2026-09-28-qilin-3.0.5-implementation.md)
（已执行完毕，2026-09-28 晚随合并提交 `e6547774` 落入 main）；本计划**独立于**引擎版本，
R6 演练产物应包含引擎升级后的形态。

**复核修订（2026-09-28 晚，引擎升级合并后）:** 升级落地改变了本计划的四条事实前提，
修订已回写正文——①F3/G3 证据过期（`verify_package_resources` 已绿）但缺口变形到
`check-release.sh` / `build-desktop.sh`（见 R1.5 新形态）；②G11 表述不准，且 R1.6 原改法
会误伤本地开发闭包构建（见 R1.6 修订版：fail-closed 移到发布门）；③R0.3 基线过期
（在飞改动已合入 main），暂存改按路径、禁用 `git add -A`；④R1 增加先行完成记录：
`build-runtime-bundle.sh` 的 `REPO_ROOT` 变量 bug 当日已顺手修复。

---

## 0. 结论摘要

### 0.1 一句话现状

**2.0 的发布链路从未跑通过**：本地入口在 2.0 重构后已不可执行，CI 缺引擎引导步骤，
发布契约在四处互相矛盾，而 publish job 有一个潜伏的致命缺陷——**下一次推 tag 就会引爆**。

### 0.2 必须立刻知道的六件事

| # | 事实 | 级别 | 证据 |
|---|---|---|---|
| **F1** | **publish job 没有 `actions/checkout`**，却调用仓内脚本 `scripts/publish_release_notes.sh`；而 `push: tags` 事件的 workflow 取自**被推 tag 的 commit** → 改 main 对已推 tag 无效，只能 `--delete-tag` 重发。当前**未触发**（最后一次 tag `v1.1.0` 早于引入该步的提交 31 分钟），属**潜伏缺陷** | **致命** | `release.yml:76-94`（无 checkout）；引入步 `73f6c87a`（2026-09-01 22:23）晚于 `v1.1.0` tag（21:52） |
| **F2** | **CI 没有引擎引导步骤**：`vendor/qilin` 不在根 workspace（根 `pnpm-workspace.yaml` 只有 `apps/*`、`kstock/*`），而 `build-engine-bundle.sh` 需要 `vendor/qilin/node_modules` + `lib/` → 全新 runner 上 `qilin-pnpm.sh exec tsx …` 必然找不到 tsx | **阻断** | `scripts/build-engine-bundle.sh:75-78`（`--skip-build` 要求 lib 已存在）；工作流无任何 `qilin-pnpm`/`vendor/qilin` 步骤 |
| **F3** | **发布契约不一致（缺口变形，2026-09-28 晚复核）**：`extraResources` 与 `verify_package_resources` 已随引擎升级切到 `staging/` 闭包（A1 决策，实测 exit 0），但**发布执行体没跟着切**——`check-release.sh` 仍调已退役的 `build-engine-bundle.sh` 且不调 `build-runtime-bundle.sh`，`build-desktop.sh` 仍断言 `dist-exe/kstock-engine` → 全新 runner 上 `staging/` 无人构建，打包链必断（本地因 `staging/` 恰好存在而侥幸） | **阻断** | 实跑 `verify_package_resources.py --source-only` = exit 0（原红灯已消）；`check-release.sh:8-11`、`build-desktop.sh:15` 仍见 `dist-exe` / 旧 SEA 构建 |
| **F4** | **签名凭据在三个平台全量注入**（无 `runner.os` 守卫）。KCoder 已记录同类事故：Windows 包被 Apple 证书签名 → Authenticode NotValid → electron-updater 拒更新，且 `app-update.yml` 写入 mac 证书 CN 作 publisherName | **高（潜伏）** | `release.yml:38-54`（单一 env 块，job/step 无 `if`）vs KCoder `release.yml:77-78/103/128-131` |
| **F5** | **mac 未显式声明 `notarize`** → 凭据缺失时 electron-builder **静默跳过公证**并照常出包，用户侧被 Gatekeeper 拦 | **高** | `electron-builder.yml` 无 `notarize` 键（KCoder 有 `notarize: true:102`） |
| **F6** | **本地入口 2.0 后不可执行**：`build-release.sh` 仍按 1.x 处理 `pyproject.toml`（已删）与 `uv.lock`（已删），`update_versions` 读不到文件即抛异常 | **高** | `build-release.sh:316-350`（无守卫 `read_text`）；`git ls-files` 无根级 `pyproject.toml`/`uv.lock` |

### 0.3 目标形态

```
本地：./build-release.sh v2.0.0            # bump → 门禁 → 说明前置门 → commit → annotated tag → atomic push → watch → 资产校验
  └─ 门禁 = check-ci + 引擎引导 + 闭包构建 + 产物层 verify（本地/CI 同源脚本）

CI：push tag / workflow_dispatch(tag)
  ├─ build 矩阵（ubuntu-22.04 | macos-latest | windows-latest，fail-fast:false）
  │    ├─ 引擎引导（pnpm install --frozen-lockfile + run build + verify-runtime-closure，可缓存）
  │    ├─ 闭包构建（build-runtime-bundle.sh：deploy + 物化 + ABI 冒烟 + 预签[仅 Darwin]）
  │    ├─ electron-builder（macOS：签名 + notarize:true 必须成功；非 macOS：**不注入任何签名变量**）
  │    └─ 产物层门禁（5 道硬门，见 §4.4）
  └─ publish（checkout sparse=release → 正文取 release/<tag>.md → 汇总 artifact 发 Release）

客户端：app-update.yml/latest*.yml → electron-updater 静默下载 + 退出时安装（失败可见、能重试）
```

---

## 1. 参考基准：KCoder 机制全景

> KCoder 的 `release.yml` 自己写着「KStock 同款模式」——两者同源，但 KCoder 在此后**继续演进并记录了事故**。
> 本节只收录「KStock 尚未具备」且**有事故背书**的部分。

### 1.1 本地入口 `scripts/release.sh`（525 行）

| 子命令 | 作用 | 值得抄的点 |
|---|---|---|
| `status` | 只读总览（版本/上游构建态/物化/dist/tag/gh release） | 发布前一眼看全 |
| `build` | 六步链：patchgate → vendor 纯净 → 上游就绪+基线祖先校验 → install/typecheck/build → **deploy 物化 + peer 补齐** → 品牌断言 → **Electron-node 运行时冒烟** → **公证凭据缺失即 die** → electron-builder → `verify` | 「本地构建链就是 CI 链」 |
| `verify` | 五项产物电池（见 1.4） | 产物层硬门 |
| `bump` | 只改 `package.json` | 单一版本源 |
| `prepush` | audit + patchgate + bundleline + settings-smoke + 全量 build | 门禁分层 |
| `ship <version>` | **强制** `release/<tag>.md` + `release/audit-<tag>.md` 存在 → prepush → 拒已有 tag / 落后远端 → bump → commit → tag → push main+tag | 发布说明**前置** |
| `tag` / `release` | 打/推/删 tag；用本地 dist 走 `gh release create/delete --with-tag` | 应急手动通道 |

### 1.2 CI `.github/workflows/release.yml`（247 行）

- 触发：`push: tags: v*` **+ `workflow_dispatch`（带 `tag` 输入 + `ref: inputs.tag || github.ref`）**——平台失败可单平台补跑。
- 矩阵：`[ubuntu-22.04, macos-latest, windows-latest]`，`fail-fast: false`，`defaults.run.shell: bash`。
- 工具链：**显式钉 pnpm**（11.7.0，注释要求与上游同主版本，否则 `ERR_PNPM_UNEXPECTED_STORE`）+ node 22。
- 签名**平台化**：mac 步 `if: runner.os == 'macOS'` 注入 `CSC_NAME` / `CSC_KEYCHAIN_PATH` / Apple 三件套；
  非 mac 步 `if: runner.os != 'macOS'` **不注入任何签名变量**，注释写明「曾全局注入 → Windows exe 被 Apple 证书签名 → updater 拒更新」。
- 产物门（5 道，见 1.4）；产物按**扩展名**收集（含 `*.blockmap`、`latest*.yml`），`if-no-files-found: error`。
- publish job：**`actions/checkout` + `sparse-checkout: release`** → 正文取 `release/<tag>.md`，缺失回退自动摘要。

### 1.3 打包契约 `electron-builder.yml`（119 行）

| 做法 | 事故背书 |
|---|---|
| **三端 `artifactName` 全部去空格固定**（`KCoder-${version}-${arch}` / `KCoder-Setup-${version}` / `KCoder-${version}`） | builder 写 yml 把空格换 `-`、GitHub 上传换 `.` → **三方不一致 → 自动更新 404**（v0.1.1/v0.1.2 中招） |
| **`mac.notarize: true`** | 缺凭据即构建失败，杜绝未公证包流出（KStock 靠环境变量存在性自动公证 = 静默降级） |
| `hardenedRuntime: true` + 显式 entitlements（主 + inherit 两份） | 缺 `allow-jit` → 主进程 JIT 内存预留被内核拒 → SIGTRAP |
| `asarUnpack: ['**/*.sh', 原生模块]` | 原生 `.node` 不能进 asar |
| `extraResources` **目录级映射** + 逐目录对账 | 「加进 bundle/ 却漏配 extraResources」连漏五版的实际事故 |
| Linux `[AppImage, deb]`；win `nsis`；win/linux **不配签名** | electron-updater 对空 publisherName 放行（显式接受该默认） |

### 1.4 五道产物门（KStock 目前**一道都没有**）

| # | 门 | 拦什么 |
|---|---|---|
| 1 | 品牌/资产断言（打进产物的内容级断言） | 「修复没随发布源推送、产物还是旧的」 |
| 2 | **Electron-node 形态运行时冒烟**（解包内 tar.gz，用产物自身的解释器起服） | 系统 node 冒烟绿、真机挂（v0.1.0 首启 crash-loop） |
| 3 | **内置 bundle 随包对账**（`bundle/` ↔ 包内 resources 逐目录） | extraResources 漂移致全新安装引擎起不来 |
| 4 | macOS 签名与公证断言：拒 `Signature=adhoc`、须 `TeamIdentifier`、`xcrun stapler validate` | 证书/公证未生效时静默发坏包 |
| 5 | 更新元数据与资源名一致（`latest*.yml` 的 `url/path` ∈ Release 资源名） | 自动更新 404 |

> 第 5 道 KStock **已有**（`build-release.sh:498-597` 的 `verify_release_assets`，比 KCoder 更完整：三平台 yml 全覆盖），
> 但它在**发版之后**才跑，且 CI 侧没有平价版。

### 1.5 自动更新（`desktop/main/updater.ts`，202 行）

后台静默下载 + 退出时安装 + **四处入口**（侧边栏图标悬停出更新内容、应用菜单动态项、托盘 tooltip、诊断页）；
启动后 **8s 延迟**才检查且**仅一次**；`quitAndInstall` 有 **try/catch 并回 error 态**；
发布说明 fetch 8s 超时静默降级。
**无** channel / 灰度 / 自动回滚 / 自动重试（`allowPrerelease`、`allowDowngrade` 均未开）。

---

## 2. KStock 现状核查（证据）

### 2.1 本地链路

| 组件 | 现状 | 关键行 |
|---|---|---|
| `build-release.sh`（638 行） | 能力其实**比 KCoder 的 release.sh 更细**：`--dry-run/--resume/--delete-tag/--no-fetch/--skip-lock/--no-commit/--no-tag/--force/--watch`、失败日志留存、`gh run watch` 轮询跳过旧 run、**资产校验含 yml↔资源名交叉比对** | `:166-204`（参数）、`:498-597`（资产校验） |
| 版本 bump | `VERSION_FILES = package.json / apps/desktop/package.json / **pyproject.toml**`；`LOCK_FILES = pnpm-lock.yaml / **uv.lock**`；`refresh_lockfiles` 里 `need_cmd uv` + `uv lock` | `:33-42`、`:316-362` |
| 根级 `pyproject.toml` / `uv.lock` | **不存在**（2.0 已无 Python 工程） | `git ls-files` 无、实测 `read_text` 抛 `FileNotFoundError` |
| `REPO_SLUG` | 赋值未 `export` → Python 侧取到空串；**实测 `gh release view --repo ""` 会回落 cwd 推断而侥幸可用** | `:17/:238` vs `:514`（【已核实】未 export；【已核实】当前可用） |
| `run_checks` | 只跑 `verify_package_resources.py --source-only` + `check-ci.sh`（**不做本机打包**） | `:364-373`；与 `docs/发布说明.md:15` 的说法不符 |
| 发布说明 | `build-release.sh` **不校验** `release/<tag>.md`；tag 注解取自 `git log` 摘要 | `:375-383`、`:408-410` |

### 2.2 CI

| 组件 | 现状 | 关键行 |
|---|---|---|
| `release.yml`（94 行） | 仅 `push: tags v*`；矩阵 `ubuntu-latest`（**非 22.04**）+ macos + windows；node 24；**未显式钉 pnpm**；动作 **pin 到 commit SHA**（比 KCoder 严谨） | `:7-11`、`:24`、`:30-34` |
| 权限 | 顶层 `contents: read`、publish job `contents: write`（比 KCoder 的顶层 write 更收敛） | `:15-16`、`:80-81` |
| 执行体 | 单步 `bash scripts/check-release.sh`（= `check-ci` → **旧** `build-engine-bundle.sh` → product 模式 verify → `build-desktop.sh`） | `:55`、`scripts/check-release.sh:8-11` |
| 引擎引导 | **无**（无 `qilin-pnpm` / `vendor/qilin` 步骤） | 全工作流 grep 无命中 |
| 产物收集 | 按扩展名含 `rpm`/`blockmap`/`latest*.yml`，`if-no-files-found: error` | `:56-74` |
| publish job | download-artifact → ls → **调用仓内脚本（无 checkout）** → softprops | `:76-94` |

### 2.3 打包契约（原「在飞改动」已随引擎升级合入 main，2026-09-28）

| 文件 | 现状 |
|---|---|
| `electron-builder.yml` | mac dmg+zip、`hardenedRuntime`、entitlements（单份，内容为主文件超集，**够用**）、`gatekeeperAssess:false`、**无 `notarize` 键**；win nsis + `artifactName: ${productName}-Setup-${version}.${ext}`（v1.0.8 404 的正式防线）；linux deb+rpm；**win/linux 无签名配置**；`extraResources` 指 `staging/*` 三件套（随引擎升级合入 main） |
| `electron-builder.local.yml` | `extends: ./electron-builder.yml` + `publish: null`，治本地离线构建触网 |
| `build-desktop.sh` | 前置断言 **`dist-exe/kstock-engine`**（旧路径）；Darwin 分支 `ulimit -n 10240`、`CSC_LINK` 未设则 `CSC_IDENTITY_AUTO_DISCOVERY=false`；重试 3 次（仅 mac）；`KSTOCK_OFFLINE_BUILD` 切 local 配置 |
| `build-runtime-bundle.sh` | 闭包构建（deploy + 物化 + ABI 冒烟 + 闭包预签）；预签分支**缺 `uname` 守卫**：未设 `APPLE_SIGNING_IDENTITY` 时优雅跳过（当日两次实测），但变量被全局注入（G4）时 ubuntu/windows 会执行 mac 预签脚本而挂；`:151` 的 `REPO_ROOT` 未定义变量已当日修复（收尾依赖还原步此前必失败） |
| `verify_package_resources.py` | 断言已随引擎升级切闭包形态（A1 决策）：`extraResources` 断言 `staging/` 三件套、product 模式断言闭包结构，实测 exit=0；**遗留**：顶部 docstring 仍写「product 模式校验 dist-exe」（R1.5 收尾） |
| `check-ci.sh` | `:30` 跑 `verify_package_resources.py --source-only`；`:41` 冒烟 `dist-exe/kstock-engine --help` |
| `presign-engine-macos.sh` | 默认目录仍写死 `dist-exe`（调用方传参，功能可用，**默认值/注释陈旧**） |
| 本地签名流水线 | `build-signed-macos.sh`（223 行）已固化四个实测坑：离线配置、`ELECTRON_MIRROR`、**不设 `CSC_LINK` 改走 `CSC_KEYCHAIN`+`CSC_NAME`**、以 `notarytool history` 的 Apple 侧状态为准；**CI 完全不复用** |

### 2.4 自动更新

- `updater.ts`（245 行）：feed 硬编码 `{provider:'github', owner:'kkutysllb', repo:'KStock'}`；`autoDownload=true`、`autoInstallOnAppQuit=true`；
  **init 末尾立即 `checkForUpdates()`，无延迟、无 updatable 门**；`error` 只 `logMain`；
  `update-downloaded` → 系统通知（`silent:true`，点击回窗口走交互式检查）；`Notification.isSupported()` 为假则静默无兜底 UI；
  releaseNotes 归一化 + **GitHub Release API 回退（6s 超时）**——这一点**比 KCoder 完整**。
- **缺陷**：`installUpdate` 里 `setTimeout(() => { … autoUpdater.quitAndInstall(false, true) }, 200)` **无 try/catch** → 安装失败成为 unhandled 异常（KCoder 有 try/catch 并回 error 态）。
- **缺失**：无 channel / `allowPrerelease` / `allowDowngrade` / 回滚（与 KCoder 同缺，非本次必须）。

### 2.5 文档与历史事故

| 事故 | 现行防线 |
|---|---|
| v1.0.8 自动更新 404（`latest.yml` 写连字符、资源名点分隔） | `nsis.artifactName` 固定命名（builder 配置）+ `verify_release_assets` 的 yml↔资源名交叉比对 |
| v1.0.9 三平台构建全挂 | CI `fail-fast: false` + 按扩展名（非前缀）收集产物 |
| v1.1.0 更新图标悬停预览发布内容 | `updater.ts` 的 GitHub body 回退 |
| **文档陈旧** | `docs/发布说明.md:15` 说一键发布会「本机桌面构建」（实际不）；`:44-46` 讲侧栏隐藏下载图标（2.0 已无 SPA）；`:66-68` 仍描述 PyInstaller `build-gateway-bundle.sh` + Python runtime；`:72` 说 publish job「自动生成发布说明」（实为 `body_path`）；未收录 `--resume/--delete-tag/--dry-run/--skip-lock/--no-fetch` |

---

## 3. 差距清单（按危害排序）

| # | 缺口 | 危害 | 借 KCoder 的哪一条 |
|---|---|---|---|
| **G1** | publish job 无 `checkout`（F1） | 下次推 tag 必然不产出 Release；三平台各最多 90 min 白跑；且**不可原地修**（须 delete-tag 重发） | 1.2 的 publish job 结构 |
| **G2** | CI 无引擎引导（F2） | 全新 runner 上发布链第一步就断 | 1.2 的「上游克隆+构建」前置步 |
| **G3** | 发布执行体未随闭包形态切换（F3 变形后）：`check-release.sh` / `build-desktop.sh` 仍走旧 SEA | 全新 runner 打包链必断；本地「恰好有 staging」掩盖矛盾 | 1.3 的「目录级映射 + 对账」+ 1.4-3 |
| **G4** | 签名变量三平台全量注入（F4） | 隐式安全，随时重演「Windows 包被 mac 证书签名 → 更新被拒」 | 1.2 的平台化注入 |
| **G5** | mac 未 `notarize: true`（F5） | 凭据失效即静默发未公证包 | 1.3 |
| **G6** | 本地入口 2.0 后不可执行（F6） | 无法用一条命令准备发版 | 1.1 的单一入口 |
| **G7** | CI 无产物层门禁（签名/公证、包内运行时冒烟、bundle 随包对账） | 坏包静默发布 | 1.4 的 2/3/4 道 |
| **G8** | 无 `workflow_dispatch`（平台失败不能补跑） | 单平台失败要重跑全矩阵 | 1.2 的触发面 |
| **G9** | 无发布说明前置门 | 漏写说明静默退化为提交列表 | 1.1 的 ship 强制校验 |
| **G10** | updater `quitAndInstall` 无异常兜底 | 安装失败无用户可见反馈 | 1.5 |
| **G11** | 闭包预签分支**无 `uname` 守卫**（与 G4 的按平台注入冲突）：现脚本是「未设 `APPLE_SIGNING_IDENTITY` → 跳过」的优雅降级（当日实测），但变量一旦被全局注入（G4 现状），ubuntu/windows 会拿 mac 变量跑 `presign-engine-macos.sh`（`codesign` 不存在）→ 必挂 | 接入 CI 后 ubuntu/windows 必挂 | — |
| **G12** | 文档陈旧 | 误导后续维护 | 1.1/1.2 的约定文档化 |
| **G13** | Windows 未签名（SmartScreen 警告）；Linux 无 AppImage | 用户侧体验 | KCoder 显式接受 win/linux 不签名 + 出 AppImage |

---

## 4. 目标形态设计

### 4.1 单一事实源表（本计划的核心交付物之一）

> 这张表要写进 `docs/开发/发布契约.md`，任何一处改动必须同步其余行——**G3 就是这张表缺位的直接后果**。

| 事实 | 唯一权威 | 必须同步的消费方 |
|---|---|---|
| 版本号 | 根 `package.json` | `apps/desktop/package.json`、`build-release.sh`、tag |
| **引擎产物形态** | **运行时闭包**：`staging/kstock-runtime.tar.gz` + `staging/plugins/*` + `staging/presets/*` | `electron-builder.yml:extraResources`、`build-desktop.sh` 前置断言、`verify_package_resources.py`、`check-ci.sh`、`check-release.sh`、`presign-engine-macos.sh` 默认值 |
| 产物命名 | `electron-builder.yml` 的 `artifactName`（三端去空格） | `latest*.yml`（builder 生成）、`verify_release_assets` 的期望清单、`release.yml` 的收集扩展名 |
| 更新元数据 | builder 生成的 `latest*.yml` + `*.blockmap` | `release.yml` 收集、`verify_release_assets` 交叉比对、`updater.ts` 的 feed |
| 发布说明 | `release/<tag>.md` | `build-release.sh` 前置门、`publish_release_notes.sh`、publish job 的 `body_path` |
| secrets | `APPLE_SIGNING_IDENTITY`、`MAC_CERTIFICATE(_PWD)`、`APPLE_ID`、`APPLE_APP_SPECIFIC_PASSWORD`、`APPLE_TEAM_ID` | **仅 macOS 步注入**；`build-runtime-bundle.sh` 的预签、electron-builder 的签名与公证 |

### 4.2 平台化签名与 fail-closed 公证

1. `electron-builder.yml`：加 `mac.notarize: true` → 凭据缺失时 **构建失败**而非静默出包。
2. `release.yml`：把签名凭据从共享 `env` 块**移入 macOS-only 的 step env**；非 macOS 步骤显式不注入任何签名变量。
3. `build-runtime-bundle.sh`：把 `APPLE_SIGNING_IDENTITY` 断言包进 `uname -s == Darwin` 分支（非 Darwin 跳过闭包预签）。
4. `build-desktop.sh`：把 `CSC_IDENTITY_AUTO_DISCOVERY=false` 的 fallback 从「`CSC_LINK` 未设」改为「**显式的 `KSTOCK_UNSIGNED_BUILD=1`**」，
   使「无凭据」与「我要一个未签名本地包」两件事分离——CI 上未签名构建应当**失败**而不是悄悄产出。
5.（可选 P2）CI 切 `CSC_KEYCHAIN` + `CSC_NAME`（KCoder 记录：macos 镜像 25.6.0 起自建钥匙串解锁失败）；保留 `CSC_LINK` 作为当前路径，
   判据写进契约文档：**若某次发布出现「签名 step 通过但产物 adhoc」，即切该路径**。

### 4.3 CI 结构（对齐 KCoder 的矩阵 + KStock 的收敛权限）

```yaml
on:
  push: { tags: ["v*"] }
  workflow_dispatch:                 # G8：平台失败补跑
    inputs:
      tag: { description: "要构建发布的 tag（须已推送）", required: true }
permissions: { contents: read }      # 顶层只读（保留 KStock 现有收敛）
jobs:
  build:                             # matrix: ubuntu-22.04 | macos-latest | windows-latest
    steps:
      - checkout: { ref: inputs.tag || github.ref }        # 与 workflow_dispatch 配套
      - 工具链：pnpm(action-setup) + node 24
      - 引擎引导：qilin-pnpm install --frozen-lockfile && run build && run verify-runtime-closure   # G2
      - 闭包构建：build-runtime-bundle.sh（含 ABI 冒烟；预签仅 Darwin）                              # G11
      - 打包：macOS 步（签名 + notarize:true）/ 非 macOS 步（不注入签名）                            # G4/G5
      - 产物层门禁（§4.4 五道）                                                                      # G7
      - 收集 artifact（扩展名匹配 + if-no-files-found: error）
  publish:
    needs: build
    steps:
      - checkout: { sparse-checkout: release }           # G1 的修复
      - download-artifact: { merge-multiple: true }
      - publish_release_notes.sh <tag> release-notes.md
      - softprops/action-gh-release（files + body_path）
```

### 4.4 产物层门禁电池（KStock 版 `verify`，本地与 CI **同源**）

新脚本 `scripts/verify-desktop-artifacts.sh`（或 `.py`），入参为打包产物目录，断言：

| # | 断言 | 依据 |
|---|---|---|
| V1 | 包内存在 `kstock-runtime.tar.gz`（单文件形态） | `extraResources` 契约 |
| V2 | 解压闭包后：`runtime-bootstrap.mjs` 在位、`node_modules/dsh-animations/{package.json,skills/manifest.json}` 在位（升级计划 R6） | 引擎启动期硬依赖 |
| V3 | `resources/engine/plugins/` 下 13 个 KStock 插件目录与仓库清单**逐一在**；`resources/engine/presets/` 与 `kstock/presets` 逐一在 | 对应 KCoder 的 bundle 随包对账（G3/G7） |
| V4 | 用 **Electron 内置 node** 跑包内闭包入口：真实起服 → 就绪行 + 首页 200（复用 `scripts/local/smoke-runtime-closure.cjs` 与 `--help` 冒烟） | 对应 KCoder 第 2 道（真机解释器路径） |
| V5 | macOS：`codesign -dv` **拒 `Signature=adhoc`**、须 `TeamIdentifier`；`spctl -a -vv`；`xcrun stapler validate` 必须通过 | 对应 KCoder 第 4 道 |
| V6 | 更新元数据齐全：mac `latest-mac.yml` + `*.zip` + `*.blockmap`；win `latest.yml` + `*.exe`；linux `latest-linux.yml` + `*.deb`（`*.rpm` 存在即校验） | 对应 KCoder 第 5 道（**KStock 定为硬门**，KCoder 是 warn） |
| V7 | **非 macOS 产物的 `resources/app-update.yml` 不得带 `publisherName`**（Windows/Linux）；macOS 产物的 `publisherName` 必须等于本机证书 CN | KCoder 记录的「全局注入 mac 证书 → Windows app-update.yml 写入 mac CN → updater 校验失败」双重失败，用一条断言永久钉死 |

### 4.5 重试、幂等与不可变 tag

- `workflow_dispatch` 带 `tag` + checkout `ref` → 单平台补跑。
- 发布 job 加 `concurrency: { group: release-${{ tag }}, cancel-in-progress: false }`，避免同一 tag 并发发布互相覆盖。
- **契约文档必须写明**：`push: tags` 事件的 workflow 取自**被推 tag 的 commit** ⇒ 一旦某次 tag 发布失败且原因是 workflow 自身，
  必须 `./build-release.sh --delete-tag <tag>` → 重打 tag（`build-release.sh:287-293` 已支持）。
  这条要作为「发布事故处置 SOP」的第一条。

### 4.6 自动更新加固

| 改动 | 依据 |
|---|---|
| `installUpdate` 的 `quitAndInstall` 加 `try/catch` → 失败回 `error` 状态并保留可重试入口（不留在 installing） | KCoder 1.5 |
| 启动检查改为「打包态 + 延迟 8s + 单次」，避免与引擎冷启动抢 IO | KCoder 1.5 |
| feed 单一来源：从 `app-update.yml`（builder 生成）读取，或在代码里注释声明「与 `electron-builder.yml:publish` 必须一致」并由门禁断言 | 消除双源 |
| （可选 P2）`allowPrerelease` + `channel` 预留：让 `v2.0.0-rc.N` 可被测试者自动升级 | 演练需要 |

---

## 5. 分阶段实施计划

> 每个任务给「目标 / 文件 / 改动 / 验收」。**红色路径**指「故意制造反例，门禁必须红」——
> 这是本计划与普通文档的最大区别：每道门都要证明它真的会拦。

### Phase R0 — 契约冻结与基线（半天）

- [ ] **R0.1 记录基线证据（只读，2026-09-28 晚修订）**

```bash
cd /Users/libing/kk_Projects/KStock
scripts/python.sh scripts/verify_package_resources.py --source-only; echo "exit=$?"   # 期望 exit=0（原红灯已随引擎升级消解）
grep -n "dist-exe\|build-engine-bundle\|build-runtime-bundle" scripts/check-ci.sh \
    scripts/build-desktop.sh scripts/check-release.sh scripts/verify_package_resources.py \
    apps/desktop/electron-builder.yml 2>/dev/null
```

**交付**：把两条命令的输出贴进本计划的执行记录。第一条证明 verify 已绿（F3 原证据过期），
第二条证明缺口变形到 `check-release.sh` / `build-desktop.sh`（仍指 `dist-exe` / 旧 SEA 构建）。

- [ ] **R0.2 写 `docs/开发/发布契约.md`**（新建）

内容 = §4.1 的单一事实源表 + §4.4 的门禁矩阵 + §4.5 的不可变 tag SOP + secrets 清单与注入范围。
**这是本阶段最重要的产出**：后续所有任务都以它为准绳。

- [ ] **R0.3 从当前 main 开分支（2026-09-28 晚修订：基线过期）**

> 原文「冻结基线：提交在飞改动」已过期——在飞的闭包装配与本地签名流水线已随
> 引擎升级合并 main（`e6547774`），无需补提交；基线即当前 main，仍需记录起始 SHA。

```bash
git checkout main && git pull
git checkout -b refit/release-pipeline
git rev-parse HEAD   # 记入执行记录 = 回滚锚点
```

**验收**：`git status --short` 干净（除 gitignored 生成物）；暂存一律**按路径**
`git add <path>...`，禁用 `git add -A`（`vendor/` 下偶有未跟踪杂物，如临时截图，
全量暂存会把它们吞进提交）。

---

### Phase R1 — 本地链路修复：让「一条命令准备发版」重新可用（1 天）

> **先行完成（2026-09-28 晚，随引擎升级顺手修）**：`build-runtime-bundle.sh:151`
> 收尾「deploy 剪枝回滚」误用未定义 `REPO_ROOT`（应为 `ROOT`），此前该步必失败、
> 依赖还原不执行（`commander` 缺失类问题的复发点）。已修，全脚本端到端 exit 0。

- [ ] **R1.1 去掉 1.x 遗留的版本/锁文件**

**文件**：`build-release.sh:33-42`、`:316-362`

```diff
 VERSION_FILES=(
   "package.json"
   "apps/desktop/package.json"
-  "pyproject.toml"
 )
 
 LOCK_FILES=(
   "pnpm-lock.yaml"
-  "uv.lock"
 )
```

```diff
-for path in [Path("pyproject.toml")]:
-    text = path.read_text(encoding="utf-8")
-    ...
+# 2.0 起无 Python 工程（原 pyproject.toml / uv.lock 已随 1.x 网关退役）
```

```diff
 refresh_lockfiles() {
   ...
   ensure_pnpm_compatible
-  need_cmd uv
   log "Refreshing lockfiles"
   run pnpm install --lockfile-only --ignore-scripts
-  run uv lock
 }
```

**验收**：`./build-release.sh v9.9.9 --dry-run --force` 打印计划且不改文件；
`git checkout -- . && git tag -l v9.9.9` 为空（dry-run 不落盘）。

- [ ] **R1.2 `REPO_SLUG` 显式导出**

```diff
-REPO_SLUG=""
+REPO_SLUG=""
+export REPO_SLUG          # verify_release_assets 的 Python 段按环境变量读它；
+                          # 现状靠 gh 的 cwd 推断侥幸可用（实测 --repo "" 会回落），不依赖运气
```

**验收**：在 `verify_release_assets` 的 Python 段临时加一行 `print(f"repo={repo!r}")`，
用 `./build-release.sh --watch` 跑到该段，输出必须是真实的 `kkutysllb/KStock`（而不是 `''`），
验证后回退该行。

- [ ] **R1.3 发布说明前置门（G9）**

**文件**：`build-release.sh`（`main()` 的 `confirm` 之前）

```bash
if [[ ! -f "release/$TAG.md" && "$ALLOW_MISSING_NOTES" != true ]]; then
  die "缺发布说明 release/$TAG.md（约定见 release/README.md）。
       GitHub Release 正文以它为准；确要跳过请加 --allow-missing-notes。"
fi
```

新增参数 `--allow-missing-notes`（默认 false）并写进 `usage()`。

**验收（红路径）**：故意用一个没有说明文件的版本号跑 → 在 `confirm` 之前就退出并打印该提示。

- [ ] **R1.4 `run_checks` 与本机打包对齐（可选）**

现状 `run_checks` 只跑 CI 级检查，`docs/发布说明.md:15` 声称会做本机桌面构建。二选一：
（a）把文档改成事实；（b）增加 `--with-desktop-build` 开关，走 `scripts/check-release.sh`。
**建议（a）+ 保留 `check-release.sh` 作为手动入口**——本地打包成本高，且签名/公证凭据在 CI 才有。

- [ ] **R1.5 发布执行体切到闭包形态（G3 主修，2026-09-28 晚修订）**

> 修订背景：`electron-builder.yml` 的 `extraResources` 与 `verify_package_resources.py`
> 的断言已随引擎升级切到 `staging/` 闭包（A1 决策，实测 exit 0）——原表两行 verify
> 断言项**已完成**。缺口变形在发布执行体：本表以「让 `check-release.sh` 这条链
> 产出并消费同一份 `staging/` 三件套」为唯一目标。

| 文件 | 改动 |
|---|---|
| `scripts/check-release.sh` | `build-engine-bundle.sh` → `build-runtime-bundle.sh`（CI 上 `staging/` 的唯一来源）；product verify 仍走 `verify_package_resources.py` |
| `scripts/build-desktop.sh:6,15` | 前置断言改 `staging/kstock-runtime.tar.gz` + `staging/plugins` + `staging/presets` |
| `scripts/check-ci.sh:43-44` | `dist-exe/kstock-engine --help` 冒烟改闭包冒烟（`staging/kstock-runtime` 存在时以 Electron node 跑 `runtime-bootstrap.mjs --help`） |
| `scripts/local/presign-engine-macos.sh:2-22` | 默认目录与注释从 `dist-exe` 改为闭包目录（或去掉默认值，强制传参） |
| 契约裁决 | `build-engine-bundle.sh`（旧 SEA，文档已称退役）二选一写进契约文档：(a) 从 `verify_package_resources` 必查清单摘除并标注「仅新旧回归对比手动用」；(b) 彻底删除。**建议 (a)**（已登记进 `docs/开发/发布契约.md` §5） |
| `apps/desktop/electron-builder.yml:65` | 注释仍写「引擎 Mach-O 的预签由 build-engine-bundle.sh 负责」——预签主体已是 `build-runtime-bundle.sh`（闭包整树），同步注释（R0 复核新发现） |
| `verify_package_resources.py:7` | 顶部 docstring 仍写「product 模式校验 dist-exe」，同步为闭包口径 |
| ~~verify 断言两行~~ | **已完成**（引擎升级落地）：`extraResources` 与 product 模式断言均已切 `staging/` |

**验收（绿）**：

```bash
scripts/python.sh scripts/verify_package_resources.py --source-only; echo "exit=$?"   # 期望 exit=0
bash -n scripts/check-release.sh scripts/build-desktop.sh scripts/check-ci.sh
```

另加一条：在**没有 `staging/` 的干净副本**（如 `git worktree`）里跑 `check-release.sh` 至打包前一步，
必须自建 `staging/`，而不是依赖「本地恰好构建过」。

**验收（红路径）**：把 `electron-builder.yml` 的 `extraResources` 临时改回 `../../dist-exe` → 门禁必须 `FAIL`（证明这道门还活着）。

- [ ] **R1.6 闭包预签的平台守卫与 fail-closed 位置（G11，2026-09-28 晚修订）**

> 原提案把「macOS 缺 `APPLE_SIGNING_IDENTITY`」改成 `die`——会把本地开发闭包构建
> （无身份、不公证，当日两次实测可用）一起打死。修订为职责分离：
> **脚本本体保本地可用**（缺身份 = 跳过预签；非 Darwin = 根本不碰预签脚本），
> **fail-closed 放到发布门**（`check-release.sh` 入口要求身份齐备）。

```diff
 # scripts/build-runtime-bundle.sh（预签步）
-if [ -z "${APPLE_SIGNING_IDENTITY:-}" ]; then
-  log "未设 APPLE_SIGNING_IDENTITY——跳过预签（本地开发闭包，不公证）"
-else
-  ...预签...
-fi
+# 预签只在 macOS 有意义（其他平台无 Mach-O）；非 Darwin 不碰预签脚本，
+# 否则配合 G4 的全局凭据注入，ubuntu/windows 会拿 mac 变量跑 codesign 而挂。
+if [ "$(uname -s)" = "Darwin" ]; then
+  if [ -n "${APPLE_SIGNING_IDENTITY:-}" ]; then
+    ...预签 + codesign --verify --strict...
+  else
+    log "未设 APPLE_SIGNING_IDENTITY——跳过预签（本地开发闭包，不公证）"
+  fi
+fi
```

```diff
 # scripts/check-release.sh（发布门，fail-closed 所在）
+if [ "$(uname -s)" = "Darwin" ]; then
+  [ -n "${APPLE_SIGNING_IDENTITY:-}" ] || die "发布构建必须提供 APPLE_SIGNING_IDENTITY（公证硬要求）"
+fi
```

**验收**：① 本地无身份 `bash scripts/build-runtime-bundle.sh` 照常可跑（不回归当日行为）；
② macOS 上 `check-release.sh` 无身份响亮失败；③ 非 Darwin 分支不执行预签（`bash -x` 或 `uname` 桩观察）。

- [ ] **R1.7 提交 R1**

```bash
git add build-release.sh scripts/ docs/开发/发布契约.md
git commit -m "refactor(release): 本地入口去 1.x 遗留、发布说明前置门、发布契约切到运行时闭包形态"
```

---

### Phase R2 — CI 结构与引擎引导（1 天）

- [ ] **R2.1 引擎引导步骤（G2 主修）**

在 `release.yml` 的 `pnpm install --frozen-lockfile` **之后**插入（`vendor/qilin` 不在根 workspace，必须显式引导）：

```yaml
      - name: 引擎依赖与产物引导
        timeout-minutes: 30
        run: |
          scripts/qilin-pnpm.sh install --frozen-lockfile
          scripts/qilin-pnpm.sh run build
          scripts/qilin-pnpm.sh run verify-runtime-closure
```

**可选缓存**（构建耗时敏感时）：

```yaml
      - uses: actions/cache@<pin>
        with:
          path: |
            vendor/qilin/node_modules
            vendor/qilin/**/lib
          key: qilin-${{ runner.os }}-${{ hashFiles('upstream.lock.json', 'vendor/qilin/pnpm-lock.yaml') }}
```

> 缓存键必须含 `upstream.lock.json`（快照 commit）：引擎换版必失效。
> 首次不启用缓存，先证明链路可通。

**验收**：CI 上该步 exit 0，日志出现 `verify-runtime-closure: N agent presets …`。

- [ ] **R2.2 publish job 补 checkout（G1 主修）**

```yaml
  publish:
    needs: build
    runs-on: ubuntu-latest
    permissions: { contents: write }
    steps:
      - uses: actions/checkout@<pin>          # ← 修复：恢复仓内脚本与 release/<tag>.md
        with:
          ref: ${{ inputs.tag || github.ref }}
          sparse-checkout: release
      - uses: actions/download-artifact@<pin>
        with: { path: dist-release, merge-multiple: true }
      - run: ls -lh dist-release
      - run: bash scripts/publish_release_notes.sh "${INPUTS_TAG:-$GITHUB_REF_NAME}" release-notes.md
      - uses: softprops/action-gh-release@<pin>
        with:
          files: dist-release/**
          body_path: release-notes.md
```

> `sparse-checkout: release` 不够——`publish_release_notes.sh` 在 `scripts/` 下，**必须让 `scripts/` 也在工作区**：
> 要么去掉 sparse（全量 checkout，代价小），要么 `sparse-checkout: |\n  release\n  scripts`。
> **本计划的决定：去掉 sparse，直接全量 checkout**（该 job 只跑几十秒）。

- [ ] **R2.3 `workflow_dispatch` + tag 输入（G8）**

```yaml
on:
  push: { tags: ["v*"] }
  workflow_dispatch:
    inputs:
      tag:
        description: "要构建发布的 tag（如 v2.0.0，须已推送）"
        required: true
```

所有 `actions/checkout` 用 `ref: ${{ inputs.tag || github.ref }}`；publish 与 artifact 名同样按 tag 取值。

- [ ] **R2.4 runner 与工具链固定**

```diff
-        os: [ubuntu-latest, macos-latest, windows-latest]
+        # ubuntu-22.04：glibc 更老，deb 兼容性更好（KCoder 同款）
+        os: [ubuntu-22.04, macos-latest, windows-latest]
```

`pnpm/action-setup` 显式给 `version: 9.15.0`（与根 `package.json` 的 `packageManager` 一致，避免解析歧义）；
引擎侧仍由 `scripts/qilin-pnpm.sh` 用钉版 11.7.0。

- [ ] **R2.5 产物收集与并发**

保留现有扩展名收集；新增（可选）`concurrency`；确认 `if-no-files-found: error` 不变。

- [ ] **R2.6 刷新工作流里过期的注释与名称**

R1.5 把引擎产物从 `dist-exe/` 改成 `staging/` 闭包后，`release.yml:39-48` 的注释仍写
「build-engine-bundle.sh 读取 APPLE_SIGNING_IDENTITY 预签引擎 Mach-O 二进制（kstock-engine{,-rg,-spawn-helper}）」——
该形态已不存在。同步改为「build-runtime-bundle.sh 预签闭包内全部 Mach-O（含 LibreOffice 嵌套树）」，
并说明「仅 macOS 需要，且仅 macOS 注入凭据」。

- [ ] **R2.7 提交 R2**

```bash
git add .github/workflows/release.yml
git commit -m "fix(release): CI 补引擎引导与 publish checkout、支持 workflow_dispatch 补跑、runner 固定 ubuntu-22.04、注释对齐闭包形态"
```

---

### Phase R3 — 平台化签名与 fail-closed 公证（半天）

- [ ] **R3.1 `mac.notarize: true`（G5）**

```diff
 mac:
   category: public.app-category.finance
   icon: build/icon.icns
+  # 显式要求公证：缺 APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID
+  # 时构建直接失败，杜绝「凭据失效 → 静默发布未公证包 → 用户被 Gatekeeper 拦」。
+  notarize: true
```

**验收（红路径）**：本地 `env -u APPLE_ID -u APPLE_APP_SPECIFIC_PASSWORD -u APPLE_TEAM_ID \
  CSC_LINK=<p12> CSC_KEY_PASSWORD=… pnpm -C apps/desktop run electron:build` → 必须**构建失败**（而非产出包）。

- [ ] **R3.2 签名凭据平台化注入（G4 主修）**

把 `release.yml:38-54` 的共享 `env` 块拆成两步：

```yaml
      - name: 打包（macOS：签名 + 公证）
        if: runner.os == 'macOS'
        env:
          APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
          CSC_LINK: ${{ secrets.MAC_CERTIFICATE }}
          CSC_KEY_PASSWORD: ${{ secrets.MAC_CERTIFICATE_PWD }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        run: bash scripts/check-release.sh
      - name: 打包（Windows / Linux：不注入任何签名变量）
        if: runner.os != 'macOS'
        # 刻意不声明 env：曾把 macOS 证书全局注入所有平台，导致 Windows Setup exe
        # 被 Apple Developer ID 证书签名（Authenticode NotValid）→ electron-updater
        # 校验 Status!=0 拒绝更新，且 app-update.yml 被写入 mac 证书 CN 作
        # publisherName（双重失败）。KCoder 已踩过同一坑。
        run: bash scripts/check-release.sh
```

**验收（红路径）**：在非 macOS runner 打印 `env | grep -E 'CSC_|APPLE_'` → 必须为空（可在临时 PR 上验证后回滚）。

- [ ] **R3.3 签名 fallback 显式化（G5 补强）**

`scripts/build-desktop.sh` 的 `CSC_IDENTITY_AUTO_DISCOVERY=false` 条件由「`CSC_LINK` 未设」改为：

```bash
if [ "${KSTOCK_UNSIGNED_BUILD:-0}" = "1" ]; then
  export CSC_IDENTITY_AUTO_DISCOVERY=false
  echo "==> 未签名本地构建（显式 KSTOCK_UNSIGNED_BUILD=1）"
fi
```

**理由**：CI 上凭据缺失应当**失败**，而不是悄悄退化成未签名产物。本地文档同步改为
`KSTOCK_UNSIGNED_BUILD=1 bash scripts/build-desktop.sh`。

> 副作用提醒：`build-signed-macos.sh`（本地签名流水线）与 `KSTOCK_OFFLINE_BUILD` 路径需一并复核，
> 确保「本地签名构建」仍能通过（它是显式签名路径，不受此开关影响）。

- [ ] **R3.4（可选 P2）切 `CSC_KEYCHAIN` + `CSC_NAME`**

判据写进契约文档：出现「签名 step 通过但产物 adhoc」即切；切换时参考 `scripts/local/build-signed-macos.sh:109-118` 的现成实现。

- [ ] **R3.5 提交 R3**

---

### Phase R4 — 产物层门禁电池（1–2 天，G7 主修）

- [ ] **R4.1 新建 `scripts/verify-desktop-artifacts.sh`**

入参：产物目录（CI 传 `apps/desktop/release`）。断言 §4.4 的 V1–V6；**全部硬失败**（`exit 1`），
macOS 相关项在非 Darwin 上跳过并打印 `skip`。

关键实现要点（可直接复用现有脚本，避免重复造轮子）：

| 断言 | 复用/依赖 |
|---|---|
| V1/V2/V3/V6 | 纯文件系统断言（`find`/`test`），参照 `verify_package_resources.py` 已有的断言风格 |
| V4 | `ELECTRON_RUN_AS_NODE=1 "$ELECTRON_BIN" scripts/local/smoke-runtime-closure.cjs <解压目录>` + `--help` 冒烟（`build-runtime-bundle.sh:88-107` 已有同款，抽成函数复用） |
| V5 | `codesign -dv --verbose=4` + `grep`、`spctl -a -vv`、`xcrun stapler validate`（KCoder `release.yml:156-183` 同款三断言） |
| V7 | 解包 `resources/app-update.yml` 后 `grep publisherName`（纯文本断言，跨平台可跑） |

- [ ] **R4.2 本地与 CI 同源接线**

- `scripts/check-release.sh` 末尾追加 `bash scripts/verify-desktop-artifacts.sh apps/desktop/release`
- `release.yml` 在收集产物**之前**加一步 `run: bash scripts/verify-desktop-artifacts.sh apps/desktop/release`

> 借鉴点：KCoder 的 `brand-assert` / `materialize-peers` / `smoke-runtime` 三个脚本**本地与 CI 共用同一文件**，
> 只有 bundle 对账是两套实现（历史分叉）。本计划明确要求**同一文件两处调用**。

- [ ] **R4.3 红路径验证（四连红）**

```bash
# ① 缺 latest-mac.yml（重命名后跑）→ 必须红
# ② 把 runtime tarball 换成一个空 tar → V2/V4 必须红
# ③ 删掉 resources/engine/plugins/quant → V3 必须红
# ④ macOS：用 KSTOCK_UNSIGNED_BUILD=1 出一个未签名包 → V5 必须红（拒 adhoc）
# ⑤ 在非 macOS 产物里手工写入 publisherName: 'Bing Li (DHV5D72JNF)' → V7 必须红
bash scripts/verify-desktop-artifacts.sh apps/desktop/release; echo "exit=$?"
```

**验收**：五条红路径各自给出**指名道姓**的错误（不是笼统的 exit 1）。

- [ ] **R4.4 提交 R4**

---

### Phase R5 — 自动更新加固（半天）

- [ ] **R5.1 `quitAndInstall` 异常兜底（G10）**

**文件**：`apps/desktop/electron/lib/updater.ts:114-128`（`installUpdate()`）

现状（无任何异常兜底，失败即 unhandled）：

```ts
  setTimeout(() => {
    autoUpdater.quitAndInstall(false, true);
  }, 200);
```

改为（复用本文件已有的 `showBox()` 与 `checkForUpdatesInteractive()`，不引入新状态机）：

```ts
  setTimeout(() => {
    try {
      autoUpdater.quitAndInstall(false, true);
    } catch (error) {
      // quitAndInstall 失败（安装器缺失 / 文件被占用 / 权限不足）必须让用户看见，
      // 并保留重试路径；否则只剩一条 unhandled 异常，用户以为「点了没反应」。
      const message = error instanceof Error ? error.message : String(error);
      logMain(`[updater] quitAndInstall 失败：${message}`);
      void showBox(getMainWindow(), {
        type: "error",
        title: "安装更新失败",
        message: `安装更新失败：${message}`,
        detail: "可重试，或从 GitHub Releases 手动下载安装包。",
        buttons: ["重试", "知道了"],
        defaultId: 0,
        cancelId: 1,
      }).then((result) => {
        if (result.response === 0) void checkForUpdatesInteractive(getMainWindow() ?? undefined);
      });
    }
  }, 200);
```

- [ ] **R5.2 启动检查加延迟与打包态门（对齐 KCoder）**

```diff
-  if (app.isPackaged) {
-    autoUpdater.checkForUpdates().catch(() => {});
-  }
+  // 打包态才检查；延迟 8s 避开引擎冷启动的 IO 峰值；只做一次。
+  if (app.isPackaged) {
+    setTimeout(() => { autoUpdater.checkForUpdates().catch(() => {}); }, 8_000);
+  }
```

- [ ] **R5.3 feed 单一来源**

`updater.ts:186-190` 的硬编码 `owner/repo` 与 `electron-builder.yml:publish` 是**双源**。
二选一并在 R0.2 契约文档里登记：
（a）删除 `setFeedURL`，靠 builder 生成的 `app-update.yml`（需确认打包后该文件存在——V6 可顺带断言）；
（b）保留硬编码但在 `verify-desktop-artifacts.sh` 增加断言 `resources/app-update.yml` 的 owner/repo 与代码一致。

**建议（b）**：改动小、可断言，且保留「不依赖 builder 产物」的鲁棒性。

- [ ] **R5.4（可选 P2）预发布通道**

若 R6 的 `rc` 演练需要测试者自动升级：`autoUpdater.allowPrerelease = true`（仅在 `KSTOCK_UPDATE_CHANNEL=rc` 时）。
**默认不开**，写进契约文档。

- [ ] **R5.5 提交 R5**

---

### Phase R6 — 三平台演练与正式发布（1 天 + CI 时间）

- [ ] **R6.1 预发布演练（本计划最重要的验收）**

```bash
# 1) 先写发布说明并**单独提交**——build-release.sh 要求工作树干净（`git status --porcelain`
#    含未跟踪文件即 die），且 R1.3 的前置门会校验该文件存在；版本号提交由脚本自己完成。
cat > release/v2.0.0-rc.1.md <<'MD'
# KStock v2.0.0-rc.1 发布说明

> 状态：待发布 · Tag：`v2.0.0-rc.1`

## 本次演练目标

三平台发布链路端到端验证（不对外宣布）。
MD
git add release/v2.0.0-rc.1.md
git commit -m "docs(release): v2.0.0-rc.1 发布说明（发布链路演练）"

# 2) 一键发版：bump → 门禁 → commit → annotated tag → atomic push → watch → 资产校验
./build-release.sh v2.0.0-rc.1 --yes
```

> 版本号格式无需特殊处理：`normalize_version()`（`build-release.sh:158-164`）的正则
> `^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$` 接受 `-rc.1` 后缀。

**演练验收清单**（CI 侧逐条勾）：

| # | 检查 | 通过标准 |
|---|---|---|
| 1 | 三个 build job 全部绿 | `gh run view <id>` 无 failed job |
| 2 | 引擎引导步 | 日志含 `verify-runtime-closure: N agent presets` |
| 3 | 产物层门禁 | 三平台各出现 `verify-desktop-artifacts: OK` |
| 4 | macOS 签名与公证 | `codesign` 非 adhoc + `TeamIdentifier` 有值 + `stapler validate` 通过 |
| 5 | Windows 未被 mac 证书污染 | 由 R4 的 V7 断言给出（演练时核对 CI 日志出现该断言） |
| 6 | publish job | Release 创建成功，正文为 `release/v2.0.0-rc.1.md` 内容（非提交列表） |
| 7 | 资产完整性 | `verify_release_assets` 通过（dmg/zip/exe/deb/rpm + latest*.yml + blockmap 齐全，yml.url ∈ 资源名） |
| 8 | 单平台补跑 | 故意对某一平台 `gh run rerun --failed`，`workflow_dispatch` 也能独立补跑 |

**若有任一条红** → 走 §6.2「不可变 tag 处置 SOP」。

- [ ] **R6.2 自动更新真机验证**

本机装 `v2.0.0-rc.1` → 发 `v2.0.0-rc.2`（或直接 `v2.0.0`）→ 断言：
更新图标出现并悬停出更新内容 → 下载完成通知 → 退出时自动安装 → 重启后版本号更新（菜单/关于页）。

- [ ] **R6.3 正式发布 `v2.0.0`**

同 R6.1 流程（去掉 rc），发布说明写用户可读内容（新特性/修复/升级注意）。

- [ ] **R6.4 提交 R6 记录**

把演练结果、耗时、体积、公证耗时写进执行记录（供后续版本对比基线）。

---

### Phase R7 — 文档与约定（半天）

- [ ] **R7.1 重写 `docs/发布说明.md`**

清掉：`pyproject.toml`、PyInstaller `build-gateway-bundle.sh`、侧栏隐藏下载图标（2.0 已无 SPA）、「publish job 自动生成发布说明」。
补上：闭包形态、五道产物门、`workflow_dispatch` 补跑、`--allow-missing-notes`、`--resume/--delete-tag/--dry-run/--skip-lock/--no-fetch`、
`KSTOCK_UNSIGNED_BUILD`、secrets 清单与**平台化注入**说明、发布事故 SOP（不可变 tag）。

- [ ] **R7.2 `release/README.md` 补约定**

写明：说明文件前置（`build-release.sh` 硬门）、演练 tag 规范（`vX.Y.Z-rc.N`）、发布后补写正文的方法
（`bash scripts/publish_release_notes.sh <tag> /tmp/n.md && gh release edit <tag> --notes-file /tmp/n.md`）。

- [ ] **R7.3 提交 R7 并合并**

```bash
git checkout main && git merge --no-ff refit/release-pipeline
```

---

## 6. 风险与回滚

### 6.1 风险

| # | 风险 | 等级 | 缓解 |
|---|---|---|---|
| RR1 | **不可变 tag**：tag 一旦推送，其 workflow 即固定；发现 CI 自身缺陷后无法原地修 | 高 | R0.2 契约文档写明 SOP；`--delete-tag` 已可用；演练先用 `rc` |
| RR2 | 缓存导致引擎产物陈旧（换版后仍用旧 `lib/`） | 中 | 缓存键含 `upstream.lock.json`；首次不启用缓存；R2.1 验收要求看到 `verify-runtime-closure` 的真实输出 |
| RR3 | 闭包体积增长（引擎升级带来 `dsh-animations` +82MB、Office kit 0.1.0）导致公证耗时上升 | 中 | R6.1 记录 tar.gz 体积与公证耗时作为基线；超阈值再评估裁剪 office kit |
| RR4 | `notarize: true` 后凭据问题从「静默」变「阻塞」 | 中 | 这正是目的；提前在 R3.1 用红路径演练一次，并按 SOP 更新 secrets |
| RR5 | 非 macOS 不注入签名变量后，若将来补 Windows 签名会「以为已注入」 | 中 | 契约文档登记「Windows 签名 = 新增 `WIN_CSC_LINK` 的独立步」，与 mac 完全分开 |
| RR6 | `build-desktop.sh` 的 `KSTOCK_UNSIGNED_BUILD` 改动影响本地签名流水线 | 中 | R3.3 复核 `build-signed-macos.sh` 路径；两者语义不同（显式签名 vs 显式未签名） |
| RR7 | 发布门禁变严后，日常分支上的 `check-ci.sh` 也变慢 | 低 | 重门（打包 + 产物断言）只在 `check-release.sh` 与 CI release 步跑；`check-ci.sh` 保持轻量 |
| RR8 | Ubuntu 24→22.04 切换可能暴露旧 glibc 下的构建差异 | 低 | 先在 `workflow_dispatch` 上跑一次不发布演练 |

### 6.2 发布事故处置 SOP（写进契约文档）

```
1. 判断缺陷来源：
   a) 仓内脚本/配置缺陷（可在 main 修）→ 修完 delete-tag 重发；
   b) workflow 自身缺陷（push:tags 的 workflow 取自 tag commit）→ 必须先修 main，
      再 ./build-release.sh --delete-tag <tag> 重打 tag（新 tag 指向含修复的 commit）。
2. 处置命令：
   ./build-release.sh --delete-tag vX.Y.Z          # 删本地 + 远程 tag（脚本已支持）
   git checkout main && git pull && <修复并提交>
   ./build-release.sh vX.Y.Z --yes
3. 已发布版本的正文补写（无需重发）：
   bash scripts/publish_release_notes.sh vX.Y.Z /tmp/n.md
   gh release edit vX.Y.Z --notes-file /tmp/n.md
4. 撤回坏包：gh release delete-asset <tag> <name>，并同步删除 latest*.yml 中对应条目
   （或直接重发一个更高 patch 版本，靠 verify_release_assets 的 yml↔资源名交叉比对兜住）。
```

### 6.3 回滚

| 层 | 动作 |
|---|---|
| 代码 | 全部改动在 `refit/release-pipeline` 分支；`git checkout main` 即回退 |
| CI | workflow 改动随分支；已推 tag 不受影响（tag 固定自己的 workflow） |
| secrets | R3.2 只改注入范围，不改 secrets 本身，无需回滚 |
| 产物 | 坏包用 `gh release delete` + 重发；客户端的 electron-updater 不会自动降级，故**只能靠发更高版本号回滚** |

---

## 7. 验收清单

- [ ] R0：`docs/开发/发布契约.md` 落地；基线红灯已记录；工作树干净、分支已开
- [ ] R1：`--dry-run` 可跑；发布说明前置门红路径通过；`verify_package_resources.py --source-only` **exit 0**（2026-09-28 晚复核已达标，保留作防回归）；`extraResources` 回改即红；`check-release.sh` 在无 `staging/` 的干净副本可自建闭包
- [ ] R1：`build-runtime-bundle.sh` 非 Darwin 不再要求 `APPLE_SIGNING_IDENTITY`
- [ ] R2：CI 引擎引导步绿（日志有 `verify-runtime-closure`）；publish job 有 checkout；`workflow_dispatch` 可补跑单平台
- [ ] R3：`notarize: true`；缺凭据即构建失败（红路径）；非 macOS runner 的 `env | grep CSC_/APPLE_` 为空
- [ ] R4：`verify-desktop-artifacts.sh` 本地/CI 同源；四条红路径全部如期变红且指名报错
- [ ] R5：`quitAndInstall` 有异常兜底；启动检查延迟 8s + 仅打包态
- [ ] R6：`v2.0.0-rc.1` 三平台演练 8 项全过；自动更新真机验证通过；`v2.0.0` 正式发布成功
- [ ] R7：`docs/发布说明.md` 已重写、`release/README.md` 已补约定
- [ ] 发布后：`./build-release.sh --watch` 可复现地看到全绿；资产校验通过

---

## 8. 附录

### 8.1 KCoder ↔ KStock 逐条对照

| 机制 | KCoder | KStock 现状 | 本计划 |
|---|---|---|---|
| 触发面 | tag + `workflow_dispatch(tag)` + `ref` | 仅 tag | R2.3 |
| 矩阵 | ubuntu-22.04 / macos / windows，fail-fast:false | ubuntu-latest / macos / windows，fail-fast:false | R2.4 |
| 工具链钉版 | 显式 pnpm 11.7.0 + node 22 | node 24，pnpm 未显式 | R2.4（pnpm 9.15.0 与 packageManager 对齐；引擎走 wrapper） |
| 上游/引擎引导 | CI 现场克隆 + 三阶段构建（含 HTTPS 改写、基线祖先校验） | **无** | R2.1（KStock 用快照，不需克隆，需 install+build） |
| 签名注入 | mac-only | 三平台全量 | R3.2 |
| 公证 | `notarize: true`（fail-closed） | 隐式（凭据存在才公证） | R3.1 |
| 产物名 | 三端固定去空格 | mac 默认、win 已固定、linux 默认 | 保留（均无空格）+ 契约登记 |
| 产物门 | 5 道（运行时冒烟/随包对账/签名公证/品牌/更新元数据） | 0 道（仅发布后 `verify_release_assets`） | R4（6 项 V1–V6） |
| publish | checkout sparse + 正文取 `release/<tag>.md` | **无 checkout** + 正文取仓内脚本 | R2.2 |
| 发布说明前置 | `ship` 强制 | 无 | R1.3 |
| 本地/CI 同源 | 3 个脚本共用（bundle 对账已分叉） | 闭包流水线**完全不进 CI** | R4.2 |
| 更新 UX | 4 入口 + 8s 延迟 + try/catch | 通知 + 菜单 + 对话框（无延迟、无 try/catch） | R5.1/R5.2 |
| 更新通道 | 无（allowPrerelease 未开） | 无 | R5.4（可选） |
| 发布后资产校验 | 无（仅 bundle 版本线） | **有**（`verify_release_assets`，比 KCoder 强） | 保留 + 在契约文档中登记为第 5 道门的「发布后版」 |

### 8.2 证据复现命令

```bash
# F1：publish job 无 checkout
sed -n '76,94p' /Users/libing/kk_Projects/KStock/.github/workflows/release.yml
grep -c "actions/checkout" /Users/libing/kk_Projects/KCoder/.github/workflows/release.yml   # 2（build + publish）
git -C /Users/libing/kk_Projects/KStock log --oneline --follow -- .github/workflows/release.yml | head
git -C /Users/libing/kk_Projects/KStock show 73f6c87a -- .github/workflows/release.yml      # 只加调用不加 checkout
git -C /Users/libing/kk_Projects/KStock for-each-ref --sort=-creatordate --format='%(refname:short) %(creatordate:iso)' refs/tags | head -3

# F2：CI 无引擎引导
grep -n "qilin-pnpm\|vendor/qilin" /Users/libing/kk_Projects/KStock/.github/workflows/*.yml   # 无命中
cat /Users/libing/kk_Projects/KStock/pnpm-workspace.yaml                                       # 只有 apps/* kstock/*
sed -n '74,78p' /Users/libing/kk_Projects/KStock/scripts/build-engine-bundle.sh

# F3：契约缺口变形（2026-09-28 晚修订；原「verify 实测红」已随引擎升级消解）
cd /Users/libing/kk_Projects/KStock && scripts/python.sh scripts/verify_package_resources.py --source-only; echo "exit=$?"   # exit=0
grep -n "dist-exe\|build-engine-bundle" scripts/check-ci.sh scripts/build-desktop.sh scripts/check-release.sh | head

# F4/F5：签名与公证
sed -n '36,55p' /Users/libing/kk_Projects/KStock/.github/workflows/release.yml
grep -n "notarize" /Users/libing/kk_Projects/KStock/apps/desktop/electron-builder.yml /Users/libing/kk_Projects/KCoder/electron-builder.yml

# F6：本地入口 1.x 遗留
grep -n "pyproject.toml\|uv.lock\|need_cmd uv" /Users/libing/kk_Projects/KStock/build-release.sh
git -C /Users/libing/kk_Projects/KStock ls-files | grep -E "^pyproject.toml|^uv.lock" ; echo "(空=不存在)"
python3 -c "from pathlib import Path; Path('pyproject.toml').read_text()"   # FileNotFoundError

# G11：闭包脚本无平台守卫
sed -n '105,120p' /Users/libing/kk_Projects/KStock/scripts/build-runtime-bundle.sh

# 更新层
grep -n "quitAndInstall\|setTimeout\|checkForUpdates()\|setFeedURL" /Users/libing/kk_Projects/KStock/apps/desktop/electron/lib/updater.ts
grep -n "quitAndInstall" -B 4 -A 6 /Users/libing/kk_Projects/KCoder/desktop/main/updater.ts
```

**本次分析的边界**：全程只读（`git show/log`、`grep`、`sed`、`gh release view` 只读查询；
一次 `verify_package_resources.py --source-only` 纯校验运行）。未运行任何发布/打包/签名脚本，
未改动任何文件（唯一新增文件即本计划）。
`gh release view --repo ""` 的回落行为已实测（返回 `{"tagName":"v1.1.0"}`），
故 `REPO_SLUG` 未 export 属**脆弱但当前可用**，按 R1.2 显式修掉。

---

## 9. 执行记录

### R0 — 契约冻结与基线（2026-09-28 晚执行完毕）

**R0.1 基线证据**：

```bash
$ scripts/python.sh scripts/verify_package_resources.py --source-only; echo "exit=$?"
exit=0    # 原「extraResources 实测红」已随引擎升级消解

$ grep -n "dist-exe\|build-engine-bundle\|build-runtime-bundle" scripts/check-ci.sh \
    scripts/build-desktop.sh scripts/check-release.sh scripts/verify_package_resources.py \
    apps/desktop/electron-builder.yml
scripts/check-ci.sh:43:if [ -f dist-exe/kstock-engine ]; then
scripts/check-ci.sh:44:  dist-exe/kstock-engine --help > /dev/null
scripts/build-desktop.sh:6:# 前置条件：dist-exe/ 已由 scripts/build-engine-bundle.sh 构建完成
scripts/build-desktop.sh:15:ENGINE_BUNDLE="$(cd "$(dirname "$0")/.." && pwd)/dist-exe/kstock-engine"
scripts/build-desktop.sh:18:  echo "请先执行 scripts/build-engine-bundle.sh 构建引擎分发束。" >&2
scripts/check-release.sh:9:bash scripts/build-engine-bundle.sh
scripts/verify_package_resources.py:7:The default product mode validates the built ``dist-exe/`` directory before
scripts/verify_package_resources.py:93:        self.require_path(root / "scripts" / "build-engine-bundle.sh", "source engine bundle script")
scripts/verify_package_resources.py:214:            # 3.0.5 起打包走运行时闭包（staging 三件套），旧 SEA dist-exe 映射已废。
scripts/verify_package_resources.py:285:        """闭包形态产物（3.0.5 起 staging 三件套；旧 SEA dist-exe 已废，A1 决策）。"""
apps/desktop/electron-builder.yml:33:# 内置引擎分发束（scripts/build-runtime-bundle.sh 产物）：
apps/desktop/electron-builder.yml:65:  # 引擎 Mach-O 的预签由 build-engine-bundle.sh 负责（APPLE_SIGNING_IDENTITY）。
```

**结论**：verify 已绿（F3 原证据过期）；缺口变形清单 = `check-release.sh:9`（旧 SEA 构建）、
`build-desktop.sh:6,15,18`（dist-exe 断言）、`check-ci.sh:43-44`（dist-exe 冒烟）、
`verify_package_resources.py:7`（docstring）、`verify:93`（仍必查旧脚本，进契约裁决）、
`electron-builder.yml:65`（注释仍写旧预签主体）——后两条为本次复核新发现，已并入 R1.5 清单。

**R0.2 产出**：`docs/开发/发布契约.md`——单一事实源表（§1）、V1–V7 门禁矩阵（§2）、
secrets 清单与注入范围（§3）、不可变 tag SOP（§4）、决策登记（§5，含
`build-engine-bundle.sh` 裁决与 feed 单一来源等 8 条）。

**R0.3 回滚锚点**：`e6547774`（分支 `refit/release-pipeline` 自 main 该点开出；
远端 `origin/main` = `d1eef9f7` 为其祖先，本地领先 21 提交未推送，pull 无内容）。
暂存纪律：按路径 `git add`，禁用 `git add -A`。

### R1 — 本地链路修复（2026-09-28 晚执行完毕）

**改动**：R1.1 去 `pyproject.toml`/`uv.lock`/`need_cmd uv`/`uv lock`；R1.2 `export REPO_SLUG`；
R1.3 发布说明前置门 + `--allow-missing-notes`（门在 dry-run 退出后、confirm 前）；
R1.5 `check-release.sh` 切 `build-runtime-bundle.sh`、`build-desktop.sh` 断言改 staging 三件套、
`check-ci.sh` dist-exe 冒烟改闭包结构断言（重门留发布链，契约 RR7）、`presign-engine-macos.sh`
默认目录/注释切闭包、`verify_package_resources.py` docstring 更新 + 必查清单裁决
（`build-engine-bundle.sh` 退出、`build-runtime-bundle.sh` 进入）、`electron-builder.yml:65`
预签主体注释同步；R1.6 预签分支加 `uname` 守卫（非 Darwin 不碰预签脚本）+ 发布门
fail-closed（macOS 无身份 die）；R1.4 修 `docs/发布说明.md` 两处失实表述。

**验收（红绿实录）**：
- `bash -n` 六脚本全过；`./build-release.sh v9.9.9 --dry-run --force --no-fetch --branch refit/release-pipeline`
  exit=0、打印完整计划（`Repo: kkutysllb/KStock` 佐证 R1.2）、无文件改动、无 v9.9.9 tag；
- R1.3 红：无 `release/v9.9.9.md` → exit=1 +「缺发布说明」提示；绿：有说明 → 过门到
  confirm 中止（非 TTY），输出无「缺发布说明」；`--allow-missing-notes` 旁路可用；
- R1.5 红：`extraResources` 回改 `../../dist-exe` → `[FAIL] source electron-builder extraResources`
  exit=1；还原复绿 exit=0；
- R1.6②：`env -u APPLE_SIGNING_IDENTITY bash scripts/check-release.sh` → 发布门 die ✓；
  ① 本地无身份 `build-runtime-bundle.sh` 可跑（当日两次端到端 exit 0 佐证）；③ 非 Darwin
  分支由 `uname` 守卫隔开（bash -n + 分支结构核对）；
- `bash scripts/check-ci.sh` 全量回归（见提交前输出）。

**偏差记录**：check-ci 的冒烟改为「闭包入口在位」结构断言而非计划原文的 Electron node
`--help`——完整冒烟已内建于 `build-runtime-bundle.sh`，重门只进发布链（RR7），避免轻量门变重。

### R2 + R3 — CI 结构、引擎引导与平台化签名（2026-09-28 晚执行完毕）

> R2.6 的注释口径（「仅 macOS 注入凭据」）以 R3.2 为前提，两者落在同一构建步上，
> 合并执行避免 workflow 出现自相矛盾的中间态。

**改动**：R2.1 引擎引导步（`qilin-pnpm install/build/verify-runtime-closure`，30min 上限）；
R2.2 publish job 补 `actions/checkout`（G1 致命项，按计划决定全量 checkout 不用 sparse）+
正文取 `${INPUTS_TAG:-$GITHUB_REF_NAME}` 兼容 dispatch 补跑；R2.3 `workflow_dispatch(tag)` +
所有 checkout `ref: inputs.tag || github.ref` + `concurrency: release-<tag>` 串行防覆盖；
R2.4 runner 固定 `ubuntu-22.04`；R2.6 注释按闭包预签主体重写；R3.1 `mac.notarize: true`
（fail-closed）+ `electron-builder.local.yml` 补 `mac.notarize: false`；R3.2 签名凭据拆入
macOS-only 步（`if: runner.os == 'macOS'` / `!= 'macOS'` 两步，非 mac 步零 env）；
R3.3 签名 fallback 显式化（`KSTOCK_UNSIGNED_BUILD=1`），未签名构建自动切 local 配置。

**执行中修正的两处计划偏差**：
1. R2.4 原文「pnpm/action-setup 显式给 `version: 9.15.0`」**不可行**——根
   `package.json` 已有 `packageManager: pnpm@9.15.0`，双指定会报
   "Multiple versions of pnpm specified"。钉版留在 `packageManager` 单一来源，
   action 不带 version 输入；
2. R3.1/R3.3 交互：`notarize: true` 会让未签名本地构建无法通过主配置 →
   `KSTOCK_UNSIGNED_BUILD=1`（及 `KSTOCK_OFFLINE_BUILD=1`）切 `electron-builder.local.yml`
   （`notarize: false`），与 `build-signed-macos.sh` 的手动 notarytool 流水线
   （坑 4：不用 electron-builder 内置公证）兼容。

**验收**：js-yaml 解析三份 YAML 全过；workflow 结构断言 11/11（checkout×2、dispatch+tag、
引擎引导、ubuntu-22.04、pnpm 单一来源、secrets 仅 macOS 步、非 mac 步零 env、publish
checkout+body_path、concurrency、notarize 双配置）；`bash -n build-desktop.sh`。

**R3.1 红路径实跑记录（暴露重大发现，红路径文化的价值实证）**：无凭据直跑
electron-builder（主配置、keychain 自动发现签名），日志
`skipped macOS notarization reason=\`notarize\` options were unable to be generated`
后**照常出包 dmg/zip 并 exit 0**——`notarize: true` 对 electron-builder 26.15.3
**不构成 fail-closed**，R3.1 原始假设不成立。处置：fail-closed 落到自有发布门
（`check-release.sh` 与 `build-desktop.sh` 均查 macOS 发布配置的凭据齐备，任一缺失
即门前失败），`notarize: true` 保留（凭据齐备时正常公证），产物层 V5（R4）作事后
兜底；契约 §3 规则 2 已同步为双防线口径。红路径复跑：无凭据 `bash scripts/build-desktop.sh`
秒级 die（缺 APPLE_ID 指名报错）。

### R4 — 产物层门禁电池（2026-09-28 晚执行完毕）

**改动**：新建 `scripts/verify-desktop-artifacts.sh`（V1–V7 全硬门，逐项收集 + 指名报错，
macOS 项非 Darwin 打印 skip；断言对象自动识别 *.app / win-unpacked / linux-unpacked）。
V1 包内闭包在位；V2 闭包结构（tar 流式列目录断言入口 + dsh-animations 两件）；
V3 随包对账（staging ↔ 包内 engine/plugins、engine/presets 双向逐项）；V4 Electron-node
冒烟（ABI + 包内入口 --help，真机解释器路径）；V5 签名公证（拒 adhoc、TeamIdentifier、
spctl、stapler validate）；V6 更新元数据齐全 + url/path ∈ 资源名；V7 publisherName
平台边界（非 macOS 不得带、macOS 须等于本机证书 CN）。
R4.2 同源接线：`check-release.sh` 末尾 + `release.yml` 收集产物前，同一文件两处调用。

**脚本自纠（基线跑抓到三个自身 bug，红路径文化的连带收益）**：① `pipefail + grep -q`
管道早收口 → printf 吃 SIGPIPE → V2 假红，改 here-string；② BSD sed 不认 `\s` → V6 url
解析带前导空格假红，改 `[[:space:]]`；③ 无证书时 V7 假绿，改「读不到证书 CN 即红」。

**红路径实录（五条全中，各自指名道姓）**：
- ① 缺 `latest-mac.yml` → `V6 缺更新元数据 latest-mac.yml`；
- ② 闭包换空 tar → `V2 闭包 tar 无法列出` + `V4 ABI 冒烟未通过` + `V4 入口 --help 未通过`；
- ③ 删 `engine/plugins/quant` → `V3 包内缺 engine/plugins/quant（仓库有、包里无）`；
- ④ 真包（keychain 签名、未公证）→ `V5 spctl 评估未通过` + `V5 公证票据未随包`；
- ⑤ Windows 产物写入 `publisherName` → `V7 非 macOS 产物的 app-update.yml 不得带
  publisherName（mac 证书污染）`。
基线绿项：V1/V2/V3/V4/V6 全绿（真闭包 symlink 夹具 + 13 plugins / 8 presets 对账过）。
V5/V7 的「全绿」需真实签名 + 公证产物，留待 R6 演练（本地 keychain 构建无公证票据、
无 publisherName，红属预期）。

### R5 — 自动更新加固（2026-09-28 晚执行完毕）

**改动**：R5.1 `installUpdate` 的 `quitAndInstall` 加 try/catch——失败弹错误框并保留
「重试」入口（复用 `showBox` + `checkForUpdatesInteractive`，不引入新状态机）；
R5.2 启动检查改「打包态 + 延迟 8s + 单次」，避开引擎冷启动 IO 峰值；
R5.3 feed 单一来源按契约决策 (b) 落地——保留 `setFeedURL` 硬编码，新增门禁
**V8**：`app-update.yml` 的 `owner/repo` 必须与 `updater.ts` 硬编码一致（契约 §2 已
登记 V8 行）。R5.4 预发布通道按契约默认不开，仅登记不动代码。

**验收**：`tsc -p electron/tsconfig.json --noEmit` 过；`bash -n` 过；V8 红绿双证——
真包 `app-update.yml` 一致绿（kkutysllb/KStock），夹具篡改 owner 即红
（`feed 双源不一致：app-update.yml(wrong-owner/KStock) ≠ updater.ts(kkutysllb/KStock)`）。
`quitAndInstall` 兜底为异常路径，静态实现 + 类型检查为证，真实失败演练归入 R6.2
自动更新真机验证。

### R6.1 演练实录（v2.0.0-rc.1，2026-09-28 晚，两轮红路径）

**第 1 轮**（tag `f6256e9e`，run 36410408679）：本地段全过；CI 三平台红，三种 CI 环境差异：
① mac（bash 3.2）`$VAR` 后跟中文标点并进变量名（`qilin-pnpm.sh:19 $PNPM_CJS，`）→ 全链 22 处
花括号化；② win 版本注入 `require('$REPO_ROOT/…')` POSIX 路径喂 Windows node → cd + 相对
require；③ ubuntu **electron@44 已无 scripts 字段**（无 postinstall）→ 定位前幂等补跑
`install.js`。另有本地门禁裸 `python` 遗留（run_checks）→ 切 `scripts/python.sh`。
按 SOP：修 main → `--delete-tag` → 重打同名 tag。

**第 2 轮**（tag `57e5cf02`，run 36419660420）：引擎引导三平台全过（上轮三修生效）；打包段
再红，三种更深层问题：
① mac `预签闭包 Mach-O → no identity found`——CI 证书从未进钥匙串（CSC_LINK 只给
electron-builder 且其临时钥匙串分支有坑 3）→ 新增 `scripts/ensure-macos-keychain.sh`
（导入 p12 专用钥匙串 + 导出 `CSC_KEYCHAIN`/`CSC_NAME`，workflow 弃 CSC_LINK）；
② win `kstock/quant` 测试 `after()` 删临时库 EPERM——`DatabaseSync` 句柄未关 →
`LibraryStore`/`ReportsStore` 补 `close()`，测试关句柄后再删，新增句柄释放回归用例；
③ ubuntu `No SKILL.md under any preset`——`kstock/presets/*/skills/` 是 gitignore
生成物（由 `patch_vendor_skills.py` 从 `vendor/skills/public` 镜像发布），CI 链路从未跑
→ `build-runtime-bundle.sh` 补该步（幂等）。
验收：quant 测试 4/4（含 close 回归）、tsc 0 错、product verify exit 0、keychain 脚本
source 冒烟（本地身份可见走跳过分支、CSC_LINK 保持 unset）、YAML 解析过、
`$VAR`+多字节残留 0、技能发布步幂等绿。

**第 3 轮**（tag `18979453`，run 36423374348）：**ubuntu 10m31s 全绿、windows 11m56s 全绿**
（引擎引导 / 打包 / V1–V8 产物门禁 / 收集全部通过）；mac 只剩一处——钥匙串导入与闭包预签
均已通过，electron-builder 三连败于 `Please remove prefix "Developer ID Application:" from
the specified name`——`CSC_NAME` 要短名（`build-signed-macos.sh` 的 `CSC_NAME=KS_SIGN_IDENTITY`
即短名口径，本次直接取 APPLE_SIGNING_IDENTITY 踩了前缀坑）→ 导出前剥前缀。

**第 4 轮**（tag `7b20b46c` + lib 产物 `c6fec549`，run 36425780559）：ubuntu/win 连续第二轮
全绿；mac **签名 + 公证成功**（`notarization successful`，V5 非 adhoc + TeamIdentifier +
spctl + stapler 过，V1–V6/V8 全绿）。唯一红是 V7 门禁自身语义过严——mac 包的
app-update.yml 本就不写 publisherName（NSIS 侧字段），「缺字段」非事故、「写错 CN」才是
（KCoder 事故形态）→ 语义校准为「缺省合规、出现须 = 证书 CN」。本轮起跑前另补交
kstock/quant/lib 产物（入库构建产物随源码，close() 提交漏带——脏树被发布门正确拦截）。

**第 5 轮 —— 全链打通（tag `424e8abd`，run 36428923164，2026-09-28 晚）**：
四 job 全绿——ubuntu 11m29s、windows 11m26s、macos 17m12s（含签名 + 公证）、
publish 2m06s。GitHub Release **v2.0.0-rc.1** 创建成功，11 资产（mac zip/dmg +
blockmap×2、nsis exe + blockmap、deb、rpm、latest-mac.yml / latest.yml /
latest-linux.yml），正文取 `release/v2.0.0-rc.1.md`，`verify_release_assets`
yml↔资源名交叉比对通过。

**R6.1 八项验收**：① 三 build job 全绿 ✅；② 引擎引导步日志含 verify-runtime-closure ✅；
③ 三平台 `verify-desktop-artifacts: OK`（各出现于 check-release 尾步与工作流独立门禁步）✅；
④ mac 非 adhoc + TeamIdentifier + spctl + stapler validate ✅（V5 实测）；⑤ Windows 产物
无 publisherName 污染 ✅（V7-win 实测）；⑥ Release 正文 = 发布说明文件 ✅；⑦ 资产完整性 ✅
（verify_release_assets 过 + 11 资产清点）；⑧ 单平台补跑 —— `gh run rerun --failed` 为
GitHub 原生能力，`workflow_dispatch(tag)` 路径已结构性就绪（ref 适配已核对），真实补跑演练
留待下一次单平台失败或 v2.0.0 前 dispatch 冒烟 ⏳。

**五轮红路径总战果（九处全修死）**：bash 3.2 `$VAR`+中文并名、win POSIX 路径 require、
electron@44 无 postinstall、run_checks 裸 python、CI 证书不进钥匙串、CSC_NAME 前缀、
quant SQLite 句柄不关、preset 技能不发布、V7 语义过严。
