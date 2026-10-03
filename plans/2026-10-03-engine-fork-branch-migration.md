# 引擎消费形态迁移：源码快照 → fork 分支克隆

日期：2026-10-03
状态：已实施（KStock 侧待提交；QiLin 分支 `kstock/3.0.7` 本地已建、**未推送**）

## 起因

KCoder 与 dsh 的形态（不 vendor 上游源码、以 fork 分支 + 基线断言锚定、升级
走换基座重放）已被验证有效。KStock 对 QiLin 引擎的定制同样很小，却仍以
「整树快照入库 + Python 补丁重放」消费，成本与风险都在快照本身：

| 旧形态的问题 | 证据 |
|---|---|
| 体积与噪音 | `vendor/qilin` 9423 文件 / 86.8 MB 入库，占本仓 tracked 文件的 **92%**（10267 → 844） |
| 内容与提交无对应 | 快照取自上游**工作树**（非提交），且连带拷进 `.coverage-times.json`、`tmp/`、`website/.dist`、`snapshots/**/session.v4.jsonl`、`native/**/bin` 等本地残留 |
| 定制靠重放，丢了不响 | 补丁 14/15/21/22 历史上都丢过或差点丢掉，且丢法全是静默的 |
| 同步即重建 | `--sync-qilin` 整树 rmtree+copytree，之后必须重装依赖重构建 |

## 决策（用户确认）

1. **克隆落点**：仍在 `vendor/qilin`，但整目录 gitignore——版本库里 `vendor/`
   只剩 `skills`，而 30+ 处脚本相对路径、`client-brand` 的 8 条 tsconfig
   `paths` 映射、壳侧 dev 回退路径全部零改动。
2. **分支形态**：单条集成分支 `kstock/3.0.7`（= `v3.0.7` + 7 个提交），
   对齐 KCoder 的 `<product>/<baseline>`；升级时换基座重放。
3. **推送时机**：本地建好并自检通过后停下等确认，不自动推 GitHub。

## 迁移前的事实核查（`v3.0.7` 纯净导出 vs 快照，全树 diff）

差集恰好 **7 个文件**（+105/−9 行），其余全部是被 sync 排除或上游未跟踪的残留：

| # | 文件 | 补丁 |
|---|---|---|
| K01 | `scripts/build-exe-for-python-sdk.ts` | `repairStagedScope`（legacy deploy 漏带 workspace scope 包） |
| K02 | `scripts/install-lefthook.mjs` | 生产安装容忍缺 lefthook |
| K03 | `scripts/verify-runtime-closure.ts` | preset glob 纳入 `../../kstock/presets` |
| K04 | `scripts/client-build-environment.ts` | `KSTOCK_CLIENT_VERSION` 覆盖口 |
| K05 | `packages/client/ui-chat/src/client/apply.ts` | 外链经 `/kstock-api/frame-check` 预检 |
| K06 | `packages/client/ui-settings-general/src/client/SettingsRoot.tsx` | 五分区导航图标 |
| K07 | `packages/client/ui-sidebar/src/client/SidebarRoot.module.css` | 品牌行/红绿灯拆行 |

基线可用 tag 表达：`f91c39f6` 即 annotated tag `v3.0.7` 指向的提交。

## 实施

### QiLin 侧（`kstock/3.0.7`）

- 以 `v3.0.7^{commit}` 为父，7 个文件 7 个提交（每个提交带症状/根因/修法）。
- 落点：`vendor/qilin` 就地转为真克隆（工作树内容已等于分支内容，
  零重建成本；`git read-tree` 铺索引后逐个提交，随后 `git checkout -- .`
  补齐快照曾排除的 `.agents/ benchmarks/ plans/`，得到**干净检出**）。
- 提交序列：`f3f928957e`（分支 tip）← `37433ee000` ← `03b8749800` ←
  `e24bf593b6` ← `7bba2feef1` ← `7ee2096faf` ← `0274222415` ← `f91c39f643`(v3.0.7)
- 远端：`origin` = `https://github.com/kkutysllb/QiLin.git`，
  `qilin-dev` = `/Users/libing/kk_Projects/QiLin`（本机只读源，沙箱外）。

### KStock 侧

