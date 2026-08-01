#!/usr/bin/env node

const fs = require("fs");

// The renderer owns the visual implementation. This skill only normalizes and
// validates the descriptor that will be embedded in an offline report.
const CHART_TYPE_MAP = {
  generate_area_chart: "area",
  generate_bar_chart: "bar",
  generate_boxplot_chart: "boxplot",
  generate_column_chart: "column",
  generate_district_map: "district-map",
  generate_dual_axes_chart: "dual-axes",
  generate_fishbone_diagram: "fishbone-diagram",
  generate_flow_diagram: "flow-diagram",
  generate_funnel_chart: "funnel",
  generate_histogram_chart: "histogram",
  generate_line_chart: "line",
  generate_liquid_chart: "liquid",
  generate_mind_map: "mind-map",
  generate_network_graph: "network-graph",
  generate_organization_chart: "organization-chart",
  generate_path_map: "path-map",
  generate_pie_chart: "pie",
  generate_pin_map: "pin-map",
  generate_radar_chart: "radar",
  generate_sankey_chart: "sankey",
  generate_scatter_chart: "scatter",
  generate_spreadsheet: "spreadsheet",
  generate_treemap_chart: "treemap",
  generate_venn_chart: "venn",
  generate_violin_chart: "violin",
  generate_word_cloud_chart: "word-cloud",
};

const COMMON_ARG_KEYS = new Set([
  "data", "title", "style", "theme", "width", "height", "group", "stack",
  "axisXTitle", "axisYTitle",
]);
const ARG_KEYS = {
  generate_area_chart: new Set(["data", "title", "style", "theme", "width", "height", "group", "stack", "axisXTitle", "axisYTitle"]),
  generate_bar_chart: new Set(["data", "title", "style", "theme", "width", "height", "group", "stack", "axisXTitle", "axisYTitle"]),
  generate_column_chart: new Set(["data", "title", "style", "theme", "width", "height", "group", "stack", "axisXTitle", "axisYTitle"]),
  generate_line_chart: new Set(["data", "title", "style", "theme", "width", "height", "group", "axisXTitle", "axisYTitle"]),
  generate_boxplot_chart: COMMON_ARG_KEYS,
  generate_dual_axes_chart: new Set(["categories", "series", "title", "style", "theme", "width", "height", "axisXTitle"]),
  generate_fishbone_diagram: new Set(["data", "title", "style", "theme", "width", "height"]),
  generate_flow_diagram: new Set(["data", "title", "style", "theme", "width", "height"]),
  generate_funnel_chart: COMMON_ARG_KEYS,
  generate_histogram_chart: new Set(["data", "binNumber", "title", "style", "theme", "width", "height", "axisXTitle", "axisYTitle"]),
  generate_liquid_chart: new Set(["percent", "shape", "title", "style", "theme", "width", "height"]),
  generate_mind_map: new Set(["data", "title", "style", "theme", "width", "height"]),
  generate_network_graph: new Set(["data", "title", "style", "theme", "width", "height"]),
  generate_organization_chart: new Set(["data", "orient", "title", "style", "theme", "width", "height"]),
  generate_pie_chart: new Set(["data", "innerRadius", "title", "style", "theme", "width", "height"]),
  generate_radar_chart: COMMON_ARG_KEYS,
  generate_sankey_chart: new Set(["data", "nodeAlign", "title", "style", "theme", "width", "height"]),
  generate_scatter_chart: COMMON_ARG_KEYS,
  generate_spreadsheet: new Set(["data", "rows", "columns", "values", "title", "width", "height"]),
  generate_treemap_chart: COMMON_ARG_KEYS,
  generate_venn_chart: COMMON_ARG_KEYS,
  generate_violin_chart: COMMON_ARG_KEYS,
  generate_word_cloud_chart: COMMON_ARG_KEYS,
  generate_district_map: new Set(["title", "data", "geojson", "offlineGeoData", "width", "height"]),
  generate_path_map: new Set(["title", "data", "geojson", "offlineGeoData", "width", "height"]),
  generate_pin_map: new Set(["title", "data", "geojson", "offlineGeoData", "width", "height", "markerPopup"]),
};

function assertObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function normalizeData(tool, args) {
  const normalized = clone(args);
  if (Array.isArray(normalized.data) && tool === "generate_pie_chart") {
    normalized.data = normalized.data.map((item) => {
      if (item.category === undefined && item.name !== undefined) {
        const { name, ...rest } = item;
        return { ...rest, category: name };
      }
      return item;
    });
    const total = normalized.data.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
    if (total > 0 && total < 99.5 && total < 100) {
      normalized.data.push({ category: "其他", value: +(100 - total).toFixed(1) });
    }
  }

  if (Array.isArray(normalized.data) && tool === "generate_radar_chart") {
    const hasGroup = normalized.data.some((item) => item.group !== undefined && item.group !== null);
    if (!hasGroup) normalized.data = normalized.data.map((item) => ({ ...item, group: "default" }));
  }

  if (Array.isArray(normalized.data) && tool === "generate_column_chart" && normalized.data.length > 0) {
    const hasCategory = normalized.data.some((item) => item.category !== undefined);
    if (!hasCategory) {
      normalized.data = normalized.data.map((item, index) => {
        const catKey = Object.keys(item).find((key) => /^(category|cat|label|name|月份|时间|x)$/i.test(key) || (typeof item[key] === "string" && /^\d{4}[-/]\d{2}/.test(item[key])));
        const valKey = Object.keys(item).find((key) => /^(value|val|y|收益|return|return_rate)$/i.test(key));
        const numericKey = Object.keys(item).find((key) => key !== catKey && typeof item[key] === "number" && Number.isFinite(item[key]));
        const result = { category: catKey ? item[catKey] : String(index + 1), value: valKey ? item[valKey] : (numericKey ? item[numericKey] : 0) };
        if (item.group !== undefined) result.group = item.group;
        return result;
      });
    }
  }

  if (Array.isArray(normalized.data) && (tool === "generate_line_chart" || tool === "generate_area_chart")) {
    const hasValue = normalized.data.some((item) => item.value !== undefined);
    if (!hasValue && normalized.data.length > 0) {
      const sample = normalized.data[0];
      const timeKey = Object.keys(sample).find((key) => /^(time|date|日期|时间|x)$/i.test(key) || (typeof sample[key] === "string" && /^\d{4}[-/]\d{2}/.test(sample[key])));
      const numericKeys = Object.keys(sample).filter((key) => key !== timeKey && typeof sample[key] === "number" && Number.isFinite(sample[key]));
      if (timeKey && numericKeys.length) {
        normalized.data = normalized.data.flatMap((item) => numericKeys.map((key) => ({ time: item[timeKey], value: item[key], group: key })));
      }
    }
  }

  if (tool === "generate_dual_axes_chart" && Array.isArray(normalized.series)) {
    const hasColumn = normalized.series.some((series) => series.type === "column");
    if (!hasColumn && normalized.series.length) normalized.series[0] = { ...normalized.series[0], type: "column" };
    normalized.series = normalized.series.map((series) => {
      if (series.name && !series.axisYTitle) {
        const { name, ...rest } = series;
        return { ...rest, axisYTitle: name };
      }
      return series;
    });
  }
  return normalized;
}

function validateArgs(tool, args) {
  const allowed = ARG_KEYS[tool] || COMMON_ARG_KEYS;
  for (const key of Object.keys(args)) {
    if (!allowed.has(key)) throw new Error(`Unknown args field '${key}' for ${tool}`);
  }
  if (["generate_line_chart", "generate_area_chart", "generate_bar_chart", "generate_column_chart", "generate_pie_chart", "generate_scatter_chart", "generate_radar_chart", "generate_boxplot_chart", "generate_funnel_chart", "generate_histogram_chart", "generate_treemap_chart", "generate_venn_chart", "generate_violin_chart", "generate_word_cloud_chart"].includes(tool) && !Array.isArray(args.data)) {
    throw new Error(`${tool} requires args.data array`);
  }
  if (tool === "generate_liquid_chart" && (typeof args.percent !== "number" || args.percent < 0 || args.percent > 1)) {
    throw new Error("generate_liquid_chart requires percent between 0 and 1");
  }
  if (tool === "generate_dual_axes_chart" && (!Array.isArray(args.categories) || !Array.isArray(args.series))) {
    throw new Error("generate_dual_axes_chart requires categories and series arrays");
  }
}

function normalizeDescriptor(spec) {
  assertObject(spec, "spec");
  const allowedSpec = new Set(["tool", "args", "id", "title", "mapping"]);
  for (const key of Object.keys(spec)) if (!allowedSpec.has(key)) throw new Error(`Unknown spec field '${key}'`);
  const tool = spec.tool;
  if (!CHART_TYPE_MAP[tool]) throw new Error(`Unknown tool '${tool}'`);
  const args = spec.args || {};
  assertObject(args, "args");
  validateArgs(tool, args);
  const normalizedArgs = normalizeData(tool, args);
  const descriptor = {
    mode: "offline",
    tool,
    type: CHART_TYPE_MAP[tool],
    args: normalizedArgs,
    status: "ready",
  };
  if (spec.id !== undefined) descriptor.id = spec.id;
  if (spec.title !== undefined) descriptor.title = spec.title;
  if (spec.mapping !== undefined) descriptor.mapping = clone(spec.mapping);
  if (["generate_district_map", "generate_path_map", "generate_pin_map"].includes(tool) && !(normalizedArgs.geojson || normalizedArgs.offlineGeoData)) {
    descriptor.status = "fallback";
    descriptor.reason = "缺少内嵌离线地理数据，已降级为结构化数据表和文字说明";
  }
  return descriptor;
}

function main() {
  if (process.argv.length < 3) {
    console.error("Usage: node generate.js <spec_json_or_file>");
    process.exitCode = 1;
    return;
  }
  const specArg = process.argv[2];
  let spec;
  try {
    spec = fs.existsSync(specArg) ? JSON.parse(fs.readFileSync(specArg, "utf-8")) : JSON.parse(specArg);
  } catch (error) {
    console.error(`Error parsing spec: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  const specs = Array.isArray(spec) ? spec : [spec];
  let failed = false;
  for (const item of specs) {
    try {
      console.log(JSON.stringify(normalizeDescriptor(item)));
    } catch (error) {
      failed = true;
      console.error(`Error normalizing chart: ${error.message}`);
    }
  }
  if (failed) process.exitCode = 1;
}

if (require.main === module) main();

module.exports = { CHART_TYPE_MAP, normalizeDescriptor };
