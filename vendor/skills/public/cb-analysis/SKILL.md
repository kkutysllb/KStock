---
name: cb-analysis
description: 可转债全链路分析技能包——筛选+分析+看板三引擎一体化。覆盖16大看板模块（强赎/下修/龙虎榜/配债安全垫/妖债监控等）、六维度深度分析（基本指标/正股联动/债底保护/时间价值/资金面/套利信号）、智能自然语言筛选。基于同花顺问财OpenAPI，Python3标准库零依赖。
version: 1.0.0
author: kk-quant
license: MIT
category: finance

capabilities:
  - id: cb-selector
    description: "智能筛选：自然语言查询全市场可转债"
  - id: cb-analyzer-single
    description: "单只深度分析：六维度评分（0-100分）"
  - id: cb-analyzer-compare
    description: "批量横向对比：多只可转债综合排名"
  - id: cb-dashboard
    description: "全景看板：16大模块市场监控"
  - id: cb-forced-redeem
    description: "强赎时间表：全状态监控（已公告/不强赎/倒计时）"
  - id: cb-downrev-count
    description: "下修天计数：下修进度跟踪"
  - id: cb-bond-cushion
    description: "配债安全垫：高含权率标的安全边际"
  - id: cb-monster-bond
    description: "妖债监控：异常投机标的预警"
  - id: cb-arbitrage
    description: "套利机会：转股折价套利扫描"

permissions:
  filesystem: true
  shell: true
  network: true

requires:
  bins: ["python3"]
  packages: []
  env: ["IWENCAI_API_KEY"]
required-secrets:
  - IWENCAI_API_KEY

inputs:
  - name: query
    description: "自然语言查询条件（如：转股溢价率低于10%的可转债）"
    required: false
  - name: bonds
    description: "可转债名称，多只用逗号分隔"
    required: false
  - name: module
    description: "看板模块名（forced-redeem/top10/arbitrage 等）"
    required: false

tags:
  - cb
  - convertible-bond
  - iwencai
  - 可转债
  - 问财


package:
  type: python
  entry: scripts/cli.py
metadata:
  openclaw:
    version: "1.0.0"
    emoji: "📈"
    author: "kk-quant"
    category: "finance"
    tags:
      - cb
      - convertible-bond
      - iwencai
      - 可转债
      - 问财

---
