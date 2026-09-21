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

## 阶段五：归档策略库（必做，交付后收口）

把本次策略回测沉淀为「策略库」资产——工作台侧栏「策略库」面板可随时
回看净值曲线叠加、跨版本对比、重跑。引擎本机 `http://127.0.0.1:18001`，
三步（均 curl POST，失败不阻塞交付）：

```bash
# 1 建策略（hypothesis=一句话策略逻辑假设）
STRATEGY_ID=$(curl -s -X POST http://127.0.0.1:18001/kstock-api/strategies \
  -H 'content-type: application/json' \
  -d '{"name":"双均线趋势","hypothesis":"20日上穿60日做多，A股日线趋势跟随"}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["strategy_id"])')

# 2 存代码版本（code=策略信号/回测核心代码全文，≤512KB，落
#    signal_engine.py 记 sha256 链；params=均线窗口/费率等参数）
curl -s -X POST http://127.0.0.1:18001/kstock-api/strategies/$STRATEGY_ID/versions \
  -H 'content-type: application/json' \
  -d @- <<'EOF'
{"code":"（策略信号/回测核心代码全文贴入此处）",
 "params":{"fast":20,"slow":60,"commission":0.001},
 "change_note":"初版：20/60 双均线"}
EOF

# 3 存回测结果（metrics=面板渲染六键；equity=净值序列 ≤2MB；
#    trades=交易清单 ≤4MB；rules 带 report_id 建看板链）
curl -s -X POST http://127.0.0.1:18001/kstock-api/strategies/$STRATEGY_ID/runs \
  -H 'content-type: application/json' -d @- <<'EOF'
{"version":1,"data_start":"2024-09-20","data_end":"2026-09-18",
 "rules":{"universe":"中证800","benchmark":"000300.SH",
          "report_id":"report-xxxxxxxxxxxx（阶段四归档返回的 id）"},
 "metrics":{"total_return_pct":32.5,"annual_return_pct":15.8,
            "sharpe_ratio":1.21,"max_drawdown_pct":-18.3,
            "win_rate_pct":54.2,"trade_count":87},
 "equity":"（净值序列 JSON 贴入：[{date,equity}] 或 {dates,values}）",
 "trades":"（交易清单 JSON 贴入）"}
EOF
```

- **多策略研究**（一次对比 N 个策略/参数组）：每策略建独立资产，
  name 带标识区分（如「双均线·20/60」「双均线·5/20」）；禁止因
  "策略多"整体跳过归档只交报告；
- **重跑同一策略**：不要 POST 新策略——`PATCH /kstock-api/strategies/{id}`
  更新 hypothesis；代码或参数变化时 POST 新版本（sha256 变才换版）；
  run 一律挂当前版本；
- metrics 面板渲染键（**漏了对应列显示「—」**）：`total_return_pct` /
  `annual_return_pct` / `sharpe_ratio` / `max_drawdown_pct` /
  `win_rate_pct` / `trade_count`；漏检可事后 UPDATE metrics_json 补；
- equity 兼容 `[{date,equity}]` 与 `{dates,values}`（面板归一后叠加）；
- 引擎不可达时在最终回复里明说「未归档策略库」，其余交付照常。

## 输出纪律（强约束）

- metrics 数值**原样转述**；demo(MOCK) 结果不得出现在结论里；
- 回测口径必须注明（窗口/费率/滑点/A 股规则/复权）；
- 过拟合警示：参数扫描最优点必须附走前验证或样本外结果；
- 缺失诚实标注；结论带数据日期；全文为研究参考口径，不构成投资建议。
