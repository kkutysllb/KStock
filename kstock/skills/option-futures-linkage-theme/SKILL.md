---
name: option-futures-linkage-theme
description: |
  期指期权联动分析场景（编排手册）。用户问「期指期权联动 / 期权 PCR 与期指
  方向 / 期权持仓变化与期货持仓印证」等期权×期货交叉验证类问题时触发。
  编排 option-futures-linkage（联动引擎）+ futures-analysis + options-volatility
  交叉解读 + html-report 看板交付。产出：单文件 HTML 联动看板。
version: 2.0.0
author: kk-quant
license: MIT
category: finance
tags: [期指期权联动, 交叉验证, 场景编排]

package:
  type: knowledge-only
---

# 期指期权联动分析场景（编排手册）

本技能是场景编排层：编排 option-futures-linkage 引擎 + 期指/期权两翼引擎，
完成「期权指标 × 期指持仓/基差」的交叉验证并交付 HTML 看板。

## 触发条件

- 「期指期权联动」「期权印证期指」「PCR 与期货多空」「期权持仓与期货席位」
  等跨品种交叉类问题；
- 期指专题或期权 ETF 分析中用户追问「两边信号是否印证」时。

## 阶段一：数据采集（必做）

1. `skill` 工具加载 `option-futures-linkage`，按加载结果给出的基目录进入后
   执行其联动分析引擎（期权五维 × 期货维度的联动信号矩阵）；
2. 两翼补充：futures-analysis（基差/前 20 席位持仓）、options-volatility
   （对应品种 PCR / ATM IV）。

## 阶段二：交叉解读（本场景核心）

逐品种（IF/IC/IH/IM 对应期权）对齐三组信号：

| 信号源 | 指标 | 印证问题 |
|---|---|---|
| 期权 | PCR（成交/持仓）、IV 变化 | 情绪与保险需求方向 |
| 期货 | 基差率、多空持仓变化 | 现实多头空头力量 |
| 联动引擎 | 联动信号矩阵 | 两者共振/背离结论 |

- 信号矛盾时明确标注「背离」并给出两种解读，禁止强行统一口径。

## 阶段三：报告交付（必做）

html-report 契约构造：联动信号矩阵表、PCR 与多空净持仓双轴对照（line/bar）、
共振/背离结论卡；渲染归档（POST /kstock-api/reports）并 present。

## 输出纪律

- 三组信号数值原样转述；背离必须显式标注，不得回避；
- 期权与期货数据交易日对齐（T+1 口径），错位时注明；
- 缺数据标注原因；研究参考口径，方向判断给依据与反证。
