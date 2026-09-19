---
name: option-etf-theme
description: |
  期权 ETF 专题分析场景（编排手册）。用户问「期权 ETF 分析 / 7 大期权 ETF /
  ETF 份额与期权波动率 / 50ETF 300ETF 500ETF 科创50 中证1000」等期权 ETF 类
  问题时触发。并行编排 etf-analysis（行情/份额）+ option-futures-linkage
  （期权五维联动）+ market-linkage-engine（8 维联动背景）+ html-report 看板。
version: 2.1.0
author: kk-quant
license: MIT
category: finance
tags: [期权ETF, ETF份额, 波动率, 场景编排]

package:
  type: knowledge-only
---

# 期权 ETF 专题分析场景（编排手册）

本技能是场景编排层：并行采集三大引擎数据，汇总 7 大期权 ETF 标的的
资金/情绪方向矩阵并交付 HTML 看板。

## 触发条件

- 「期权 ETF 分析」「7 大期权 ETF」「ETF 份额变化」「期权标的 ETF」等；
- 用户点名具体标的（50ETF/300ETF/500ETF/创业板ETF/科创50/中证1000/深100）。

## 阶段一：并行数据采集（必做，用 subagent 三路并行）

**产物分区纪律**（先 `mkdir -p data reports`）：三路引擎输出一律落
`data/`（如 `data/etf.json` / `data/of.json` / `data/linkage.json`），
从工作区根执行、脚本用各技能加载结果给出的基目录拼接全路径（模块式引擎
用 `PYTHONPATH="<基目录>"` 免 cd，见 market-linkage 技能模板）。

| 子代理 | 加载技能 | 采集内容 |
|---|---|---|
| A | etf-analysis | 7 大期权 ETF 行情/成交额/份额/规模 |
| B | option-futures-linkage | 期权五维 × 标的联动信号 |
| C | market-linkage-engine | 8 维联动（期权波动率/宽基份额为重点维度） |

- 委派 prompt 写明：先 `skill` 加载对应技能、执行命令与输出路径（`data/`
  下）、输出格式；
- 子代理数值与表格原样转述，不得改写。

## 阶段二：汇总（Lead 或主代理）

- 7 大标的资金/情绪**方向矩阵**（每标的：价格信号 / 份额申赎 / 期权 PCR·IV
  → 综合方向）；
- 共振/背离标注：份额放量申购 + 价格滞涨 = 背离信号，必须显式标注；
- 用户补充的池外标的：etf-analysis 日度/周度查询，标注「无期权联动维度」。

## 阶段三：报告交付（必做）

html-report 契约构造：方向矩阵表（评分卡）、份额变化时间序列（line）、
各标的分节（明细表 + 2-3 条解读）；报告 JSON 写 `reports/report.json`，
渲染输出 `reports/option-etf.html`，归档（POST /kstock-api/reports）并
present 该文件。

## 输出纪律

- 份额申赎与价格的同向/背离逐标的标注；金额口径亿元；
- 非期权标的不得硬套期权维度，标注「无期权联动维度」；
- 结论带数据日期；研究参考口径。
