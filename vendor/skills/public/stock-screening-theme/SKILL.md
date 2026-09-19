---
name: stock-screening-theme
description: |
  自然语言选股流水线场景（编排手册）。用户问「帮我选股 / 筛选 XX 特征的
  股票 / 高股息低估蓝筹 / 找标的」等选股类问题时触发。编排 a-stock-screener
  （自然语言→多策略筛选）→ 批量个股快评（stock-analysis 引擎群）→
  html-report 汇总看板与报告库归档。产出：单文件 HTML 选股清单看板。
license: MIT
category: finance
version: 2.0.0
author: kk-quant
tags:
  - 选股
  - 策略筛选
  - 场景编排

package:
  type: knowledge-only
metadata:
  openclaw:
    emoji: "🎣"
    version: "2.0.0"
    author: "kk-quant"
    category: "finance"
    tags:
      - 选股
      - 策略筛选
      - 场景编排
---

# 自然语言选股流水线场景（编排手册）

本技能是**场景编排层**：a-stock-screener 把自然语言条件映射为多策略组合
初筛，再对头部标的批量快评，交付汇总看板。**产物分区纪律**见
sandbox-path-guide——引擎输出落 `data/`、报告落 `reports/`，从工作区根执行。

## 触发条件

- 「帮我选股」「筛选 XX 的股票」「找几只高股息低估的」「小盘成长选股」；
- 单只股票深度问题不触发（走个股尽调场景）。

## 阶段一：初筛（必做）

```bash
mkdir -p data reports
python3 "<a-stock-screener 基目录>/scripts/cli.py" \
  --query "高股息低估蓝筹股" --top 20 --json > data/screen.json
```

- 输出含 `strategies_used`（命中的策略组合，如 value_dividend/value_low_pe）
  与逐股评分；`--top` 控制返回数（默认 10，选股清单建议 20）；
- **`--mock` 禁止用于正式交付**（伪数据，仅调试链路用）；
- 条件表述贴近问财/策略原生语义（股息率/PE/PB/ROE/市值/成长性），
  复合诗意表述（「穿越牛熊的长跑者」）会被降级映射，结果注明策略解释。

依赖：TUSHARE_TOKEN / IWENCAI_API_KEY（壳已注入；缺则按「无数据」口径，
禁止编造）。

## 阶段二：批量快评（必做，按长任务纪律并行）

对初筛 top N（用户未指定时取前 10）并行采集快评（subagent 分派或
run_in_background；基目录 = stock-analysis 技能加载结果）：

| 维度 | 命令要点 |
|---|---|
| 公司信息 | `analyze_stock_company_info.py --stock <代码> --json > data/quick-<代码>.json` |
| 估值 | `analyze_stock_valuation.py --stock <代码带后缀> --json`（必须 .SH/.SZ 后缀） |

每股一份 `data/quick-*.json`；收齐后统一校验退出码与 error 键。

## 阶段三：汇总交付（必做）

1. html-report 契约构造 `reports/report.json`：
   - 评分卡：命中策略组合 + 入选数 + 一句话画像；
   - 图表：入选股综合评分（bar）、估值百分位分布（bar）；
   - 分节正文：清单总表（代码/名称/评分/策略命中/估值百分位）+ 每股
     2-3 条快评；落选说明（策略解释，帮助用户放宽/收紧条件）；
   - 风险提示与参考来源（接口名 + 数据日期）；
2. 渲染 `-o reports/screening.html`，归档报告库，present 呈现。

## 输出纪律（强约束）

- 策略命中与评分**原样转述**，禁止重算或重排；
- 快评数值原样转述；估值必须带后缀代码口径；
- mock 模式结果禁止进入交付物；
- 缺失诚实标注「无数据」及原因；结论带数据日期；全文为研究参考口径，
  不构成投资建议。
