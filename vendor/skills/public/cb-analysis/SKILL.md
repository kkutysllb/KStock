---
name: cb-analysis
description: 可转债全链路分析技能包——筛选+分析+看板+周度+Tushare数据层五引擎一体化。覆盖16大看板模块（强赎/下修/龙虎榜/配债安全垫/妖债监控等）、六维度深度分析（基本指标/正股联动/债底保护/时间价值/资金面/套利信号）、智能自然语言筛选；周度引擎按 ISO 自然周聚合全市场存续转债——市场温度/规模与结构/估值全景/资金与情绪/双低策略池/综合研判（0-100分）；Tushare 数据层（cb_data.py）封装 8 个可转债接口 + 3 个聚合命令（个券全维度档案 profile / 条款时间线 terms / 到期收益率 ytm）。日度问财基于同花顺 OpenAPI（Python3 标准库零依赖），周度+数据层基于 Tushare Pro。
version: 1.2.0
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
  - id: cb-data
    description: "Tushare 可转债数据访问层：8 接口（basic/daily/issue/call/share/rate/rating/holders）+ 3 聚合命令（profile 个券全维度档案 / terms 条款时间线 / ytm 到期收益率），作为问财日度引擎的结构化深度补充源"
  - id: cb-profile
    description: "个券全维度档案：一次聚合基础信息+发行+转股进度+票面利率+评级+十大持有人+强赎历史+YTM，用于个券深度分析"
  - id: cb-terms
    description: "条款时间线：强赎公告历史（call_type + is_call 状态）+ 评级变迁 + 当前转股价（含下修判断），用于条款博弈分析"
  - id: cb-ytm
    description: "到期收益率测算：cb_rate 现金流贴现 + 二分法反解，输出年化 YTM，用于债性估值"

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
    version: "1.2.0"
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

### 引擎5: Tushare 数据访问层（cb_data.py，个券深度分析专用）

```bash
cd /mnt/skills/public/cb-analysis/scripts

# ── 8 个接口命令 ──
python3 cb_data.py basic --code 128044.SZ          # 基础信息（不传 code = 全量）
python3 cb_data.py daily --code 128044.SZ --start 20260801 --end 20260811  # 日线
python3 cb_data.py issue --code 128044.SZ          # 发行（规模/中签/原股东配售）
python3 cb_data.py call --code 128044.SZ           # 赎回（强赎/到期赎回，call_type+is_call 状态）
python3 cb_data.py share --code 128044.SZ          # 转股进度（累计转股率/剩余规模）
python3 cb_data.py rate --code 128044.SZ           # 票面利率分年限表
python3 cb_data.py rating --code 128044.SZ         # 评级历史
python3 cb_data.py holders --code 128044.SZ        # 十大持有人（最新一期）

# ── 3 个聚合命令（推荐用于个券深度分析） ──
python3 cb_data.py profile --code 128044.SZ        # 全维度档案（一次聚合所有接口 + YTM）
python3 cb_data.py terms --code 128044.SZ          # 条款时间线（强赎/评级/下修判断）
python3 cb_data.py ytm --code 128044.SZ            # 到期收益率（cb_rate 现金流贴现）
```

**Tushare 可转债接口清单与可用性**：

| 接口 | 状态 | 说明 |
|------|------|------|
| cb_basic | ✅ | 基础信息（27 字段，含 rate_clause 利率条款字符串） |
| cb_daily | ✅ | 日线行情 OHLCV |
| cb_issue | ✅ | 发行数据（23 字段，含网上中签/原股东配售） |
| cb_call | ✅ | 赎回信息（call_type 强赎/到赎，is_call 5 状态） |
| cb_share | ✅ | 转股结果（累计转股率/剩余规模/总股本） |
| cb_rate | ✅ | 票面利率（需 fields 显式取全字段，默认只返回 ts_code） |
| cb_rating | ✅ | 评级历史（评级/展望/评级机构） |
| top10_cb_holders | ✅ | 十大持有人（按报告期） |
| cb_factor_pro | ❌ | 需单独权限，未接入 |
| cb_price_chg | ❌ | 需单独权限，转股价变动可从 cb_share 推断 |
| yc_cb | ❌ | 需单独权限，YTM 用 cb_rate 自算 |

**与其他引擎的协同**：
- 问财日度引擎（selector/analyzer/dashboard）：实时性强，覆盖 16 大看板与自然语言筛选
- 周度引擎（analyze_weekly_cb.py）：ISO 自然周聚合，全市场维度
- **数据层（cb_data.py）**：结构化深度补充，专注**个券**——发行/转股进度/条款/YTM/持有人结构，
  与问财的六维度分析互补：问财给实时价格/溢价率/双低快照，数据层给条款历史/YTM/持有人变化

## 数据源

- 日度引擎：同花顺问财 OpenAPI（`IWENCAI_API_KEY`，实时）
- 周度引擎：Tushare Pro（`TUSHARE_TOKEN`）——`cb_basic` / `cb_daily` / `cb_call` /
  `index_daily`（000832.CSI 中证转债指数）/ `daily`（正股行情）
- 数据层（cb_data.py）：Tushare Pro——`cb_basic` / `cb_daily` / `cb_issue` / `cb_call` /
  `cb_share` / `cb_rate` / `cb_rating` / `top10_cb_holders`

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
