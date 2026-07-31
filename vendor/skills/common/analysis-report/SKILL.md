---
name: analysis-report
description: Use when a complete analysis, review, research, backtest, or dashboard deliverable must produce a Markdown structured report plus paired dark and light HTML dashboards
version: 2.3.0
author: kk-quant
license: MIT
category: report

package:
  type: knowledge-only
capabilities:
  - id: markdown-report-generation
    description: "生成 Markdown 结构化分析报告"
  - id: dashboard-generation
    description: "生成深色和浅色两份金融 HTML 数据看板"
  - id: chart-embedding
    description: "嵌入由 chart-visualization 官方脚本生成的主题匹配图表"

permissions:
  filesystem: true
  shell: true

requires:
  bins: ["python3", "node"]

metadata:
  openclaw:
    emoji: "📊"
    version: "2.3.0"
    author: "kk-quant"
    category: "report"
    tags:
      - report
      - analysis
      - markdown
      - html
      - dashboard
      - dark-theme
      - light-theme

tags:
  - report
  - analysis
  - markdown
  - html
  - dashboard
  - dark-theme
  - light-theme
---

# 分析报告技能

## 交付物

完整分析、复盘、研究、回测和看板类任务必须同时生成三份文件，缺一不可：

- `{basename}.md`
- `{basename}-dark.html`
- `{basename}-light.html`

Markdown 报告和两份 HTML 看板必须来自同一份分析数据。Markdown 侧重结构化文字分析，HTML 侧重数据可视化呈现；深浅两份 HTML 的差异只体现在页面主题和对应主题的图表 URL。

本技能不调用任何 Markdown 转 HTML 工具，也不使用 `md-to-html` 类技能。

## 执行链

1. 分析技能获取真实数据并整理结构化 JSON。
2. 为每个图表读取 `chart-visualization/references/generate_{type}.md`。
3. 严格按照参考文档构造 `tool` 和 `args`。
4. 对同一份图表数据生成两次：
   - 深色：`theme: "dark"`，背景色 `#101418`。
   - 浅色：`theme: "default"`，背景色 `#ffffff`。
5. 将两个 URL 和两套完整参数写入输入 JSON。
6. 执行本技能内置渲染器，同时生成 Markdown 报告和深浅两份 HTML 看板：

```bash
python3 scripts/render_report.py \
  --input report.json \
  --output-dir . \
  --basename 2026-07-25_market-analysis
```

渲染器在写文件前会校验图表契约；校验失败必须修正参数，禁止绕过校验或自行改写图表字段。渲染成功后必须在最终答复中列出三份文件路径。

## 输入契约

```json
{
  "title": "本周市场联动分析",
  "generated_at": "2026-07-25 18:00",
  "summary": "核心结论",
  "assessment": "中性",
  "risk_level": "中",
  "data_overview": [
    {"metric": "综合评分", "current": "52", "change": "+2", "yoy": "—"}
  ],
  "core_analysis": ["分析结论一", "分析结论二"],
  "risks": ["风险一"],
  "references": ["数据来源"],
  "charts": [
    {
      "tool": "generate_line_chart",
      "title": "趋势",
      "alt": "趋势图",
      "dark": {
        "url": "https://.../dark.png",
        "args": {
          "data": [
            {"time": "2026-07-20", "value": 50}
          ],
          "theme": "dark",
          "style": {"backgroundColor": "#101418"},
          "title": "趋势",
          "axisXTitle": "日期",
          "axisYTitle": "数值"
        }
      },
      "light": {
        "url": "https://.../light.png",
        "args": {
          "data": [
            {"time": "2026-07-20", "value": 50}
          ],
          "theme": "default",
          "style": {"backgroundColor": "#ffffff"},
          "title": "趋势",
          "axisXTitle": "日期",
          "axisYTitle": "数值"
        }
      }
    }
  ]
}
```

完整看板至少包含 3 个图表。深浅主题的 `data` 必须完全一致；只能改变主题、背景和必要的配色。

## 图表字段纪律

图表字段以 `chart-visualization/references/` 中的官方参考文档为唯一依据。
不要根据业务习惯自行替换字段名。

常用必填维度：

| 工具 | 必填字段 |
|------|----------|
| `generate_line_chart` / `generate_area_chart` | `data[].time`, `data[].value` |
| `generate_bar_chart` / `generate_column_chart` / `generate_funnel_chart` | `data[].category`, `data[].value` |
| `generate_radar_chart` | `data[].name`, `data[].value` |
| `generate_scatter_chart` | `data[].x`, `data[].y` |
| `generate_sankey_chart` | `data[].source`, `data[].target`, `data[].value` |
| `generate_dual_axes_chart` | `categories`, `series[].type`, `series[].data` |
| `generate_histogram_chart` | `data[]`，每项为 number |
| `generate_liquid_chart` | `percent`，范围 `[0,1]` |
| `generate_spreadsheet` | `data[]` |

例如，折线图必须使用 `time/value`，不能自行改成 `date/score`；
柱状图必须使用 `category/value`，不能改成 `name/amount`。

调用图表脚本时必须使用：

```bash
node chart-visualization/scripts/generate.js \
  '{"tool":"generate_line_chart","args":{"data":[{"time":"2026-07-20","value":50}],"theme":"dark","style":{"backgroundColor":"#101418"},"title":"趋势"}}'
```

禁止：

- 自行编写图表绘制代码；
- 使用未在对应参考文档出现的顶层参数；
- 把 `date`、`score`、`name`、`amount` 等业务字段直接当成官方字段；
- 用深色页面嵌入浅色图表，或用浅色页面嵌入深色图表；
- 伪造图表 URL、数据或图表生成成功结果。

## Markdown 报告结构

Markdown 报告必须包含：

1. 执行摘要
2. 数据概览
3. 核心分析
4. 风险提示
5. 参考资料
6. 免责与风险提示

禁止在 Markdown 报告中给出买入、卖出、持有等交易建议；只能给出研究结论、情景条件、风险等级和需跟踪指标。

## 输出自检

- [ ] 已生成 `{basename}.md` Markdown 结构化报告；
- [ ] 已生成 `{basename}-dark.html` 和 `{basename}-light.html` 两份 HTML 数据看板；
- [ ] 三份文件使用同一份分析数据；
- [ ] 深色 HTML 只嵌入深色图表 URL，图表参数含 `theme: "dark"`；
- [ ] 浅色 HTML 只嵌入浅色图表 URL，图表参数含 `theme: "default"`；
- [ ] 支持背景色的图表分别使用 `#101418` 和 `#ffffff`；
- [ ] 至少 3 个图表；
- [ ] 每个图表字段均来自对应 `chart-visualization` 参考文档；
- [ ] 所有数据来源、日期和数据缺口均在看板正文中标明。

以上分析基于公开数据与逻辑推演，不构成投资建议。
