# 期权ETF专题分析场景设计

> 版本：v1.1（2026-08-02）
> 状态：模板编排机制已落地（lead_soul.md 期权ETF/普通ETF 双场景节 + 前端简洁请求 + etf-analysis 双标的池周度引擎），待 L2 端到端验证
> 前置条件：32 个技能全量端到端验证通过（见 [技能可用性报告](技能可用性报告.md)），etf-analysis 周粒度引擎 L1 已验证

## 一、场景定义

**场景（Scenario）= 简洁用户消息 + 提示词模板编排**。与[股指期货专题分析场景](股指期货专题分析场景设计.md)
同一机制：用户在桌面端空态工作台点击场景卡片，前端仅填入**简洁研究请求**（如"请做一份期权ETF专题分析（日度）"）；
完整的编排指令（委派哪些子代理、执行哪些技能脚本、共振/背离标注规则、输出结构）由 **Lead Agent 提示词模板**
（`config/lead_soul.md` → `QILIN_HOME/SOUL.md` → 系统提示 `<soul>` 块）承载，**不进入用户消息**。

本场景：**期权ETF专题分析**——以 7 大期权 ETF（510050 上证50ETF / 510300 沪深300ETF /
510500 中证500ETF / 512100 中证1000ETF / 159915 创业板ETF / 588000 科创50ETF /
159901 深100ETF）为核心标的，完成「ETF 市场维度 → 期权联动维度 → 市场环境维度」三层协同分析，
输出 7 大标的资金/情绪方向矩阵与共振/背离标注。支持**日度 / 周度**双粒度。

### 1.1 期权ETF vs 普通ETF 场景区分（v1.1 新增）

ETF 分析按标的资格拆分为两个独立场景，**技能层**与**编排层**均显式区分：

| 维度 | 期权ETF专题分析场景 | 普通ETF专题分析场景 |
|------|--------------------|--------------------|
| 触发 | 「期权ETF专题分析」「7大期权ETF」「ETF期权联动」且标的在 7 大池内 | 用户输入任意 ETF 代码/名称，且不在 7 大池内（如 512880.SH 证券ETF） |
| 标的池（技能层） | 硬编码 7 大期权 ETF（OPTION_ETFS，与 market-linkage-engine 一致） | 不设默认池，用户通过 `--symbols`（周度）/ `ts_code`（日度）输入代码 |
| 分析维度 | ETF 行情/成交额/份额 + 期权联动（PCR/IV/RR）+ 市场环境 | 仅 ETF 自身维度（行情/成交额/份额）+ 市场环境参考（可选） |
| 类型标注 | 自动标注「期权ETF」 | 自动标注「普通ETF」（名称回退为代码） |
| 汇总输出 | 方向矩阵 + 6 条共振/背离规则 | 资金流/价格信号表 + 2 条价格×份额背离 |
| 编排节 | lead_soul.md「期权ETF专题分析场景」 | lead_soul.md「普通ETF专题分析场景」（无期权维度） |

判断规则：代码在 OPTION_ETFS 池内 → 期权ETF场景；否则 → 普通ETF场景（用户只给名称时
先经 etf-list / selector 确认代码再分流）。

## 二、提示词模板机制（编排指令的载体）

### 2.1 模板链路（与股指期货场景同机制）

```
config/lead_soul.md（仓库模板，Git 管理）
  │  run_gateway.py::_ensure_default_soul（首次启动写入，已存在保留用户内容）
  ▼
QILIN_HOME/SOUL.md（运行时，~Library/Application Support/KStock/runtime/qilin/SOUL.md）
  │  QiLin 引擎 load_agent_soul → 渲染进 lead agent system prompt 的 <soul> 块
  ▼
Lead Agent（所有对话的持久行为约束，用户不可见）
```

模板新增「期权ETF专题分析场景」一节：粒度识别（日度/周度）、三维度子代理委派流程
（read_file 激活技能 → 固定命令模板）、7 大期权 ETF 方向矩阵与共振/背离标注规则、场景约束。

