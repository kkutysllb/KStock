---
name: etf-analysis
description: ETF全维度分析技能包——双引擎驱动（Tushare Pro 量化数据层 + 问财实时筛选层），支持13项ETF分析维度（列表/行情/净值/份额/规模/五类分类/跟踪指数/行业ETF/横向对比/持仓/经理/分红）和自然语言智能筛选；标的池区分期权ETF与普通ETF：7大期权ETF（硬编码默认池，可联动期权维度）与普通ETF（用户输入代码，无期权维度），周度综合引擎按ISO自然周聚合，自动标注标的类型，开箱即用的跨平台技能包。
version: 1.2.0
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
  - id: etf-weekly
    description: "ETF周度综合引擎：期权ETF默认池（7大：510050/510300/510500/512100/159915/588000/159901）或用户自定义代码（--symbols，普通ETF无内置默认池），按ISO自然周聚合——周行情/周涨跌幅/周均成交额/份额净申赎/规模估算/横向对比/综合评分与背离信号，输出自动标注「期权ETF/普通ETF」类型；日粒度能力见 etf-daily/etf-shares/etf-scale"

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

---

# etf-analysis — ETF 全维度分析技能包

## 用途

对 A 股 ETF 做全维度分析：列表/行情/净值/份额/规模/分类/筛选/指数/行业/对比/持仓/经理/分红，
以及 **ETF 周度综合引擎**（期权 ETF 默认池 7 大：上证50ETF / 沪深300ETF / 中证500ETF /
中证1000ETF / 创业板ETF / 科创50ETF / 深100ETF；普通 ETF 由用户输入代码），供
「期权ETF专题分析」「普通ETF专题分析」场景的 ETF 维度使用。

## 标的池区分（期权ETF vs 普通ETF）

| 维度 | 期权ETF | 普通ETF |
|------|---------|---------|
| 定义 | 具备场内期权的宽基 ETF | 无对应场内期权的 ETF（行业/主题/跨境/商品/其他宽基） |
| 默认池 | 硬编码 7 大（510050/510300/510500/512100/159915/588000/159901），与 market-linkage-engine 的 OPTION_ETFS 一致 | 不设默认池，由用户输入代码 |
| 分析维度 | 行情/成交额/份额 + 可联动期权维度（PCR/IV/RR） | 仅 ETF 自身维度（行情/成交额/份额） |
| 周度执行 | `python3 analyze_weekly_etf.py`（不带参数） | `python3 analyze_weekly_etf.py --symbols <代码,代码>` |
| 类型标注 | 自动标注「期权ETF」 | 自动标注「普通ETF」（名称回退为代码） |

判断规则：代码在 OPTION_ETFS 池内 → 期权ETF；否则 → 普通ETF。用户请求分析某只/某组 ETF
时，先判断标的是否属于 7 大期权 ETF，再选择对应执行方式与维度范围。

## 执行方式

### 引擎1: tushare — Tushare Pro ETF 分析（T+1 数据）

```bash
python3 scripts/cli.py tushare list --params market=E limit=20
python3 scripts/cli.py tushare daily --params ts_code=510300.SH start_date=2026-01-01
python3 scripts/cli.py tushare shares --params ts_code=510300.SH limit=60
python3 scripts/cli.py tushare scale --params ts_code=510300.SH
python3 scripts/cli.py tushare compare --params ts_codes=510300.SH,159919.SZ,510500.SH
```

### 引擎2: selector — 问财智能选ETF（实时数据）

```bash
python3 scripts/cli.py selector --query "沪深300ETF有哪些？"
```

### 引擎3: ETF 周度综合引擎（ISO 自然周聚合，双标的池）

```bash
# 期权 ETF（默认池，7 大全覆盖）
cd /mnt/skills/public/etf-analysis/scripts/analysis-engine
python3 analyze_weekly_etf.py
# 普通 ETF（用户输入代码，可混搭，自动标注类型）
python3 analyze_weekly_etf.py --symbols 512880.SH,518880.SH
python3 analyze_weekly_etf.py --symbols 510300.SH,512880.SH
python3 analyze_weekly_etf.py --weeks 2
python3 analyze_weekly_etf.py --json
```

周度口径：周涨跌幅 = 周内末收盘/周内首收盘 - 1；周均成交额 = 周内每日均值（Tushare 金额为千元，已换算亿元）；
份额变化 = 周末份额 - 周初份额（亿份，正=资金净流入/负=净流出）；价格×份额背离信号（价涨份额减=资金不追高；
价跌份额增=逢低布局）。普通 ETF（--symbols 传入且不在期权池内）自动标注「普通ETF」且无期权联动维度。

## 数据源（Tushare Pro API）

- `fund_basic`：ETF 列表与基础信息（五类分类标签）
- `fund_daily`：日行情（金额单位为千元，换算亿元需 ÷1e5）
- `fund_share`：份额（fd_share 单位为万份，换算亿份需 ÷1e4）
- `fund_nav`：净值
- `fund_portfolio` / `fund_manager` / `fund_div`：持仓/经理/分红

## 注意事项

- 必须先配置 TUSHARE_TOKEN 环境变量，否则数据网关返回空
- 期权 ETF 默认池硬编码 7 大，与 market-linkage-engine 的 OPTION_ETFS 口径一致
- 普通 ETF 不设默认池：用户输入代码（周度 `--symbols`，日度 `cli.py tushare daily --params ts_code=<代码>`），脚本自动标注类型
- 周粒度以 ISO 自然周聚合，跨年周标签形如 2026-W31

tags:
  - finance
  - ETF
  - A-share
  - tushare
  - iwencai
---
