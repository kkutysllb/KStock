---
name: event-query
description: 查询个股业绩预告、增发、质押、解禁、调研、监管函等事件数据，支持自然语言问句输入，返回相关事件数据结果。当用户询问业绩预告、增发配股、股权质押、限售解禁、机构调研、监管函等事件数据查询问题时，必须使用此技能。
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
  - id: earnings-forecast-event
    description: "业绩预告查询：预增、预减、扭亏等"
  - id: secondary-offering
    description: "增发配股查询：增发上市、配股预案等"
  - id: pledge-info
    description: "股权质押查询：质押变动、质押解除等"
  - id: lockup-unlock
    description: "限售解禁查询：解禁时间、解禁数量等"
  - id: institutional-survey
    description: "机构调研查询：调研记录、调研机构等"
  - id: regulatory-letter
    description: "监管函查询：问询函、警示函、监管措施等"

permissions:
  network: true
  filesystem: false
  shell: true
  env:
    - IWENCAI_API_KEY

metadata:
  openclaw:
    emoji: "📅"
    version: "1.0.0"
    author: "kk-quant"
    category: "finance"
    tags:
      - finance
      - iwencai
      - event-query
      - A-share

tags:
  - finance
  - iwencai
  - event-query
  - A-share
---
