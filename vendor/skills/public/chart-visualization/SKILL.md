---
name: chart-visualization
description: 数据可视化技能，支持26种图表类型，智能选择最佳图表，并生成可嵌入离线 HTML 看板的图表 descriptor。
version: 1.0.0
author: kk-quant
license: MIT
category: visualization


package:
  type: node
  entry: scripts/generate.js
capabilities:
  - id: chart-selection
    description: "智能图表选择：根据数据特征自动推荐最合适的图表类型"
  - id: chart-generation
    description: "图表规格生成：26种图表类型，输出可嵌入离线看板的 descriptor"
  - id: parameter-extraction
    description: "参数提取：从用户输入中提取并映射为图表所需的args格式"

permissions:
  filesystem: true
  shell: true

requires:
  bins: ["node"]

inputs:
  - name: tool
    type: string
    required: true
    description: "图表类型，如 generate_line_chart, generate_bar_chart 等"
  - name: args
    type: object
    required: true
    description: "图表参数，包含 data/title/theme/style 等"

metadata:
  openclaw:
    emoji: "📊"
    version: "1.0.0"
    author: "kk-quant"
    category: "visualization"
    tags:
      - visualization
      - chart
      - data-viz
    requires:
      bins: ["node"]
      compatibility:
        nodejs: ">=18.0.0"
    install:
      - id: npm-deps
        kind: npm
        package: ""
        label: "无额外npm依赖"

tags:
  - visualization
  - chart
  - data-viz
---

# Chart Visualization Skill

This skill provides a comprehensive workflow for transforming data into visual charts. It handles chart selection, parameter extraction, field normalization, and offline descriptor generation. It never calls a remote visualization service and never returns a remote image URL.

## Workflow

To visualize data, follow these steps:

### 1. Intelligent Chart Selection
Analyze the user's data features to determine the most appropriate chart type. Use the following guidelines (and consult `references/` for detailed specs):

- **Time Series**: Use `generate_line_chart` (trends) or `generate_area_chart` (accumulated trends). Use `generate_dual_axes_chart` for two different scales.
- **Comparisons**: Use `generate_bar_chart` (categorical) or `generate_column_chart`. Use `generate_histogram_chart` for frequency distributions.
- **Part-to-Whole**: Use `generate_pie_chart` or `generate_treemap_chart` (hierarchical).
- **Relationships & Flow**: Use `generate_scatter_chart` (correlation), `generate_sankey_chart` (flow), or `generate_venn_chart` (overlap).
- **Maps**: Use `generate_district_map` (regions), `generate_pin_map` (points), or `generate_path_map` (routes).
- **Hierarchies & Trees**: Use `generate_organization_chart` or `generate_mind_map`.
- **Specialized**:
    - `generate_radar_chart`: Multi-dimensional comparison.
    - `generate_funnel_chart`: Process stages.
    - `generate_liquid_chart`: Percentage/Progress.
    - `generate_word_cloud_chart`: Text frequency.
    - `generate_boxplot_chart` or `generate_violin_chart`: Statistical distribution.
    - `generate_network_graph`: Complex node-edge relationships.
    - `generate_fishbone_diagram`: Cause-effect analysis.
    - `generate_flow_diagram`: Process flow.
    - `generate_spreadsheet`: Tabular data or pivot tables for structured data display and cross-tabulation.

### 2. Parameter Extraction
Once a chart type is selected, read the corresponding file in the `references/` directory (e.g., `references/generate_line_chart.md`) to identify the required and optional fields.
Extract the data from the user's input and map it to the expected `args` format.

### 3. Descriptor Generation
Invoke the `scripts/generate.js` script with a JSON payload.

**Payload Format:**
```json
{
  "tool": "generate_chart_type_name",
  "args": {
    "data": [...],
    "title": "...",
    "theme": "...",
    "style": { ... }
  }
}
```

**Execution Command:**
```bash
node ./scripts/generate.js '<payload_json>'
```

### 4. Result Return
The script outputs one JSON descriptor per input chart. The descriptor has this contract:

```json
{
  "mode": "offline",
  "tool": "generate_line_chart",
  "type": "line",
  "args": {"data": [{"time": "2026-07", "value": 10}]},
  "status": "ready"
}
```

`status` is `fallback` with a human-readable `reason` when a chart cannot be rendered from embedded data. Map charts require `geojson` or `offlineGeoData`; without one they remain visible as a structured data fallback. The HTML report renderer embeds the descriptor and draws the chart locally.

## Reference Material
Detailed specifications for each chart type are located in the `references/` directory. Consult these files to ensure the `args` passed to the script match the expected schema.

## License

This `SKILL.md` is provided by [antvis/chart-visualization-skills](https://github.com/antvis/chart-visualization-skills).
Licensed under the [MIT License](https://github.com/antvis/chart-visualization-skills/blob/master/LICENSE).
