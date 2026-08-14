---
name: etf-analysis
description: ETF全维度分析技能包——双引擎驱动（Tushare Pro 量化数据层 + 问财实时筛选层），支持13项ETF分析维度（列表/行情/净值/份额/规模/五类分类/跟踪指数/行业ETF/横向对比/持仓/经理/分红）和自然语言智能筛选，开箱即用的跨平台技能包。
version: 1.0.0
author: kk-quant
license: MIT
category: finance


package:
  type: python
  entry: scripts/cli.py
capabilities:
  - id: etf-list
    description: "ETF列表查询（含五类分类标签：宽基/行业/商品/货币/跨境）"
  - id: etf-daily
    description: "ETF日行情：收盘价/涨跌幅/成交额/换手率"
  - id: etf-nav
    description: "ETF历史净值：单位净值/累计净值"
  - id: etf-shares
    description: "ETF份额变化：每日场内份额及环比变化"
  - id: etf-scale
    description: "ETF规模分析：30日日均成交额+估算规模"
  - id: etf-classify
    description: "五类ETF分类概览：宽基/行业/跨境/商品/货币"
  - id: etf-screen
    description: "多条件ETF筛选：按类型/规模/涨跌幅等"
  - id: etf-index
    description: "跟踪指数分析：指数代码/编制机构/指数行情"
  - id: etf-sector
    description: "行业ETF查询：按行业关键词匹配"
  - id: etf-compare
    description: "多ETF横向对比：价格/收益率/规模/费率"
  - id: etf-portfolio
    description: "持仓分析：十大重仓股"
  - id: etf-managers
    description: "基金经理查询"
  - id: etf-dividends
    description: "分红记录查询"
  - id: etf-selector
    description: "问财智能选ETF：自然语言筛选，实时数据"

permissions:
  network: true
  filesystem: true
  shell: true
  env:
    - TUSHARE_TOKEN
    - IWENCAI_API_KEY

requires:
  packages: ["pandas"]
  bins: ["python3"]
  env: ["TUSHARE_TOKEN"]
required-secrets:
  - TUSHARE_TOKEN
  - IWENCAI_API_KEY

inputs:
  - name: query
    type: string
    required: true
    description: "ETF查询需求，如 '510300 ETF行情'、'沪深300ETF有哪些'、'黄金ETF'"

metadata:
  openclaw:
    emoji: "📈"
    version: "1.0.0"
    author: "kk-quant"
    category: "finance"
    tags:
      - finance
      - ETF
      - A-share
      - tushare
      - iwencai
    requires:
      bins: ["python3"]
      env: ["TUSHARE_TOKEN"]
    install:
      - id: pip-deps
        kind: pip
        package: "tushare pandas"
        python: python3
        label: "Install Python dependencies"
      - id: setup-env
        kind: manual
        instructions: "请配置环境变量 TUSHARE_TOKEN（Tushare Pro API密钥）和 IWENCAI_API_KEY（同花顺问财API密钥）"
        label: "Configure API keys"

tags:
  - finance
  - ETF
  - A-share
  - tushare
  - iwencai
---
