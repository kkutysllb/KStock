---
name: market-linkage-engine
description: |
  A 股市场联动分析引擎。独立、可复用的多维度资金与情绪联动分析工具，覆盖 8 大维度：
  主力资金流向、北向资金流向、两融趋势、股指期货基差、7 大期权 ETF 波动率、
  9 大宽基 ETF 份额变化、Shibor 利率走势、龙虎榜分析。
  数据源：Tushare Pro API + 同花顺问财 OpenAPI。
  输出：日度/周度联动报告 + 综合情绪评分 + 一句话市场总结。
license: MIT
category: finance
version: 1.0.0
author: kk-quant
tags:
  - A股
  - 市场联动
  - 资金流向
  - 北向资金
  - 两融
  - 期权波动率
  - ETF份额
  - Shibor
  - 龙虎榜


package:
  type: knowledge-only
capabilities:
  - id: main-capital-flow
    description: "主力资金流向分析：个股/板块净流入、全市场净额、流入流出比"
  - id: north-bound-flow
    description: "北向资金流向分析：沪深股通净额、连续性、十大活跃股"
  - id: margin-trend
    description: "两融趋势分析：融资余额趋势、净买入额、杠杆水平"
  - id: futures-basis
    description: "股指期货基差分析：IF/IC/IH/IM升贴水、基差率、多空持仓"
  - id: option-volatility
    description: "期权ETF波动率分析：PCR、IV、认购/认沽活跃度"
  - id: etf-share-change
    description: "宽基ETF份额变化：份额净申赎、与价格背离/同步"
  - id: shibor-rate
    description: "Shibor利率走势：各期限利率变化、期限利差、流动性松紧"
  - id: top-list
    description: "龙虎榜分析：上榜个股、机构净买卖、热度评分"

permissions:
  network: true
  filesystem: true
  shell: true

metadata:
  openclaw:
    emoji: "🔗"
    version: "1.0.0"
    author: "kk-quant"
    category: "finance"
    tags:
      - A股
      - 市场联动
      - 资金流向
      - 北向资金
      - 两融
      - 期权波动率
      - ETF份额
      - Shibor
      - 龙虎榜

requires:
  packages: ["pandas"]
  bins: ["python3"]
  env: ["TUSHARE_TOKEN"]
required-secrets:
  - TUSHARE_TOKEN
  - IWENCAI_API_KEY
---

# market-linkage-engine 使用说明

A 股市场联动分析引擎，独立覆盖 8 大资金与情绪维度，输出结构化联动报告 + 综合情绪评分 + 一句话市场总结。

## 运行方式（日粒度 / 周粒度）

```bash
# 日度联动分析（默认最近交易日，短窗口：北向5日/两融20日/期权5日）
python3 -m market_linkage_engine daily

# 周度联动分析（长窗口看中期趋势：北向20日/两融30日/期权10日/Shibor60日）
python3 -m market_linkage_engine weekly

# 指定交易日 / 指定输出格式 / 写入文件
python3 -m market_linkage_engine daily 20260731
python3 -m market_linkage_engine weekly -f summary      # 一句话总结
python3 -m market_linkage_engine daily -f json -o report.json
```

Python API：`LinkageEngine().run_daily()` / `run_weekly()`，`to_markdown()` / `to_summary()`。

## 八大维度

| # | 维度 | 核心指标 |
|---|------|----------|
| 1 | 主力资金流向 | 全市场净额、流入/流出榜、板块 TOP |
| 2 | 北向资金流向 | 沪深股通净额、N 日累计、连续性、十大活跃股 |
| 3 | 两融趋势 | 融资余额、净买入、30 日趋势、融资 TOP20 |
| 4 | 股指期货基差 | IF/IC/IH/IM 主力合约基差率、升贴水信号（基差=期货-现货，升水为正） |
| 5 | 7 大期权 ETF 波动率 | 认购/认沽成交与持仓 PCR、ATM IV（BS 反解）、指数涨跌 |
| 6 | 9 大宽基 ETF 份额 | 份额净申赎、与价格背离/同步信号 |
| 7 | Shibor 利率走势 | 各期限利率、期限利差、流动性判断 |
| 8 | 龙虎榜分析 | 上榜个股、机构净买卖 TOP |

## 输出与评分口径

- 每维度输出 0-100 评分与偏向（bullish / bearish / neutral），聚合为综合评分、偏多/偏空计数与操作建议；
- 数据源：Tushare Pro（T+1），可选同花顺问财实时补充（`--iwencai`）；
- **金额单位**：Tushare hsgt / moneyflow 系列金额均为**万元**（报告已换算为亿元，÷10000）；
- **缺失必须诚实标注**：某维度数据源无权限或无数据时，报告显示「无数据」及原因，禁止以「中性」掩盖缺失；
- **期权覆盖**：7 大品种中 6 只为 ETF 期权（SSE/SZSE，标的为 ETF 价格），中证1000 用中金所股指期权（CFFEX，IM，opt_code=OP000852，标的为 000852 指数点位）；BS 反解 ATM IV 时标的价格与行权价必须同量级（ETF 用元、股指期权用点位）。
- **日/周粒度差异**：daily 报告周期 1-5 日，weekly 拉长窗口至 20-60 日看中期趋势；期指基差每日重算主力合约。

## 在 KStock 场景中的使用

市场环境维度（lead_soul.md 场景第 4 条）：子代理先阅读本文件前 80 行，再执行 `cd /mnt/skills/public/market-linkage-engine && python3 -m market_linkage_engine daily`（周度：`weekly`），将 8 维表格与联动评分原样转述（不得改写数值、不得丢弃表格）。
---
