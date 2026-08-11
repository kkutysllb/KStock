---
name: option-futures-linkage
description: 期指期权联动分析引擎——以沪深300/上证50/中证500/中证1000四大期指为轴，联动其对应期权（SSE 300ETF/50ETF/500ETF期权 + CFFEX MO中证1000股指期权）的认沽认购（成交量/持仓量PCR）、波动率（ATM IV/加权IV，BS反解）、IV斜率（认沽/认购端回归、Risk Reversal）、认沽认购IV差等期权维度与期指趋势/基差/持仓维度做5维联动信号分析（共振/背离），输出日粒度/周粒度双粒度联动报告与分品种评分。
version: 1.1.0
author: kk-quant
license: MIT
category: finance


package:
  type: python
  entry: scripts/analysis-engine/analyze_option_futures.py
capabilities:
  - id: daily-option-futures-linkage
    description: "日度期指期权联动分析：最新交易日期权维度（认沽认购PCR、ATM/加权IV、IV斜率、RR、认沽认购IV差）× 期指维度（趋势/基差/持仓）× 5维联动信号与评分"
  - id: weekly-option-futures-linkage
    description: "周度期指期权联动分析：按自然周聚合周均PCR/周均IV、周涨跌幅/周基差/周持仓变化，最新交易日IV斜率快照，周度联动信号与评分"
  - id: option-dimension
    description: "期权维度分析：认沽认购成交量/持仓量PCR、BS反解隐含波动率（ATM/加权）、IV斜率（认沽/认购端回归）、Risk Reversal、认沽认购IV差、活跃合约IV明细"
  - id: futures-dimension
    description: "期指维度分析：主力合约识别、均线趋势、持仓变化、基差贴升水信号"
  - id: linkage-analysis
    description: "联动信号分析：认沽认购比×趋势、波动率×涨跌、IV斜率×基差、认沽认购IV差×持仓、持仓PCR×基差 5维共振/背离信号，联动评分-6~+6与方向判断"
  - id: composite-judgment
    description: "综合研判：100分评分模型、品种分化对比、积极/风险信号、策略建议、小s总结"

permissions:
  network: true
  filesystem: true
  shell: true
  env:
    - TUSHARE_TOKEN

requires:
  packages: ["pandas", "numpy"]
  optionalPackages: ["scipy"]
  bins: ["python3"]
  env: ["TUSHARE_TOKEN"]
required-secrets:
  - TUSHARE_TOKEN

inputs:
  - name: query
    type: string
    required: true
    description: "分析需求，如'期指期权联动分析'、'期权PCR分析'、'IV斜率'、'周度联动'"

metadata:
  openclaw:
    emoji: "🔗"
    version: "1.1.0"
    author: "kk-quant"
    category: "finance"
    tags:
      - finance
      - options
      - futures
      - option-futures-linkage
      - implied-volatility
      - PCR
      - quantitative-analysis
      - A-share
      - tushare
    requires:
      bins: ["python3"]
      env: ["TUSHARE_TOKEN"]
    install:
      - id: pip-deps
        kind: pip
        package: "tushare pandas numpy scipy pydantic"
        python: python3
        label: "Install Python dependencies"
      - id: pip-optional-scipy
        kind: pip
        package: "scipy"
        python: python3
        optional: true
        label: "Optional: scipy for higher-precision IV inversion (auto-fallback to pure-Python Newton-Raphson if absent)"
      - id: setup-env
        kind: manual
        instructions: "请配置环境变量 TUSHARE_TOKEN（Tushare Pro API密钥）"
        label: "Configure API key"

tags:
  - finance
  - options
  - futures
  - option-futures-linkage
  - implied-volatility
  - PCR
  - quantitative-analysis
  - A-share
  - tushare
---

# 期指期权联动分析技能

## 用途

对四大期指品种（IF/IH/IC/IM）做 **期权 × 期指联动分析**，从认沽认购、波动率、IV斜率、PCR 等期权维度与期指行情/基差/持仓维度交叉验证，识别共振与背离信号，输出日粒度 / 周粒度双维度报告。

