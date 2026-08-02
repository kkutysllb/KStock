---
name: strategy-research
description: 量化策略研究公共技能包——策略设计/编码/回测/评估全链路，支持A股/港股/美股/加密货币多市场，内置3种经典策略模板（双均线/RSI/MACD），SignalEngine合约规范，config.json标准配置，策略评审标准，开箱即用。
version: 1.0.0
author: kk-quant
license: Apache-2.0
category: finance


package:
  type: python
  entry: scripts/cli.py
capabilities:
  - id: strategy-design
    description: "策略设计五问框架：数据/信号/仓位/回测/验证"
  - id: strategy-coding
    description: "SignalEngine 合约编码规范"
  - id: strategy-backtest
    description: "信号回测引擎：总收益/年化/夏普/最大回撤/胜率/交易次数"
  - id: strategy-evaluate
    description: "策略评审标准：硬性门控 + 评分规则 + 行动建议"
  - id: strategy-templates
    description: "3种经典策略模板：双均线/RSI/MACD"
  - id: strategy-validate
    description: "策略文件语法验证（AST检查）"

permissions:
  filesystem: true
  shell: true

requires:
  bins: ["python3"]
  packages: ["pandas", "numpy"]
required-secrets:
  - TUSHARE_TOKEN

inputs:
  - name: action
    type: string
    required: true
    description: "操作类型：demo(演示回测)/list(列出策略)/validate(验证策略文件)"

metadata:
  openclaw:
    emoji: "🧪"
    version: "1.0.0"
    author: "kk-quant"
    category: "finance"
    tags:
      - finance
      - strategy-research
      - backtest
      - quantitative-analysis
    requires:
      bins: ["python3"]
      packages: ["pandas", "numpy"]
    install:
      - id: pip-deps
        kind: pip
        package: "pandas numpy"
        python: python3
        label: "Install Python dependencies"

tags:
  - finance
  - strategy-research
  - backtest
  - quantitative-analysis
---
