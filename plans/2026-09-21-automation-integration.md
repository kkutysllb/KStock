# dsh-kylin-automation 内置集成实施方案

> 状态：已批准（用户确认「内置」路线与 1+2+3 步骤）
> 日期：2026-09-21
> 上游来源：`dsh-kylin-automation@0.1.2`（MIT，KCoder harness 已装验证版）
> 执行分支：`feat/automation-builtin` → 验证后 ff 合并 `main`

## 1. 背景与决策

定时任务是 KStock 的**核心刚需**而非可选扩展：每日盘后选股入库（选股库 run）、周期性因子检验、定时缠论分析、报告沉淀，全部是「定时 → 全新会话 → agent 调 quant 工具 → POST /kstock-api/* 归档四库」的形态。

dsh-kylin-automation 是 Cordis Host 插件（DSH/QiLin 同内核），机制五层：

| 层 | 实现 | 产品默认 |
|---|---|---|
| 调度钟 | once / everyMinutes(≥5) / daily / weekly（IANA 时区）；misfire 补跑宽限 | 15min |
| 执行器 | 每次运行全新根 Agent 会话（`kauto-session-` 前缀，零上下文继承） | 并发 2 / 单 run 60min |
| 持久化 | storageDomain 落盘：任务定义 + 终态运行历史 | 200 条（queued/running 永不裁剪） |
| 安全 | 权限二态 read-only / workspace-write；变更类工具人工审批（仅 pause 豁免）；管理工具不进 run 会话 | 随产品 |
| 入口 | Agent 工具 6 枚 + Web 侧边栏「定时任务」管理页 | 双入口保留 |

**决策：内置，不做用户自装。** 论证：① KStock 为封闭产品形态（注册关闭/固定角色集），上游 3.0.5 已删除 plugin-manager 与 user-plugins，用户自装无承载面；② 受众为投研人员而非开发者，自装=版本错配+安全不可控+支持灾难；③ 引擎快照已含全部被注入的宿主服务（`vendor/qilin/packages/storage/storage-domain` 等已核实），兼容无硬伤；④ 调度能力与四库天然闭环，是产品差异化价值。

## 2. 集成设计

### 2.1 包形态（对齐 accounts-local 先例）

- 目录：`kstock/automation/`，包名 **`@kstock/automation`**（version 2.0.0 对齐产品，private）
- 内容：`src/`（原样）、`scripts/build.mjs`（原样，`PACKAGE_ID` 改 `'@kstock/automation'`）、`tests/`（原样，stub 驱动）、`tsconfig.json`、`README.md`、`LICENSE`、`lib/`（构建产物，入库——KStock 惯例）
- **不带**：上游 `cordis.patch.yml`（产品名单行替代之，防双挂载）、`dsh.bundle` 字段、`node_modules`、`plans/`、`release/`、上游发布脚本（create-github-releases / sync-to-dsh-plugins / smoke-plugin）
- `dsh.client` 字段保留（web 平台 inject 列表驱动侧边栏页面）
- `@deepseek-ai/cordis` 仅有 type-only 引用（运行时被擦除，lib 零依赖内核包）——typecheck 经 tsconfig `paths` 别名到 `vendor/qilin/vendor/cordis`
- 构建：`node scripts/build.mjs`（esbuild：宿主 ESM bundle external `@deepseek-ai/*`+`cordis`、luxon/zod 内联；client CJS 带 `window.__ModuleLoader__.load({ id: '@kstock/automation' })` 幽灵头，react 走内核静态模块表）——与 KStock client 打包约定同款（chan-ui 同机制，id=包名）

### 2.2 装载（product patch 单行）

`kstock/web/cordis.patch.yml` 插件名单 insert（chan-ui 之后、brand 之前）：

```yaml
    # 定时任务插件（内置收编自 dsh-kylin-automation 0.1.2，MIT）：
    # durable 自动化定义 + 调度钟 + 全新会话执行器 + 运行历史持久化；
    # 侧边栏「定时任务」管理页 + agent automation_* 六工具。
    - id: kstock-automation
      name: '@kstock/automation'
      config:
        maxConcurrentRuns: 2
        runTimeoutMinutes: 60
        misfireGraceMinutes: 15
        historyLimit: 200
```

- 行 `id` 为名单键；`name` 经 kstock/web node_modules / workspace 解析到 `@kstock/automation`
- client ModuleLoader id 已随重构建改为 `@kstock/automation`（与包名一致，chan-ui 同约定）

### 2.3 构建链

- `kstock/pnpm-workspace.yaml` packages 增加 `"automation"`
- `kstock/automation/package.json` devDeps 取上游锁定版本（esbuild / typescript / @types/node / @types/react / @types/react-dom / luxon / zod / react / react-dom），运行时依赖为零（luxon/zod 已内联进 lib）
- `scripts/build-engine-bundle.sh`：两个插件包循环名单加入 `automation`；该包构建命令是 `node scripts/build.mjs`（非 tsdown），循环内按 `tsdown.config.ts` 存在与否分流

## 3. 实施步骤

### Step 1 收编

1. `git switch -c feat/automation-builtin`
2. vendor 包（排除 node_modules / plans / release / pnpm-lock / 上游发布脚本 / 内部 patch）
3. `package.json` 改名换版 + devDeps + 去 `dsh.bundle`
4. `build.mjs` PACKAGE_ID → `@kstock/automation`
5. `tsconfig.json` 加 cordis 类型 paths 别名
6. `pnpm-workspace.yaml` + 根 `pnpm install`（链接 workspace + 拉 devDeps）
7. `node scripts/build.mjs` 产出 lib（client id 已换名）+ 插件自身 `npm test`（stub 测试套）

### Step 2 配置产品化

8. `kstock/web/cordis.patch.yml` 名单行 + 产品 config（§2.2）
9. `kstock/web/package.json` 若解析需要则补 file: 依赖（先试裸名 workspace 解析）
10. `scripts/build-engine-bundle.sh` 循环分流（§2.3）

### Step 3 品牌化与验证

11. 重建 web bundle → 重启隔离引擎（18099）
12. 验证清单：
    - [ ] 引擎启动无插件装载错误（日志无 dsh-kylin-automation/automation 相关 error）
    - [ ] 侧边栏出现「定时任务」入口，管理页打开（空列表态）
    - [ ] 产品数据目录出现 automation 存储落盘（storageDomain）
    - [ ] 新会话 systemPrompt 含 automation_* 工具通告（能力面）
    - [ ] （E2E 可选）创建 once 任务（+2 分钟，read-only，无害提示词）→ 运行历史出现 completed
13. 浅色/深色主题各截一张管理页（样式令牌驱动，预期自适应）
14. `tsc` + chan-ui 20 测试 + `check-ci.sh` 回归
15. ff 合并 `main`，引擎以 main 内容重启

## 4. 风险与回滚

| 风险 | 缓解 |
|---|---|
| 引擎快照服务面与 KCoder 主线漂移导致 inject 失败 | 已核实 storage-domain/workspace 存在；启动日志即时暴露，回滚=删名单行 |
| cordis 类型别名破坏声明 emit | 兜底：本地 `.d.ts` 模块声明 shim（type-only 使用面小） |
| 桌面长驻语义：引擎退出调度钟即停，15min 宽限覆盖不了「次日才开机」 | 二期产品策略（启动补跑开关 / 交易日历 gate），不阻塞本期 |
| pnpm install 需拉 devDeps（网络） | 失败则回退「提交上游预构建 lib + 构建循环跳过」方案（lib 字节级同源） |

## 5. 二期候选（不阻塞本期）

- 交易日历 gate（非交易日 skip；接入 Tushare 交易日历）
- 任务模板：「盘后选股入库」「周度因子检验」一键预填
- 运行历史 ↔ 四库联动（run 产出的 run_id 深链到对应库面板）
- misfire 产品策略开关（设置页）

## 6. 验收口径

内置后：KStock 用户开箱即得定时任务能力（侧边栏页 + agent 工具），无任何安装动作；产品默认配置下并发/超时/历史符合 §1 表格；主分支 `check-ci.sh` 与 chan-ui 测试保持全绿。