### 2.2 模板内容（config/lead_soul.md 场景节要点）

1. **粒度识别**：用户消息含「周度」→ 周度流程；否则默认日度
2. **ETF 市场维度**：委派 general-purpose——`read_file` 读 `etf-analysis/SKILL.md`（密钥激活）
   → 日度 `python3 cli.py tushare daily --params ts_code=<标的> limit=20` 等命令覆盖 7 大标的
   的行情/份额/规模；周度 `python3 analyze_weekly_etf.py` → 转述行情/成交额/份额变化表
   （周度：周涨跌幅/周均成交额/份额净申赎）
3. **期权联动维度**：同构委派 `option-futures-linkage`，执行 `analyze_option_futures.py`（周度
   `analyze_weekly_option_futures.py`）→ 转述 PCR/ATM IV/IV 斜率/RR 与 5 维联动信号表
4. **市场环境维度**：同构委派 `market-linkage-engine`，完成 8 维联动分析（重点：7 大期权 ETF
   波动率与 9 大宽基 ETF 份额维度）并转述联动评分
5. **汇总输出**：7 大期权 ETF 方向矩阵（ETF 信号/期权信号/联动信号/综合方向）+ 共振/背离标注
   （见 2.3）+ 综合评分 + 一句话结论
6. **场景约束**：子代理禁止 shell 重定向/写文件/路径探查；命令报错原样转述

> 运行时 SOUL.md 与模板 diff 一致时可安全覆盖同步；若已被用户修改，需人工合并场景节。

### 2.3 共振 / 背离标注规则（场景节第 5 条）

| 规则 | 判据 | 标注 |
|------|------|------|
| 四向共振偏空 | ETF 价跌 + 份额净减 + 成交量 PCR 偏空 + RR 认沽贵 | 共振偏空 |
| 资金/情绪背离 | ETF 价跌但份额净增（逢低布局），PCR 偏空 | 背离（现货抄底 vs 期权避险） |
| 共振偏多 | ETF 价涨 + 份额净增 + PCR 认购活跃（<0.8） | 共振偏多 |
| 价格/情绪背离 | ETF 价涨但份额净减（资金不追高）+ IV 抬升 | 背离（价格虚涨、情绪谨慎） |
| 风格切换 | 大盘 ETF（50/300）偏多 vs 成长 ETF（科创/创业板）偏空 | 风格切换 |
| 波动放大 | 份额大幅净增 + IV 抬升 | 抄底与恐慌并存 |

## 三、分析技能层周粒度扩展（本次新增）

etf-analysis 技能新增**期权ETF周度综合引擎** `scripts/analysis-engine/analyze_weekly_etf.py`，
与 futures-analysis / option-futures-linkage / market-linkage-engine 的周粒度能力对齐。

### 3.1 能力声明（SKILL.md v1.2.0）

- `capabilities` 新增 `etf-weekly`：期权 ETF 默认池（7 大，硬编码）或用户自定义代码
  （`--symbols`，普通 ETF 不设默认池）按 ISO 自然周聚合，输出自动标注「期权ETF/普通ETF」类型
- 正文新增「标的池区分（期权ETF vs 普通ETF）」表 + 「引擎3: ETF 周度综合引擎」双池执行方式与口径说明

### 3.2 周度口径

- **周窗口**：ISO 自然周聚合（周标签形如 `2026-W31`），默认最近一周，`--weeks N` 回溯
- **周涨跌幅**：周内末收盘 / 周内首收盘 - 1
- **周均成交额**：周内每日成交额均值（Tushare 金额单位千元，换算亿元 ÷1e5）
- **份额净申赎**：周末份额 - 周初份额（亿份，fd_share 万份 ÷1e4；正=资金净流入/负=净流出）
- **价格 × 份额背离信号**：价涨份额减 = 资金不追高；价跌份额增 = 逢低布局
- **评分模型**：涨跌幅（±15）+ 份额净申赎（±12）+ 背离修正（±8）→ 0-100 分，≥58 偏多 / ≤42 偏空

