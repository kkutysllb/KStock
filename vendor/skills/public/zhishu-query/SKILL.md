---
name: zhishu-query
description: 查询上证指数、沪深300、创业板指、恒生指数、纳斯达克指数等指数行情数据，支持涨跌幅、成交量、点位等指标查询，返回相关指数数据结果。当用户询问指数数据、上证指数、沪深300、创业板指、恒生指数、纳斯达克指数、指数行情、指数涨跌幅、指数点位等问题时，必须使用此技能。
version: 1.0.0
author: kk-quant
license: Complete terms in LICENSE.txt
category: finance


package:
  type: python
  entry: scripts/cli.py
requires:
  packages: []
  env: ["IWENCAI_API_KEY"]
required-secrets:
  - IWENCAI_API_KEY

capabilities:
  - id: index-quote
    description: "指数行情查询：上证指数、沪深300、创业板指等主要指数实时/历史行情"
  - id: index-change
    description: "指数涨跌幅查询：日/周/月/年涨跌幅"
  - id: index-volume
    description: "指数成交量查询：成交额、成交量等"
  - id: hk-index
    description: "港股指数查询：恒生指数、国企指数等"
  - id: global-index
    description: "全球指数查询：纳斯达克、道琼斯、标普500等"

permissions:
  network: true
  filesystem: false
  shell: true
  env:
    - IWENCAI_API_KEY

metadata:
  openclaw:
    emoji: "📈"
    version: "1.0.0"
    author: "kk-quant"
    category: "finance"
    tags:
      - finance
      - iwencai
      - index-query
      - A-share

tags:
  - finance
  - iwencai
  - index-query
  - A-share
---
