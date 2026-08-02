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