| 动作 | 落点 |
|---|---|
| lock 升级为唯一事实源（repo/branch/commit/base_tag/base_commit/version/patches[]/product_commits） | `upstream.lock.json` |
| 新增引导入口（克隆/更新/落锁定提交/校验/可选 install+build+verify） | `scripts/engine-bootstrap.sh` |
| 新增契约层（7 类断言，KStock 的 dsh-contract/BASELINE 等价物） | `scripts/verify_engine_contract.py` |
| 新增离线重放物与目录说明 | `upstream/patches/kstock-3.0.7.patch`、`upstream/README.md` |
| 快照文件退库 + 整目录忽略 | `git rm -r --cached vendor/qilin`、`.gitignore` |
| 删除引擎补丁重放器 | `scripts/patch_vendor_engine.py`（7 处定制已固化分支） |
| 技能补丁器剥离引擎段（−338 行） | `scripts/patch_vendor_skills.py`（只留 `vendor/skills`） |
| 构建链改为契约优先 | `build-engine-bundle.sh`、`build-runtime-bundle.sh` 第一步 `engine-bootstrap.sh --check-only` |
| 引擎命令守卫 | `scripts/qilin-pnpm.sh` 断言 `HEAD == lock.commit`（逃生口 `KSTOCK_ENGINE_ALLOW_DIRTY=1`） |
| sync 脚本按对象分形态 | `scripts/sync_upstreams.py`（引擎转发 bootstrap；技能仍是快照 + 重放） |
| CI 显式引导 | `ci.yml`（克隆 + 校验）、`release.yml`（`--full`） |
| 文档 | 新增 `docs/引擎分支工作流.md`；重写 `docs/上游同步.md`；README 快速开始与命令表 |
| 开发态提示语 | `apps/desktop/electron/lib/engine.ts`（指向 `engine-bootstrap.sh`） |

## 验证证据

| 检查 | 结果 |
|---|---|
| 契约校验（真实克隆） | 13 项断言全绿、0 告警 |
| 契约校验（`.build/fresh-clone` 干净克隆，等价 CI 的 `git clone --branch`） | 13 项全绿 |
| 负路径 A：抹掉 K03 标记 | exit 1，`✗ K03 补丁标记丢失…` |
| 负路径 B：HEAD 漂移到 v3.0.9 | exit 1，9 项失败（HEAD/提交数/7 提交不在历史） |
| 负路径 C：`qilin-pnpm.sh` 守卫 | exit 1 + 可操作提示；`ALLOW_DIRTY=1` 逃生口可用 |
| 补丁序列导出 | `git format-patch` 7 条、19.5 KB |
| 分支内容等价性 | 分支 `git diff --stat v3.0.7` = 7 文件 +105/−9，与迁移前 diff 逐字一致 |
| CI 门禁 | `bash scripts/check-ci.sh` exit 0（201 项：源契约、引擎面标记、技能包、图标；见 `.build/check-ci.log`） |
| 端到端仿真 | 从本提交做干净检出（849 文件 / 57 MB，`vendor/` 只剩 `skills`）→ `engine-bootstrap.sh` 克隆分支 → 契约 13 项全绿；克隆被 `.gitignore` 正确忽略 |

## 剩余动作（需人工确认）

1. 推分支：`git -C vendor/qilin push origin kstock/3.0.7`——推之前 CI 的
   引擎克隆步骤必红（分支不在远端），这是预期过渡态；离线路径见
   `upstream/README.md`。
2. 提交 KStock 侧改动（9423 个快照文件退库 + 14 个文件改造 + 4 个新增）。
3. 可选：把 `qilin-dev` 远端留在克隆里作为离线条线；CI 只认 `origin`。

## 回滚

- KStock：`git reset --hard HEAD`（本次改动未提交前）或回退该提交；
  `vendor/qilin` 工作树与构建产物不受影响（`.git` 与树都在原地）。
- QiLin：`git -C vendor/qilin branch -D kstock/3.0.7` + 删远端分支。

## 后续可做（不在本次范围）

- 引擎升到 3.0.9（上游已有 tag）：换基座 + 重放 7 提交，流程已写进
  `docs/引擎分支工作流.md`。
- `verify_engine_contract.py --strict-clean` 进发布链（把「就地改源码」
  从告警升级为失败）。
- 若某处引擎定制对 LingShu 等其它产品也成立，可拆成共享的
  `fix/*` 分支（仓内已有 `lingshu/000N-*` 先例），两产品各自 merge。
