---
name: strategy-backtest-theme
description: |
  策略研究回测场景（编排手册）。用户问「写个策略回测 / 双均线策略表现 /
  参数扫描 / 走前验证」等策略研究类问题时触发。编排 strategy-research
  （SignalEngine 合约 + 回测引擎库 + 内置三模板）+ 自建 driver 拉真实数据
  + html-report 回测报告与报告库归档。产出：单文件 HTML 回测看板。
license: MIT
category: finance
version: 2.0.0
author: kk-quant
tags:
  - 策略回测
  - 量化策略
  - 场景编排

package:
  type: knowledge-only
metadata:
  openclaw:
    emoji: "🧪"
    version: "2.0.0"
    author: "kk-quant"
    category: "finance"
    tags:
      - 策略回测
      - 量化策略
      - 场景编排
---

# 策略研究回测场景（编排手册）

本技能是**场景编排层**：按 SignalEngine 合约写策略、用回测引擎库跑真实
数据、参数扫描/走前验证进阶，交付回测看板。**产物分区纪律**见
sandbox-path-guide——策略代码落 `scripts/`、数据落 `data/`、报告落
`reports/`，从工作区根执行。

## 触发条件

- 「写个 XX 策略回测」「双均线/RSI/MACD 策略表现」「参数寻优」「走前验证」；
- 纯选股不触发（走选股流水线）；纯因子检验走 factor-research。

## 引擎形态（重要，2.0 与 1.x 的差异）

- `cli.py demo`（dual_ma/rsi/macd）用的是**合成 MOCK 数据**——只用于
  验证参数链路与演示，**禁止作为回测结论**；
- 真实回测 = 自建 driver 脚本调 `analysis/backtest_engine.py` 的
  `run_backtest()`（库形态，含 A 股涨跌停/手续费/滑点规则）；
- `cli.py validate --file` 校验自写策略语法；`cli.py list` 列内置模板；
  模板参考 `<基目录>/scripts/templates/signal_engine_template.py`，
  合约与示例 `<基目录>/references/strategy-examples.md`。

## 阶段一：策略编写（必做）

1. `skill` 加载 strategy-research，记基目录；
2. 写 `scripts/config.json`（标的/日期/资金/费率）与
   `scripts/signal_engine.py`（按 SignalEngine 合约，从模板起步）：

   ```json
   {"source": "tushare", "codes": ["000001.SZ"], "start_date": "2025-01-01",
    "end_date": "2025-12-31", "initial_cash": 1000000, "commission": 0.001}
   ```

3. 语法校验：

   ```bash
   python3 "<strategy-research 基目录>/scripts/cli.py" validate \
     --file scripts/signal_engine.py
   ```

## 阶段二：真实数据回测（必做）

自建 driver `scripts/run_bt.py`（范式）：从 kk_common 网关拉 config 中
标的的日线 → 构造 data_map（{code: DataFrame}，index 日期，列
open/high/low/close/volume）→ import 策略 → 调
`analysis.backtest_engine.run_backtest` → metrics（总收益/年化/夏普/
最大回撤/胜率/交易次数）+ `evaluate_strategy` 评审落 `data/bt.json`。
kk_common 解析：`PYTHONPATH` 加 `<strategy-research 基目录>/../../common/src`
（或按脚本自身位置注入，参考其他引擎写法）。

- 回测分钟级以上窗口属长任务——run_in_background 后台化后收
  `job_output`；
- A 股规则（涨跌停/双向费率）默认开启，`--no-a-share-rules` 仅研究口径。

## 阶段三：进阶（可选，用户要「优化/稳健性」时）

- 参数扫描：`analysis/param_sweep.py`（run_param_sweep）；
- 走前验证：`analysis/walk_forward.py`（run_walk_forward）；
- 均以 driver 方式调用，输出落 `data/`。

## 阶段四：报告交付（必做）

1. html-report 契约构造 `reports/report.json`：评分卡（年化/夏普/回撤/
   胜率）、净值曲线 vs 基准（line）、参数扫描热力（bar）；分节正文 =
   策略逻辑 / 回测口径 / 结果 / 敏感性 / 风险；
2. 渲染 `-o reports/backtest-<策略名>.html`，归档报告库，present 呈现。

## 输出纪律（强约束）

- metrics 数值**原样转述**；demo(MOCK) 结果不得出现在结论里；
- 回测口径必须注明（窗口/费率/滑点/A 股规则/复权）；
- 过拟合警示：参数扫描最优点必须附走前验证或样本外结果；
- 缺失诚实标注；结论带数据日期；全文为研究参考口径，不构成投资建议。
