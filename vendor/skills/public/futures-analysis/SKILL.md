---
name: futures-analysis
description: A股股指期货四维一体深度分析引擎——行情趋势（K线/均线/OI）+贴升水分析（基差/期限结构/市场情绪）+机构持仓（前20席位多空/中信风向标）+综合研判（100分评分/品种分化/策略建议），开箱即用的跨平台技能包。
version: 1.0.0
author: kk-quant
license: MIT
category: finance


package:
  type: python
  entry: scripts/analysis-engine/analyze_futures.py
capabilities:
  - id: daily-futures-analysis
    description: "日度股指期货行情分析：活跃合约识别、K线趋势、均线、振幅、OI变化"
  - id: weekly-futures-analysis
    description: "周度股指期货分析：周内日线走势、周涨跌幅、基差周均值、周末持仓快照"
  - id: contango-analysis
    description: "贴升水分析：基差/基差率/期限结构/升贴水信号/市场情绪判断"
  - id: holding-analysis
    description: "机构持仓分析：前20大席位多空排名、中信期货风向标、其他19家对比、净持仓变化信号"
  - id: composite-judgment
    description: "综合研判：100分评分模型、品种分化对比、多空环境判断、投资策略建议"

permissions:
  network: true
  filesystem: true
  shell: true
  env:
    - TUSHARE_TOKEN

requires:
  packages: ["pandas"]
  bins: ["python3"]
  env: ["TUSHARE_TOKEN"]
required-secrets:
  - TUSHARE_TOKEN

inputs:
  - name: query
    type: string
    required: true
    description: "分析需求，如'股指期货分析'、'IF持仓分析'、'期货贴升水'、'周度期货'"

metadata:
  openclaw:
    emoji: "📊"
    version: "1.0.0"
    author: "kk-quant"
    category: "finance"
    tags:
      - finance
      - futures
      - stock-index-futures
      - quantitative-analysis
      - A-share
      - tushare
    requires:
      bins: ["python3"]
      env: ["TUSHARE_TOKEN"]
    install:
      - id: pip-deps
        kind: pip
        package: "tushare pandas numpy pydantic"
        python: python3
        label: "Install Python dependencies"
      - id: setup-env
        kind: manual
        instructions: "请配置环境变量 TUSHARE_TOKEN（Tushare Pro API密钥）"
        label: "Configure API key"

tags:
  - finance
  - futures
  - stock-index-futures
  - quantitative-analysis
  - A-share
  - tushare
---
