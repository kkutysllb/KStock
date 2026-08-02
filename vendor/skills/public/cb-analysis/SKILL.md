---
name: cb-analysis
description: 可转债全链路分析技能包——筛选+分析+看板三引擎一体化 + 周度全景综合引擎。覆盖16大看板模块（强赎/下修/龙虎榜/配债安全垫/妖债监控等）、六维度深度分析（基本指标/正股联动/债底保护/时间价值/资金面/套利信号）、智能自然语言筛选；周度引擎按 ISO 自然周聚合全市场存续转债——市场温度（中证转债指数）/市场规模与结构/估值全景（均价·溢价率·双低）/资金与情绪/双低策略池/综合研判（0-100分）。日度基于同花顺问财 OpenAPI（Python3 标准库零依赖），周度基于 Tushare Pro。
version: 1.1.0
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
  - id: cb-weekly
    description: "可转债周度综合引擎：全市场存续转债按 ISO 自然周聚合——市场温度（中证转债指数 000832.CSI 周涨跌/周均成交/近N周对比）/市场规模与结构（存续只数·总余额·新上市·退市·条款事件）/估值全景（均价·溢价率·双低·价格分档·双低策略池TOP10）/资金与情绪（周成交总额·周均日成交）/综合研判（0-100分评分·积极/风险信号/条款提示）；支持 --weeks 回溯与 --json 输出；日粒度能力见 cb-dashboard/cb-analyzer-single"

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
  env: ["IWENCAI_API_KEY", "TUSHARE_TOKEN"]
required-secrets:
  - IWENCAI_API_KEY
  - TUSHARE_TOKEN

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
  - name: weeks
    description: "周度引擎回溯周数（默认1=最近一周；2=含上周的指数对比）"
    required: false

tags:
  - cb
  - convertible-bond
  - iwencai
  - tushare
  - 可转债
  - 问财


package:
  type: python
  entry: scripts/cli.py
metadata:
  openclaw:
    version: "1.1.0"
    emoji: "📈"
    author: "kk-quant"
    category: "finance"
    tags:
      - cb
      - convertible-bond
      - iwencai
      - tushare
      - 可转债
      - 问财

---

# cb-analysis — 可转债全链路分析技能包

## 用途

对 A 股可转债做全链路分析：智能筛选（问财自然语言查询）/ 单只深度六维度分析 / 批量对比 /
16 大模块全景看板，以及 **可转债周度全景综合引擎**（全市场存续转债，ISO 自然周聚合），
供「可转债全景分析」场景的日度/周度维度使用。

## 执行方式

### 引擎1: select — 智能筛选（问财自然语言查询）

```bash
python3 scripts/cli.py select --query "转股溢价率低于10%的可转债"
python3 scripts/cli.py select --query "AAA级可转债" --limit 20
```

### 引擎2: analyze — 多维度深度分析

```bash
# 单只深度分析（六维度评分）
python3 scripts/cli.py analyze --mode single --bonds "精达转债"
# 批量横向对比
python3 scripts/cli.py analyze --mode compare --bonds "精达转债,立讯转债,天业转债"
```

### 引擎3: dashboard — 全景看板（16大模块）

```bash
python3 scripts/cli.py dashboard
python3 scripts/cli.py dashboard --module forced-redeem
python3 scripts/cli.py dashboard --module top10
python3 scripts/cli.py dashboard --module arbitrage
```

### 引擎4: 可转债周度全景综合引擎（Tushare Pro，ISO 自然周聚合）

```bash
cd /mnt/skills/public/cb-analysis/scripts/analysis-engine
python3 analyze_weekly_cb.py              # 最近一周（全市场可转债）
python3 analyze_weekly_cb.py --weeks 2    # 回溯两周（近 N 周指数对比）
python3 analyze_weekly_cb.py --json       # JSON 原始结果
```

周度口径：ISO 自然周聚合（周标签形如 2026-W31）；转股价值 = 100/转股价 × 正股收盘；
转股溢价率 = (转债收盘 − 转股价值)/转股价值；双低值 = 转债价格 + 转股溢价率（百分点）；
金额单位：cb_daily.amount 万元（÷1e4 → 亿元）、index_daily.amount 千元（÷1e5 → 亿元）、
cb_basic.remain_size 元（÷1e8 → 亿元）。综合研判 0-100 分：指数周涨跌 ±15、平均溢价率
变化 ∓10、双低水位 ±8、周均日成交 ±8，≥58 偏多 / ≤42 偏空 / 其余中性震荡。

## 数据源

- 日度引擎：同花顺问财 OpenAPI（`IWENCAI_API_KEY`，实时）
- 周度引擎：Tushare Pro（`TUSHARE_TOKEN`）——`cb_basic` / `cb_daily` / `cb_call` /
  `index_daily`（000832.CSI 中证转债指数）/ `daily`（正股行情）

## 注意事项

- 必须先配置 `IWENCAI_API_KEY`（日度）与 `TUSHARE_TOKEN`（周度）环境变量，否则数据网关返回空
- 周度引擎基于 Tushare 数据（T+1），日度引擎基于问财实时数据，两者口径不同，场景中按粒度选用
- 周粒度以 ISO 自然周聚合，跨年周标签形如 2026-W31
- 综合研判仅基于数据逻辑推演，不构成投资建议

tags:
  - cb
  - convertible-bond
  - iwencai
  - tushare
  - 可转债
  - 问财
---
