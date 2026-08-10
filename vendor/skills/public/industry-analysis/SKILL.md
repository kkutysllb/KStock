---
name: industry-analysis
description: A股行业六维一体深度分析引擎——结构层（产业链上中下游拆解）+数据层（行业估值/财务/盈利排名）+框架层（五模块产业链解读）+研究层（券商研报）+资讯层（实时财经资讯）+宏观框架层（全球宏观周期定位），开箱即用的跨平台技能包。
version: 2.0.1
author: kk-quant
license: MIT
category: finance


package:
  type: python
  entry: scripts/analyze_industry.py
capabilities:
  - id: industry-chain-analysis
    description: "产业链结构分析：上游/中游/下游拆解、核心公司识别、市值分布、PE、利润增长"
  - id: industry-data-query
    description: "行业数据查询：估值排名、财务指标、盈利数据、板块行情、涨跌幅排名"
  - id: industry-framework
    description: "五模块产业链解读框架：顶层评估→核心驱动→产业本质→产业链拆解→风险验证"
  - id: report-search
    description: "券商研报搜索：行业研究报告、机构评级、目标价、投资逻辑摘要"
  - id: news-search
    description: "行业资讯搜索：实时财经资讯、政策动态、技术突破、竞争格局、投融资"
  - id: global-macro
    description: "全球宏观框架：宏观周期定位、加息/降息周期行业映射、美元/地缘风险传导"
  - id: chart-visualization
    description: "行业图表可视化：前端ECharts图表配置（产业链桑基图、市值柱状图、行业饼图）"

permissions:
  network: true
  filesystem: true
  shell: true
  env:
    - IWENCAI_API_KEY

requires:
  packages: ["pandas", "pydantic", "pywencai"]
  bins: ["python3"]
  env: ["IWENCAI_API_KEY"]

required-secrets:
  - IWENCAI_API_KEY
inputs:
  - name: industry
    type: string
    required: true
    description: "行业名称，如 '新能源汽车'、'半导体'、'人工智能'、'商业航天'"
  - name: depth
    type: string
    required: false
    description: "分析深度：quick(快速评估)、standard(标准分析)、detailed(深度研判)"

metadata:
  openclaw:
    emoji: "🏭"
    version: "2.0.1"
    author: "kk-quant"
    category: "finance"
    tags:
      - finance
      - industry-analysis
      - industry-chain
      - A-share
      - fundamental-analysis
      - iwencai
      - pywencai
    requires:
      bins: ["python3"]
      env: ["IWENCAI_API_KEY"]
    install:
      - id: pip-deps
        kind: pip
        package: "pywencai pandas pydantic"
        python: python3
        label: "Install Python dependencies"

tags:
  - finance
  - industry-analysis
  - industry-chain
  - A-share
  - fundamental-analysis
  - pywencai
  - iwencai
---

# A股行业六维一体深度分析引擎

## 执行方式（先读这里）

**禁止自行编写数据分析脚本**：本技能提供现成 CLI，直接调用即可完成行业数据查询：

```bash
cd /mnt/skills/public/industry-analysis/scripts && python3 industry-query-cli.py --query "A股行业估值排名"
# 示例：--query "银行业盈利数据" / "新能源板块行情"
```

输出为问财 API 返回的行业数据条目。**先运行上面这行命令，把返回数据当作事实来源**；六维框架解读（产业链拆解、券商研报、资讯）基于此数据展开即可。禁止自行写 Python/curl 探测 API、禁止花多轮调试参数。若脚本报错，把错误信息原样转述给用户即可，不要尝试自行修复环境。数据缺失时如实说明「未查到」，**禁止编造数据**。

## 技能概述

本技能包提供完整的行业深度分析能力，整合六大核心维度：

1. **结构层** — 产业链上中下游拆解、核心公司识别（pywencai 实时数据）
2. **数据层** — 行业估值排名、财务指标、盈利数据、板块行情（问财 API）
3. **框架层** — 五模块产业链解读框架（顶层评估→驱动→本质→产业链→风险）
4. **研究层** — 券商研报搜索（机构评级、目标价、投资逻辑）
5. **资讯层** — 实时财经资讯（政策/技术/竞争/投融资动态）
6. **宏观框架层** — 全球宏观周期定位与行业映射

## 分析脚本

### 产业链分析脚本（`scripts/analyze_industry.py`）

基于 pywencai 实时获取产业链数据，支持：

```bash
# 标准分析
python3 scripts/analyze_industry.py "新能源汽车"

# 深度分析
python3 scripts/analyze_industry.py "人工智能" --depth detailed

# JSON 输出
python3 scripts/analyze_industry.py "半导体" --json

# 保存结果
python3 scripts/analyze_industry.py "光伏" --save

# 列出支持的热门行业
python3 scripts/analyze_industry.py --list
```

覆盖维度：
- 行业概览：概念股数量、市值分布、行业归属
- 产业链结构：上中下游环节拆解、核心公司
- 财务分析：营收、净利润增长、估值水平
- 风险提示：估值、政策、市场风险

### 行业数据查询 CLI（`scripts/industry-query-cli.py`）

通过问财 API 查询行业数据：

