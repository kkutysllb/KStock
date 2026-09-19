---
name: index-futures-theme
description: |
  股指期货专题分析场景（编排手册）。用户问「期指分析 / 股指期货 / IF IC IH IM /
  基差 / 贴水升水 / 期指多空持仓」等股指期货类问题时触发。编排 futures-analysis
  （四维引擎：行情趋势/基差期限结构/机构持仓/综合研判）+ hithink-futures 补充 +
  html-report 看板交付与报告库归档。产出：单文件 HTML 期指专题看板。
version: 2.0.0
author: kk-quant
license: MIT
category: finance
tags: [股指期货, 基差, 期指专题, 场景编排]

package:
  type: knowledge-only
---

# 股指期货专题分析场景（编排手册）

本技能是场景编排层：自身不带数据脚本，编排 futures-analysis 等引擎技能完成
一次完整的股指期货专题分析并交付 HTML 看板。

## 触发条件

- 「期指分析」「股指期货」「IF/IC/IH/IM」「基差」「升贴水」「期指持仓」
  「多头持仓 空头持仓」「中信席位」等期指类问题；
- 大盘方向的期指佐证（可与市场联动场景的期指基差维度衔接）。

## 阶段一：数据采集（必做）

1. `skill` 工具加载 `futures-analysis`，按加载结果给出的基目录进入后执行
   其分析引擎（四维：行情趋势 K 线/均线/OI、基差与期限结构、前 20 席位
   多空持仓与中信风向标、综合研判 100 分评分）；
2. 需要盘中/延时补充时加载 `hithink-futures`（同花顺期货数据）交叉验证；
3. 引擎输出落盘用各引擎自身规定的输出方式，禁止 shell 重定向混入日志。

## 阶段二：解读与交叉（可选，用户要「深度」时）

- `subagent` 并行委派：基差结构解读（要求先 `skill` 加载 futures-analysis）、
  期权隐含预期交叉（加载 options-volatility，看 IM/IF 期权 PCR 与 IV 对
  期指方向的印证）、大盘环境（加载 macro-query）；
- 委派 prompt 写明引擎命令与输出格式；数值原样转述。

## 阶段三：报告交付（必做）

按 html-report 技能契约构造报告 JSON：基差率时间序列（line）、四品种
多空持仓对比（bar）、综合研判评分卡、分节解读；渲染单文件 HTML，归档
报告库（POST /kstock-api/reports），present 呈现。

## 输出纪律

- 基差 = 期货 − 现货，升水为正；口径不得颠倒；
- 品种分化（IF/IC/IH/IM）必须分开陈述，禁止一锅炖；
- 持仓数据注明交易日（T+1）；缺失标注「无数据」及原因；
- 结论带综合评分、方向与数据日期；研究参考口径。
