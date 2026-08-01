---
name: analysis-report
description: Use when a complete analysis, review, research, backtest, or dashboard deliverable must produce one self-contained offline HTML dashboard
version: 3.0.0
author: kk-quant
license: MIT
category: report

package:
  type: knowledge-only
capabilities:
  - id: structured-report
    description: "组织研究分区、证据、风险和数据缺口"
  - id: dashboard-generation
    description: "生成单个自包含离线 HTML 数据看板"
  - id: chart-embedding
    description: "嵌入 chart-visualization 生成的本地图表 descriptor"

permissions:
  filesystem: true
  shell: true

requires:
  bins: ["python3", "node"]

tags:
  - report
  - analysis
  - html
  - dashboard
  - offline
---

# 分析报告技能

## 交付物

研究、复盘、回测和看板任务只交付一个自包含 HTML 文件。聊天正文仍可使用 Markdown，但本技能不生成 Markdown、PDF 或 DOCX 报告文件，也不嵌入远程图表 URL。

报告采用研究分区布局。每个实际纳入分析的数据维度必须同时有：

1. 可读的结论、解释、证据或数据质量说明；
2. 至少一种视觉表达（图表、指标卡、时间线、矩阵或结构化表格）。

无法获取的数据保留为 `partial` 或 `unavailable` 分区，并列出缺口和补充条件，不得用空值伪装完整分析。

## 执行链

1. 获取真实数据，按摘要、市场与行业、基本面、估值、技术面、回测、风险与事件、来源与数据说明组织分区。
2. 为每个图表读取 `chart-visualization/references/generate_{type}.md`，调用图表脚本获得离线 descriptor。
3. 构造符合以下契约的 JSON，并确保每个 metric 的 `id` 被 chart 的 `mapping.dimension` 覆盖。
4. 调用唯一运行时工具：

```text
render_html_report(report_json, filename="report.html")
```

该工具校验 JSON、生成线程 outputs 中的 HTML，并将同一份 HTML 归档到报告库。成功后使用 `present_files` 呈现线程中的 `/outputs/<filename>`。

不直接调用远程服务，不手工拼接外部资源，不生成其它报告格式。

## 输入契约

```json
{
  "report_id": "report_01J...",
  "thread_id": "thread_01J...",
  "title": "个股研究看板",
  "subject": {"symbol": "600000", "name": "示例标的"},
  "report_type": "stock-research",
  "generated_at": "2026-08-01T10:00:00+08:00",
  "period": {"start": "2025-01-01", "end": "2026-07-31"},
  "assessment": {"label": "中性", "risk_level": "中"},
  "sections": [
    {
      "id": "fundamentals",
      "title": "基本面",
      "status": "available",
      "summary": "文字结论、证据与适用范围。",
      "metrics": [{
        "id": "revenue", "label": "营业收入", "value": 100, "unit": "亿元",
        "change": 0.12, "source": "数据源", "as_of": "2026-06-30", "visual": "line"
      }],
      "charts": [{
        "id": "revenue-trend", "tool": "generate_line_chart", "title": "营业收入趋势",
        "data": [{"time": "2025-Q1", "value": 90}],
        "mapping": {"dimension": "revenue", "role": "trend"}
      }],
      "evidence": ["数据来源和计算口径"],
      "gaps": []
    }
  ],
  "coverage": [],
  "references": []
}
```

分区 `status` 只能是 `available`、`partial` 或 `unavailable`；不可用分区必须有 `gaps`。渲染器会拒绝缺少来源、日期、视觉覆盖、官方图表字段或包含 HTML/script/style/iframe 外部资源的输入。

## 图表字段纪律

图表字段以 `chart-visualization/references/` 为唯一依据。常用字段如下：

| 工具 | 字段 |
|------|------|
| `generate_line_chart` / `generate_area_chart` | `data[].time`, `data[].value` |
| `generate_bar_chart` / `generate_column_chart` / `generate_funnel_chart` | `data[].category`, `data[].value` |
| `generate_radar_chart` | `data[].name`, `data[].value` |
| `generate_scatter_chart` | `data[].x`, `data[].y` |
| `generate_sankey_chart` | `data[].source`, `data[].target`, `data[].value` |
| `generate_dual_axes_chart` | `categories`, `series[].type`, `series[].data` |
| `generate_histogram_chart` | `data[]` 数值 |
| `generate_liquid_chart` | `percent`，范围 `[0,1]` |
| `generate_spreadsheet` | `data[]` |

`chart-visualization` 会规范化少量常见宽格式字段，但最终 descriptor 必须符合官方字段契约。地图只有在输入内嵌 `geojson` 或 `offlineGeoData` 时才生成地图，否则输出明确 fallback，由 HTML 以表格和文字说明呈现。

## 输出自检

- [ ] 只生成一个 `.html` 文件，且可离线打开；
- [ ] HTML 内嵌 CSS、运行时代码和 JSON，不加载外部 CSS、JS、字体、图片或接口；
- [ ] 每个 metric 均有文字说明和 visual/chart 覆盖；
- [ ] 所有分区、来源、日期、数据缺口和风险等级可见；
- [ ] 不给出买入、卖出或持有指令，只给研究结论、情景条件和需跟踪指标；
- [ ] 线程文件与报告库文件都成功写入后才向用户呈现。

以上分析基于公开数据与逻辑推演，不构成投资建议。