## 品种映射（期指 → 期权标的）

| 期指 | 现货指数 | 期权标的 | 交易所 |
|------|----------|----------|--------|
| IF（沪深300） | 000300.SH | 300ETF 期权（510300.SH） | SSE |
| IH（上证50） | 000016.SH | 50ETF 期权（510050.SH） | SSE |
| IC（中证500） | 000905.SH | 500ETF 期权（510500.SH） | SSE |
| IM（中证1000） | 000852.SH | MO 中证1000 股指期权（000852.SH 指数为标的） | CFFEX |

> 注：CFFEX 股指期权仅 IO/HO/MO 三个品种（无中证500 股指期权），中证1000 无 ETF 期权，故 IC 用 500ETF 期权、IM 用 CFFEX MO，属混合映射方案。

## 数据源（Tushare Pro API）

- `opt_basic(exchange=)`：期权合约基础信息（按交易所拉全量后本地按 opt_code 过滤；**不支持 opt_code 参数**）
- `opt_daily(exchange=, start_date=, end_date=)`：期权日行情（区间全市场；**无 IV 字段**，隐含波动率由 BS 公式 + brentq 反解）
- `fund_daily` / `index_daily`：ETF / 指数价格（**不支持 trade_date 单日参数，必须用区间**）
- `fut_mapping` / `fut_daily`：期指主力合约与行情

## 执行方式

```bash
# 日粒度（默认全部品种，回溯30天）
cd /mnt/skills/public/option-futures-linkage/scripts/analysis-engine
python3 analyze_option_futures.py
python3 analyze_option_futures.py --symbols IF IM --days 5
python3 analyze_option_futures.py --json

# 周粒度（默认最近1周）
python3 analyze_weekly_option_futures.py
python3 analyze_weekly_option_futures.py --symbols IF IH --weeks 2
python3 analyze_weekly_option_futures.py --json
```

报告章节（日粒度）：一、市场概览 → 二、逐品种联动分析（期权维度 / 期指维度 / 联动信号）→ 三、分品种联动对比 → 四、综合研判 → 五、投资建议 → 六、小s的总结。
周粒度同构，期权指标为周均聚合（周均PCR/周ATM IV/周加权IV），期指为周涨跌幅/周基差/周持仓变化，另附周内每日期权指标明细表。

## 联动信号（5 维，评分 -6 ~ +6）

| 维度 | 期权侧信号 | 期指侧信号 | 共振判据 |
|------|-----------|-----------|----------|
| 认沽认购比×趋势 | 成交量PCR（>1.2偏空 / <0.8偏多） | 均线趋势 | 偏空PCR+空头趋势 → 共振偏空(-2) |
| 波动率×涨跌 | 加权IV（>30高 / <18低） | 当日/周涨跌 | IV高+下跌 → 恐慌加剧(-1) |
| IV斜率×基差 | Risk Reversal（认沽-认购IV） | 基差贴升水 | 认沽贵+贴水 → 双偏空共振(-2) |
| 认沽认购IV差×持仓 | ATM 认沽-认购 IV 差 | OI 变化 | 增仓+认沽IV高 → 空头力量增强(-1) |
| 持仓PCR×基差 | 持仓量PCR | 基差贴升水 | 偏空持仓PCR+贴水 → 共振偏空(-1) |

联动评分 ≤-3 偏空 / ≥3 偏多 / ±1~2 略偏空多 / 0 中性。期权/期指/联动三侧加权得 0-100 综合分。

## 注意事项

- 必须先配置 TUSHARE_TOKEN 环境变量，否则数据网关返回空
- opt_daily 区间一次可拉全市场（SSE 数千行/CFFEX 千余行），本地按 opt_code 过滤合约
- BS 反解仅对 vol>0 且 settle>内在价值的活跃合约进行，深度实值合约 IV 缺失属正常
- 周粒度以 ISO 自然周聚合，跨年周标签形如 2026-W31
