---
name: a-stock-screener
description: |
  A 股对话式选股助手 (Orchestrator Pattern) —— 用户用自然语言描述"想要什么样的股票"，
  本 skill 解析意图 → 选择策略 → 拉取数据 → 套用过滤 → 多因子打分 → 输出选股报告。
  内置 10 种经典选股策略（价值/高股息/成长/动量/技术突破/超跌反弹/涨停龙头/机构资金追踪/
  缠论背驰/多因子横截面），工作流五阶段编排，支持无网络 mock 模式离线运行。
  适用于 stock-analysis / factor-research / selection-strategies / data-fetch
  等 skill 的上层"选股入口"场景。
version: 1.0.1
author: kk-quant
license: MIT
category: finance
keywords: stock-screener, a-share, orchestrator, natural-language, selection, screening, factor

capabilities:
  - id: intent-parsing
    description: "自然语言 → 策略意图解析：识别策略类型、市值范围、行业、TopN 等参数"
  - id: strategy-registry
    description: "策略注册中心：内置 10 种选股策略，支持按关键词/参数动态匹配"
  - id: workflow-orchestration
    description: "5 阶段工作流编排：意图确认→数据获取→策略过滤→因子打分→报告生成"
  - id: data-adapter
    description: "数据适配层：封装 tushare/AKShare/iWencai 等数据源，提供统一 pandas DataFrame 接口"
  - id: multi-factor-ranking
    description: "多因子打分排序：Z-score 标准化 + 加权求和 + TopN"
  - id: report-generation
    description: "结构化报告输出：调用内置 render_html_report 工具生成离线 HTML 看板"
  - id: mock-mode
    description: "无网络 mock 模式：生成伪 A 股数据用于离线测试与冒烟验证"
  - id: cli-entry
    description: "命令行入口：python -m scripts.cli --query '<自然语言>' --top 10"

permissions:
  network: true
  filesystem: true
  shell: true
  env:
    - TUSHARE_TOKEN

requires:
  bins: ["python3"]
  packages: ["pandas", "numpy"]
required-secrets:
  - TUSHARE_TOKEN
  - IWENCAI_API_KEY

inputs:
  - name: query
    type: string
    required: true
    description: "用户的自然语言选股请求，如 '高股息低估蓝筹股' / '创业板成长股' / '涨停板龙头'"
  - name: top_n
    type: integer
    required: false
    description: "返回结果数量，默认 10"

tags:
  - finance
  - stock-screener
  - A-share
  - orchestrator
  - factor
  - selection


package:
  type: python
  entry: scripts/data_adapter.py
metadata:
  openclaw:
    emoji: "🧭"
    version: "1.0.1"
    author: "kk-quant"
    category: "finance"
    tags:
      - finance
      - stock-screener
      - A-share
      - orchestrator
      - factor
      - selection
    requires:
      bins: ["python3"]
      packages: ["pandas", "numpy"]
    install:
      - id: pip-deps
        kind: pip
        package: "pandas numpy"
        python: python3
---

# a-stock-screener 使用说明

A 股对话式选股（Orchestrator Pattern）：用户用自然语言描述"想要什么样的股票"，
本 skill 解析意图 → 匹配策略 → 拉取数据 → 多因子打分 → 输出选股结果。

## 运行方式

```bash
cd /mnt/skills/public/a-stock-screener/scripts
python3 cli.py --query "高股息低估蓝筹股" --top 10        # 问财+Tushare 真实数据
python3 cli.py --query "创业板成长股" --top 20 --mock     # 无网络冒烟
```

数据源：问财（IWENCAI_API_KEY）优先，Tushare 兜底；`--mock` 走内置伪数据。

## 模糊意图澄清（强制）

当用户请求**笼统**（如「帮我选股」「选几只股票」「推荐一下」），未给出任何可执行
参数（策略/市值/股票池/数量）时，必须先调用 `ask_clarification` 收集意图，
`fields` 使用下方模板**原样传递**（不得增删字段、不得改写选项文案）：

```json
{
  "question": "想按什么条件选股？请选择策略与范围（不填的项使用默认值）：",
  "clarification_type": "ambiguous_requirement",
  "fields": [
    {"name": "strategy", "label": "选股策略（可多选）", "type": "multi_select", "required": true,
     "options": ["多因子横截面", "价值投资", "成长股", "高股息", "动量突破", "技术突破", "超跌反弹", "涨停龙头", "主力资金追踪", "缠论背驰"]},
    {"name": "market_cap", "label": "市值范围", "type": "select", "required": false,
     "options": ["不限制", "大盘(>200亿)", "中盘(50-200亿)", "小盘(20-50亿)", "微盘(<20亿)"]},
    {"name": "pool", "label": "股票池", "type": "select", "required": false,
     "options": ["全部A股", "沪深300", "中证500", "中证1000", "上证50", "创业板"]},
    {"name": "top_n", "label": "返回数量 TopN", "type": "number", "required": false, "placeholder": "默认 10"},
    {"name": "sort_by", "label": "排序偏好", "type": "select", "required": false,
     "options": ["综合评分", "股息率", "市盈率", "市净率", "涨跌幅"]}
  ]
}
```

用户确认后返回形如「选股策略: 高股息、价值投资\n市值范围: 大盘(>200亿)\n…」的文本：

1. **策略多选** → 将每个策略的关键词拼入 `--query`（如 `--query "高股息 价值投资 大盘蓝筹"`），
   或并行调用 selection-strategies 对应脚本，汇总时标注多策略交集；
2. **数量** → `--top <N>`；**市值/股票池** → 拼入 `--query`（问财自然语言可解析），
   或加 selection-strategies 脚本参数（`--market-cap large|mid|small`、
   `--pool hs300|zz500|zz1000`、`--stock-pool gem`）；脚本不支持的选项（微盘/上证50）
   回退最接近值并在报告注明；
3. 用户明确表示「你来定」→ 默认 `--query "多因子精选"`，TopN 10。

## 注意事项

- 表单字段上限 16 个、每字段 24 选项、单字段 200 字符，模板在限内，禁止自行扩增；
- 金额/市值等数值字段保持用户原文，禁止改写口径；
- 输出必须包含：命中清单（代码/名称/评分/关键指标）+ 多策略交集（共振）+ TopN 建议。
