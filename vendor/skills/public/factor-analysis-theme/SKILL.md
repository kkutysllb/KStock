---
name: factor-analysis-theme
description: |
  因子检验流水线场景（编排手册）。用户问「检验这个因子 / IC/IR 分析 /
  分层回测 / 多因子选股 / 因子择时」等因子研究类问题时触发。编排
  factor-research 八命令（build 因子面板防前视 → analyze IC/IR+分层 →
  filter/multifactor/timing/combine）+ html-report 报告与报告库归档。
  产出：单文件 HTML 因子研究看板。
license: MIT
category: finance
version: 2.0.0
author: kk-quant
tags:
  - 因子挖掘
  - IC/IR
  - 分层回测
  - 场景编排

package:
  type: knowledge-only
metadata:
  openclaw:
    emoji: "⚗️"
    version: "2.0.0"
    author: "kk-quant"
    category: "finance"
    tags:
      - 因子挖掘
      - IC/IR
      - 分层回测
      - 场景编排
---

# 因子检验流水线场景（编排手册）

本技能是**场景编排层**：factor-research 的 CLI 八命令构成「面板构造 →
有效性检验 → 组合应用」三段流水线，交付因子研究看板。**产物分区纪律**
见 sandbox-path-guide——因子 CSV 与输出落 `data/`、自建脚本落 `scripts/`、
报告落 `reports/`，从工作区根执行。

## 触发条件

- 「检验这个因子」「IC/IR 怎么样」「分层回测」「六因子选股」「因子拥挤度」；
- 纯策略回测不触发（走策略回测场景）；纯选股走选股流水线。

## 命令地图（基目录 = factor-research 技能加载结果）

| 命令 | 用途 | 关键参数 |
|---|---|---|
| `build` | 因子面板构造（**防前视偏差**） | `--close <收盘价CSV>` `--benchmark <基准CSV 可选>` |
| `analyze` | IC/IR 分析 + 分层回测 | `--factor-csv` `--return-csv` `--n-groups 5` |
| `filter` | 基本面因子筛选（实测真数据） | `--codes 600519.SH,000001.SZ` `--pe-max --pb-max --roe-min` |
| `multifactor` | 六因子选股 | `--panel-dir <子指标面板目录>` + TopN |
| `timing` | 因子择时与拥挤度 | 面板目录 |
| `smallcap` / `combine` | 小盘成长 / 多因子组合 | 面板目录 |

CSV 契约：`--close/--factor-csv/--return-csv` 均为 **index=date、
columns=股票代码** 的宽表，先落 `data/` 再引用。

## 阶段一：数据与面板（必做）

1. `skill` 加载 factor-research，记基目录；
2. 行情面板：从 kk_common 网关拉标的池日线（自建 `scripts/fetch_close.py`
   产出 `data/close.csv`，宽表口径如上）；
3. 因子面板：`build` 从行情派生动量/波动率/换手/规模/β 等子指标
   （防前视），或用户自带因子 CSV 落 `data/factor.csv`；
4. 前瞻收益矩阵由 build 一并产出（检验的对齐基准）。

依赖：TUSHARE_TOKEN（壳已注入；缺则按「无数据」口径，禁止编造）。

## 阶段二：检验（必做）

```bash
B="<factor-research 基目录>/scripts/cli.py"
python3 $B analyze --factor-csv data/factor.csv --return-csv data/fwd.csv \
  --n-groups 5 --output-dir data/ > data/ic.json
```

- IC 序列 / IR / 分层收益与多空组合是有效性结论的三支柱，缺一不可；
- 大面板检验属长任务——run_in_background 后台化后收 job_output；
- 稳健性：换分组数（3/5/10）与窗口重跑，结论只在一致性下成立。

## 阶段三：组合应用（可选，用户要「落地选股」时）

`filter`（基本面约束）→ `multifactor`（六因子打分 TopN）→ `timing`
（拥挤度调仓提示），逐级收窄，输出均落 `data/`。

## 阶段四：报告交付（必做）

1. html-report 契约构造 `reports/report.json`：评分卡（IC 均值/IR/多空
   年化）、IC 时间序列（bar）、分层净值（line，G1..G5+多空）；分节正文 =
   因子定义 / 面板口径（防前视）/ 检验结果 / 稳健性 / 组合应用；
2. 渲染 `-o reports/factor-<因子名>.html`，归档报告库，present 呈现。

## 输出纪律（强约束）

- IC/IR/分层数值**原样转述**，禁止改写或只报最优层；
- 面板口径必须注明（构造窗口/复权/防前视处理）；
- 因子有效但拥挤（timing 高位）必须显式警示；
- 缺失诚实标注「无数据」及原因；结论带数据日期；全文为研究参考口径，
  不构成投资建议。