### 3.3 输出结构（脚本 stdout，Markdown 模板）

| 章节 | 内容 |
|------|------|
| 一、周度市场概览 | 标的池 ×（类型/周涨跌幅/周均成交额/份额变化/信号）汇总表，含标的池名 |
| 二、逐标的周度分析 | 行情 / 份额与规模 / 信号 / 周内每日明细（标题含类型标注） |
| 三、分标的周度对比 | 横向对比表（含类型列）+ 评分条 |
| 四、综合研判 | 综合评分 / 积极信号 / 风险信号 |
| 五、小s的总结 | 逐标的结论 + 背离提示（普通 ETF 标注无期权维度） |

### 3.4 数据源与容错

- Tushare Pro：`fund_daily` / `fund_share` / `fund_nav`
- 单标的失败不影响其他（error 字段标注，缺失如实呈现）
- 最新交易日优先由行情数据推断（trade_cal 权限缺失时兜底）

## 四、前端引导机制（落地位置：apps/desktop/src/pages/Home.tsx）

### 4.1 数据结构（复用既有 ResearchScene）

```tsx
interface ResearchScene {
  id: string;          // 场景唯一标识，如 "option-etf-daily"
  title: string;       // 卡片标题，如 "期权ETF专题分析 · 日度"
  description: string; // 一句话说明（卡片副标题）
  prompt: string;      // 简洁研究请求（点击后填入输入框，单行）
}

const researchScenes: ResearchScene[] = [
  { id: "index-futures-daily",  title: "股指期货专题分析 · 日度", ... },
  { id: "index-futures-weekly", title: "股指期货专题分析 · 周度", ... },
  { id: "option-etf-daily",  title: "期权ETF专题分析 · 日度",
    prompt: "请做一份期权ETF专题分析（日度）" },
  { id: "option-etf-weekly", title: "期权ETF专题分析 · 周度",
    prompt: "请做一份期权ETF专题分析（周度）" },
  { id: "etf-normal-daily",  title: "普通ETF专题分析 · 日度",
    prompt: "请做一份普通ETF专题分析（日度）" },
  { id: "etf-normal-weekly", title: "普通ETF专题分析 · 周度",
    prompt: "请做一份普通ETF专题分析（周度）" },
];
```

### 4.2 交互流程（与股指期货场景一致）

```
空态工作台（workspace-empty）
  │  ┌─ 研究场景区块（research-scenes）─────┐
  │  │ 场景卡片：标题 + 描述 + 图标          │  ← 本次新增 4 张（期权ETF 2 + 普通ETF 2）
  │  └──────────────────────────────────────┘
  ▼
点击场景卡片 → onDraftChange(scene.prompt) → 简洁请求填入输入框（可编辑）
  ▼
用户发送 → Lead Agent 从 <soul> 模板识别「期权ETF专题分析」场景 → 按模板编排执行
```

- 场景卡片点击只填输入框、不直接发送，用户可查看/调整粒度后再发送
- **用户消息保持自然语言简洁，不承载任何编排指令**

## 五、Agent 编排流程（收到请求后，由模板驱动）

```
请求（日度）："请做一份期权ETF专题分析（日度）"
  │  Lead Agent 从 <soul> 模板识别场景 → 并行委派 3 个子代理
  ▼
Lead Agent（编排）
  ├─ Subagent A：etf-analysis ─────── 7 大期权 ETF 行情/成交额/份额/规模
  ├─ Subagent B：option-futures-linkage ── 期权五维 × 5 维联动信号
  └─ Subagent C：market-linkage-engine ─── 8 维市场联动（期权 ETF 波动率/宽基 ETF 份额为重点）
  │
  ▼
Lead Agent 汇总：7 大标的资金/情绪方向矩阵 + 共振/背离标注 + 综合评分
  ▼
交付：AI 总结（含方向矩阵表、份额变化表、联动信号表）
```

