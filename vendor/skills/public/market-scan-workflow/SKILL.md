---
name: market-scan-workflow
description: |
  全市场扫描工作流范式（L3 流程层模板）。用户提出「全市场/大范围批量筛选并
  逐股分析」「扫一遍市场给我看板」「批量给我筛+评」等多阶段扇出任务时触发。
  把「初筛（a-stock-screener）→ 逐股扇出快评（stock-analysis 引擎群）→
  汇总看板（html-report）」固化为 workflow 工具的一次编排脚本：
  主会话省上下文、子代理结构化收口、单股失败隔离。模板见
  references/scan-fanout-template.js，填 2 个 ◆TODO◆ 即可运行。
license: MIT
category: finance
version: 2.0.0
author: kk-quant
tags:
  - workflow
  - 全市场扫描
  - 场景编排

package:
  type: knowledge-only
  metadata:
    openclaw:
      emoji: "🛰️"
      version: "2.0.0"
      author: "kk-quant"
      category: "finance"
      tags:
        - workflow
        - 全市场扫描
        - 场景编排
---

# 全市场扫描工作流（workflow 范式模板）

本技能是**流程层范式**：把固定的多阶段扇出（初筛 → 并行逐股解读 → 汇总）
固化为 `workflow` 工具的一次编排脚本（JS 骨架 + 结构化阶段契约），由脚本
协调子代理干活，主会话只收最终结构化结果。与 L2 场景手册
（[stock-screening-theme](../stock-screening-theme/SKILL.md)）的关系：
手册教「逐步怎么做」，本范式解决「批量大」——主会话上下文不再被 N 只
股票的引擎输出淹没，且单股失败自动隔离不拖垮全局。

## 触发条件

- 「全市场扫一遍 XX」「筛 20 只然后逐个分析」「批量给我一份看板」；
- 规模判据：**扇出 ≥ 6 只**或每股 ≥ 2 个维度并行——用本范式；
- 反例：单只标的问题走个股尽调场景；≤5 只且两维快评，按
  stock-screening-theme 手动 subagent 分派即可（起 workflow 的编排开销
  不划算）。

## 模板使用（四步）

1. 读 [references/scan-fanout-template.js](references/scan-fanout-template.js)；
2. 替换 2 个 `◆TODO◆`：`QUERY`（初筛条件，贴近策略原生语义：股息率/PE/
   PB/ROE/市值）与 `REPORT_TITLE`；按需调 `TOP_N`（建议 20）与
   `FANOUT_K`（≤10，护 workflow 的 agent 并发/总量限额）；
3. 文末 meta 注释块填进 `workflow` 工具的 **meta** 参数，脚本整体填进
   **script** 参数后发起；钩子契约（agent/pipeline/parallel/phase/log、
   schema 关键字子集）以会话内 workflow 工具描述为准，冲突时自我纠正；
4. run 返回后：核验 `summary.report_path` 文件存在、`quick_ok` 计数，
   主会话 `present` 呈现报告（**present 由主会话做，子代理不做**）；
5. 交付后主会话**归档选股库**（三步 POST 契约见
   [stock-screening-theme](../stock-screening-theme/SKILL.md) 阶段四）：
   初筛 QUERY 与 `strategies_used` 进口径版本，Top 清单逐股进 `picks`
   （code 带交易所后缀），报告全文进 `report`，阶段三归档返回的
   `report_id` 进 `rules.report_id`（面板「看板」直嵌 HTML）。同一方案
   重跑不建新方案（PATCH + 新版本 + 新 run），否则面板跨期重合对比失效。

## 三阶段契约

| 阶段 | 子代理 | 输入 → 结构化输出 | 失败语义 |
|---|---|---|---|
| 一 初筛 | 1 个 | QUERY → `{strategies_used, stocks[{code,name,score,reasons}], data_file}` | **失败即整体终止**（返回 ok:false，禁止编造续跑） |
| 二 逐股快评 | FANOUT_K 个（pipeline 逐项） | 每股 → `{industry, pe, pb, valuation_percentile, one_liner, risks}`（公司信息 + 估值两维，子代理内 run_in_background 并行） | 单股失败标「无数据」，不影响其余 |
| 三 汇总看板 | 1 个 | 前两阶段 JSON → `{report_path, archived(yes/no), data_date, highlights}` | 失败则产物仍在 `data/market-scan/`，可手动续跑阶段三 |

引擎口径（实测坑位，已内联进模板 prompt）：估值必须带交易所后缀
（`600519.SH`），且 **screener 返回的代码本身已带后缀**——模板
`withSuffix` 幂等处理（盲目追加会产生 `601919.SH.SH`，估值查询落空）；
后缀规则 6/9→`.SH`、4/8→`.BJ`、其余→`.SZ`；
`--mock` 禁入交付物；screener 条件贴近问财/策略原生语义，复合诗意
表述会降级映射，结果注明策略解释。

## 输出纪律（强约束）

- 凭据（TUSHARE_TOKEN 等）只经环境间接使用（`. ~/.kstock/config/secrets.env`），
  禁止在 prompt/回复/产物中回显或记录；
- 产物分区：引擎输出落 `data/market-scan/`，报告 JSON 与 HTML 落 `reports/`；
- 子代理返回的评分与数值**原样转述**，禁止改写、重算或重排；
- 归档 `POST http://127.0.0.1:18001/kstock-api/reports` 引擎不可达时记
  `archived: "no"` 继续，不阻塞交付；选股库归档（阶段四契约）同款降级
  语义，跳过须在最终回复明说；缺失维度诚实标注「无数据」及原因；
- 结论带数据日期；全文为研究参考口径，不构成投资建议。

## 变体（改阶段、不改骨架）

| 变体 | 改法 | 注意 |
|---|---|---|
| 深度尽调 | 阶段二 prompt 换成 stock-due-diligence 六路编排 | 每股更重，`FANOUT_K` ≤ 5 |
| 因子入口 | 阶段一换 factor-research `filter`（CSV 宽表面板前置） | 需 factor-mining 技能面 |
| 舆情补充 | 阶段二每股追加 news-search 维度 | 每股 3 维起，K 相应调小 |
| 缠论全池 | 阶段一换 `run_chan_stock_selector` | 全池 10 分钟级：workflow 子代理易超时，建议回会话内 run_in_background 手动收 |

依赖技能面：a-stock-screener + stock-analysis + html-report（stock-screener
preset 天然齐备；其他 preset 引用本范式前确认同组技能已随行）。
