---
name: chan-stock-theme
description: |
  缠论个股与选股场景（编排手册）。用户问「缠论分析 / 笔段中枢 / 背驰 /
  三类买卖点 / MACD 背驰选股」等缠论类问题时触发。编排 stock-analysis 的
  缠论双引擎（analyze_stock_chan 单股全息形态 / run_chan_stock_selector
  全池背驰选股）+ chart-visualization 图表 + html-report 看板交付与
  报告库归档。产出：单文件 HTML 缠论看板。
license: MIT
category: finance
version: 2.0.0
author: kk-quant
tags:
  - 缠论
  - 技术分析
  - 背驰选股
  - 场景编排

package:
  type: knowledge-only
metadata:
  openclaw:
    emoji: "📐"
    version: "2.0.0"
    author: "kk-quant"
    category: "finance"
    tags:
      - 缠论
      - 技术分析
      - 背驰选股
      - 场景编排
---

# 缠论个股与选股场景（编排手册）

本技能是**场景编排层**：以 stock-analysis 技能的缠论双引擎为主轴，完成
单股缠论全息分析或全池背驰选股并交付 HTML 看板。**产物分区纪律**见
sandbox-path-guide——引擎输出一律落 `data/`、报告落 `reports/`，从
工作区根执行。

## 触发条件

- 「缠论分析 XX」「XX 的笔/段/中枢」「背驰」「三类买卖点」→ 单股分析；
- 「缠论选股 / 背驰选股 / MACD 背驰的股票」→ 全池选股；
- 普通技术分析问题不触发本场景（走 analyze_technical）。

## 粒度选择

| 用户问法 | 路径 | 命令 |
|---|---|---|
| 点名个股 / 笔段中枢 / 买卖点 | 单股全息 | `analyze_stock_chan.py --stock <代码或名称> --level daily --json` |
| 选股 / 池扫描 | 全池背驰选股 | `run_chan_stock_selector.py --pool hs300 --top N --json` |

`--levels` 可多周期（如 `--levels 30min,daily,weekly`）；选股池：
all/hs300/zz500/zz1000/gz2000/zza500。

## 阶段一：数据采集（必做）

先在工作区根 `mkdir -p data reports`；基目录 = stock-analysis 技能加载
结果给出的 Base directory。

1. **单股**（实测 242 根日 K → 31 分型/笔/中枢/MACD 背驰全结构）：

   ```bash
   python3 "<stock-analysis 基目录>/scripts/analyze_stock_chan.py" \
     --stock 000001 --level daily --json > data/chan-<代码>.json
   ```

2. **全池选股**（hs300 = 300 只逐只拉 K 线 × Tushare 限速，实测 10 分钟
   级——**必须 run_in_background 后台化**，期间先搭报告骨架；收齐后
   `job_output` 校验退出码再解析）：

   ```bash
   python3 "<stock-analysis 基目录>/scripts/run_chan_stock_selector.py" \
     --pool hs300 --top 20 --json > data/chan-select.json
   ```

依赖：TUSHARE_TOKEN + pandas/dotenv（壳已注入/引导安装；缺则按「无数据」
口径处理，禁止编造）。

## 阶段二：解读

- 单股：morphology（K 线/分型/笔计数）→ 中枢区间 → 动力学（MACD 背驰
  信号）→ 买卖点分级，按引擎 JSON 结构逐层转述；
- 选股：信号表按 买/卖 分组，结合 `--signal buy` 收窄；头部标的可对
  top 5 逐只补单股全息分析（并行采集落 data/）。

## 阶段三：报告交付（必做）

1. html-report 契约构造 `reports/report.json`：
   - 评分卡：单股（当前级别/中枢区间/买卖点）或选股（买/卖信号计数）；
   - 图表：笔段结构示意（用 chart-visualization 或引擎 --save 输出图）、
     MACD 背驰对照（line/bar）；选股场景为信号强度 TOP20（bar）；
   - 分节正文：形态结构 / 中枢与买卖点 / 背驰信号 / 操作参考位；
   - 风险提示与参考来源（Tushare + 数据日期）；
2. 渲染 `-o reports/chan-<代码或池名>.html`，归档报告库，present 呈现。

## 输出纪律（强约束）

- 笔/段/中枢/买卖点等结构数值**原样转述**，禁止改写或省略中枢区间；
- 买卖点必须带级别（30min/daily/weekly）与确认条件，禁止脱离级别谈点位；
- 全池选股注明池与扫描窗口（长任务后台化执行）；
- 缺失诚实标注「无数据」及原因；结论带数据日期；全文为研究参考口径，
  不构成投资建议。