> 子代理委派由模型自主决策（实测 lead 也可能自行执行部分技能，结果等价）；
> `max_total_per_run=6` 覆盖 3 个子代理上限。

**普通ETF专题分析场景**编排流程（lead_soul.md「普通ETF专题分析场景」节）：

```
请求（周度）："请做一份普通ETF专题分析（周度）" + 用户补充标的代码（如 512880.SH,518880.SH）
  │  Lead Agent 从 <soul> 模板识别场景 → 提取代码（不在 7 大池内）→ 委派
  ▼
Lead Agent（编排）
  ├─ Subagent A：etf-analysis ─── 日度 ts_code / 周度 --symbols，自动标注「普通ETF」
  └─ Subagent B（可选）：market-linkage-engine ── 仅大盘环境/宽基份额背景参考
  │
  ▼
Lead Agent 汇总：资金流/价格信号表 + 背离标注 + 「无期权联动维度」说明 + 综合评分
```

## 六、输出结构（AI 总结应包含）

| 区块 | 内容 | 来源 |
|------|------|------|
| 方向矩阵 | 7 大标的 ×（ETF/期权/联动/综合） | Lead 汇总 |
| ETF 维度 | 行情/成交额/份额变化（周度：周涨跌幅/周均成交额/份额净申赎） | Subagent A |
| 期权维度 | PCR/ATM IV/IV斜率/RR + 联动信号表 | Subagent B |
| 市场环境 | 8 维联动评分（期权 ETF 波动率/宽基 ETF 份额） | Subagent C |
| 结论 | 共振/背离清单 + 综合评分 + 一句话结论 | Lead 汇总 |

## 七、验证方式

1. **技能层验证（L1 宿主机）**：`python3 analyze_weekly_etf.py` 输出 7 大标的真实数据，
   周标签为当前 ISO 周（如 2026-W31），周涨跌幅/份额变化与 Tushare 原始数据一致；
   `python3 analyze_weekly_etf.py --symbols 512880.SH,518880.SH` 输出普通 ETF 数据且标注「普通ETF」
2. **模板静态验证**：`config/lead_soul.md` 期权ETF/普通ETF 两场景节与运行时 `QILIN_HOME/SOUL.md` diff 一致
3. **前端静态验证**：`tsc --noEmit`（类型） + `vitest run`（单元测试） + `vite build`
4. **交互验证**：桌面端进入空态工作台 → 点击"期权ETF专题分析 · 日度"卡片 → 输入框出现
   简洁请求（非编排指令） → 发送
5. **端到端验证（L2 沙箱）**：以简洁请求作为 SSE 任务输入，检查 Lead Agent 从 SOUL 模板识别
   场景、3 个子代理 completed、方向矩阵/三表齐全、run 自然结束
6. **周度复验**：同法跑周度请求

## 八、后续扩展（本期不做，需另行确认）

1. **场景目录化**：`researchScenes` 下沉为独立常量模块（如 `src/lib/researchScenes.ts`），
   后续按能力场景表扩充（市场联动全景、个股深度尽调、选股流水线等）
2. **场景卡片按技能可用状态联动**：`SkillsExtensionsCard` 技能开关变化时，场景卡片灰化/隐藏
   不可用技能对应场景
3. **一键直发**：设置项支持"点击场景卡片直接发送"（跳过输入框确认）
4. **模板版本化**：lead_soul.md 增加版本标记，`_ensure_default_soul` 按版本增量合并用户修改
5. **期权ETF 日度维度深度化**：日度 ETF 维度目前由 cli.py 单标的命令组合覆盖；
   若需要"7 大标的一次性日度对比表"，可仿周度引擎新增 `analyze_daily_etf.py`（本期不做）