```bash
# 行业估值排名
python3 scripts/industry-query-cli.py --query "A股行业估值排名"

# 行业盈利数据
python3 scripts/industry-query-cli.py --query "银行业盈利数据"

# 板块行情
python3 scripts/industry-query-cli.py --query "新能源板块行情"
```

## 六维分析执行流程

### 阶段一：并行数据采集（4路并发）

**维度1: 结构层** — analyze_industry.py
- 产业链上中下游拆解
- 核心公司识别与市值分布
- PE/利润增长等财务指标

**维度2: 数据层** — industry-query-cli.py
- 行业估值排名
- 行业盈利数据
- 板块涨跌幅排名

**维度3: 研究层** — 问财研报搜索 API
- API: `POST https://openapi.iwencai.com/v1/comprehensive/search`
- Headers: `X-Claw-Skill-Id: report-search, X-Claw-Skill-Version: 2.0.0`
- Query: `"{行业名}行业研究报告"`

**维度4: 资讯层** — 问财经资讯搜索 API
- API: `POST https://openapi.iwencai.com/v1/comprehensive/search`
- Headers: `X-Claw-Skill-Id: news-search, X-Claw-Skill-Version: 1.0.0`

### 阶段二：五模块框架分析

使用产业链解读框架整合数据：

1. **行业整体评估与投资价值定调** — 五维度雷达评分
2. **核心驱动与长期确信** — 底层逻辑拆解，结合政策资讯验证
3. **产业本质与商业模式** — 传导路径与边界
4. **产业链全链路拆解与咽喉节点** — 结合 analyze_industry 结果
5. **宏观周期与行业映射** — 结合全球宏观框架
6. **核心风险与长期基本面跟踪** — 实时资讯+宏观风险预警

### 阶段三：图表生成

- **雷达图** — 行业五维评估（天花板/护城河/生命周期/竞争格局/政策顺风）
- **柱状图** — 行业估值排名对比
- **饼图** — 产业链各环节占比
- **桑基图** — 产业链上下游流转

### 阶段四：报告生成（内置 render_html_report 工具）

本技能**不自行编写报告或绘图代码**，而是调用内置 `render_html_report` 工具统一渲染。流程：

1. 将行业画像、估值排名、研报观点、实时资讯、产业链解读、宏观周期评估、风险与跟踪指标整理为报告 JSON，顶层字段：`title` / `generated_at` / `summary` / `assessment` / `risk_level` / `data_overview` / `core_analysis` / `risks` / `references` / `charts`。
2. 为每个图表按 `charts[].{tool, title, alt, args}` 结构构造，图表以内嵌 SVG 渲染，**禁止使用远程图片 URL**。至少 3 个图表。args 的完整字段规范以工具描述中的契约说明为准。
3. 调用 `render_html_report(report_json, filename="report.html")`；若完整 JSON 已保存为 `/mnt/user-data/workspace/*.json`，改用 `render_html_report_from_file(report_json_path="/mnt/user-data/workspace/report.json", filename="report.html")`，禁止先把大 JSON 读入上下文；渲染成功后用 `present_files` 交付。

报告覆盖：行业画像（五维雷达图 + 最新动态）、行业估值排名（柱状图）、投研观点摘要、行业实时资讯、产业链深度解读（桑基图/饼图）、宏观周期评估、风险与需跟踪指标。报告只给研究结论、情景条件、风险等级和需跟踪指标，**不给出买入/卖出/持有等交易建议**。

## 参考文档

| 文件 | 说明 |
|------|------|
| `references/industry-chain-framework.md` | 产业链解读五模块框架（V3.0） |
| `references/analysis-framework.md` | 详细分析方法论与双轨制产业链分析 |
| `references/output-template.md` | 标准化报告输出模板 |
| `references/data-sources.md` | 可靠数据源参考 |
| `references/global-macro.md` | 全球宏观周期分析框架 |
| `references/chart-specs.md` | 图表可视化规范 |

## 数据模型

`models/industry_models.py` 提供 Pydantic 数据模型：
- `IndustryChainNode` — 产业链节点
- `IndustryChainAnalysis` — 产业链分析结果
- `IndustryOverview` — 行业概览
- `StockInIndustry` — 行业内个股
- `IndustryAnalysisResult` — 完整分析结果

## 环境变量

| 变量 | 必填 | 说明 | 获取方式 |
|------|------|------|---------|
| `IWENCAI_API_KEY` | 是 | 同花顺问财API密钥 | https://www.iwencai.com/skillhub |

## Python 依赖

```
pywencai>=0.12.0
pandas>=2.0.0
pydantic>=2.0.0
```

## 数据来源标注

- 产业链数据标注「数据来源于同花顺i问财（pywencai）」
- 行业估值/财务数据标注「数据来源于同花顺问财」
- 研报数据标注来源机构
- 资讯数据标注「数据来源于同花顺问财」

## 注意事项

1. analyze_industry.py 依赖 pywencai 库，需单独安装
2. 行业分析需结合宏观周期阶段，不同周期下同一行业投资逻辑可能截然不同
3. 资讯层建议至少查询行业动态+政策两条，覆盖基本面和技术面
4. 分析结果仅供参考，不构成投资建议
