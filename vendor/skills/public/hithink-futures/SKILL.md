---
name: hithink-futures
description: 问财期货期权数据查询——支持期货行情、期权波动率、产销数据、会员持仓、会员榜单、行权数据的自然语言查询，基于同花顺问财 OpenAPI，开箱即用的跨平台技能包。
version: 1.0.0
author: kk-quant
license: MIT
category: finance


package:
  type: python
  entry: scripts/cli.py
capabilities:
  - id: futures-quote
    description: "期货行情查询：价格、涨跌幅、成交量、持仓量等"
  - id: options-vol
    description: "期权波动率查询：隐含波动率、历史波动率"
  - id: production-sales
    description: "产销数据查询：库存、产量、销量"
  - id: member-holding
    description: "会员持仓查询：持仓量、持仓变化、会员排名"
  - id: exercise-data
    description: "行权数据查询：行权价、行权量、行权比率"

permissions:
  network: true
  filesystem: true
  shell: true
  env:
    - IWENCAI_API_KEY

requires:
  packages: []
  bins: ["python3"]
  env: ["IWENCAI_API_KEY"]
required-secrets:
  - IWENCAI_API_KEY

inputs:
  - name: query
    type: string
    required: true
    description: "自然语言查询，如 '沪铜期货最新行情'、'50ETF期权隐含波动率'"

metadata:
  openclaw:
    emoji: "🔧"
    version: "1.0.0"
    author: "kk-quant"
    category: "finance"
    tags:
      - finance
      - futures
      - options
      - iwencai
    requires:
      bins: ["python3"]
      env: ["IWENCAI_API_KEY"]
    install:
      - id: pip-deps
        kind: pip
        package: ""
        python: python3
        label: "无第三方依赖"
      - id: setup-env
        kind: manual
        instructions: "请配置环境变量 IWENCAI_API_KEY（同花顺问财API密钥）"
        label: "Configure API key"

tags:
  - finance
  - futures
  - options
  - iwencai
---
