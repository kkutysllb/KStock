"""Validation for the structured, offline HTML dashboard payload."""

from __future__ import annotations

import re
from typing import Any


CHART_TOOLS = {
    "generate_area_chart",
    "generate_bar_chart",
    "generate_boxplot_chart",
    "generate_column_chart",
    "generate_dual_axes_chart",
    "generate_fishbone_diagram",
    "generate_flow_diagram",
    "generate_funnel_chart",
    "generate_histogram_chart",
    "generate_line_chart",
    "generate_liquid_chart",
    "generate_mind_map",
    "generate_network_graph",
    "generate_organization_chart",
    "generate_pie_chart",
    "generate_radar_chart",
    "generate_sankey_chart",
    "generate_scatter_chart",
    "generate_spreadsheet",
    "generate_treemap_chart",
    "generate_venn_chart",
    "generate_violin_chart",
    "generate_word_cloud_chart",
    "generate_district_map",
    "generate_path_map",
    "generate_pin_map",
}
SECTION_STATUSES = {"available", "partial", "unavailable"}
REQUIRED_TOP_LEVEL = {
    "report_id",
    "thread_id",
    "title",
    "subject",
    "report_type",
    "generated_at",
    "period",
    "assessment",
    "sections",
    "coverage",
    "references",
}
_HTML_RESOURCE_RE = re.compile(
    r"<\s*/?\s*(?:script|style|iframe|img|link)|(?:src|href)\s*=|javascript:",
    re.IGNORECASE,
)


def _fail(path: str, message: str) -> None:
    raise ValueError(f"{path}: {message}")


def _require(value: Any, expected: type | tuple[type, ...], path: str) -> None:
    if not isinstance(value, expected):
        _fail(path, f"必须是 {expected}")


def _non_empty_string(value: Any, path: str) -> None:
    if not isinstance(value, str) or not value.strip():
        _fail(path, "必须是非空字符串")


def reject_external_resources(value: object, path: str = "payload") -> None:
    """Reject executable markup while allowing visible source URLs as text."""
    if isinstance(value, str):
        if _HTML_RESOURCE_RE.search(value):
            _fail(path, "不允许嵌入 HTML 或 external resources（外部资源）")
        return
    if isinstance(value, dict):
        for key, child in value.items():
            reject_external_resources(child, f"{path}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            reject_external_resources(child, f"{path}[{index}]")


def _validate_chart_data(chart: dict[str, Any], path: str) -> None:
    tool = chart["tool"]
    args = chart.get("args") if isinstance(chart.get("args"), dict) else {}
    data = chart.get("data", args.get("data"))
    if tool in {"generate_line_chart", "generate_area_chart"}:
        _require(data, list, f"{path}.data")
        for index, row in enumerate(data):
            _require(row, dict, f"{path}.data[{index}]")
            if set(row) - {"time", "value", "group"} or not {"time", "value"} <= set(row):
                _fail(f"{path}.data[{index}]", "折线/面积图必须使用 time、value 字段")
    elif tool in {"generate_bar_chart", "generate_column_chart", "generate_pie_chart"}:
        _require(data, list, f"{path}.data")
        for index, row in enumerate(data):
            _require(row, dict, f"{path}.data[{index}]")
            if set(row) - {"category", "value", "group"} or not {"category", "value"} <= set(row):
                _fail(f"{path}.data[{index}]", "分类图必须使用 category、value 字段")
    elif tool == "generate_scatter_chart":
        _require(data, list, f"{path}.data")
        for index, row in enumerate(data):
            _require(row, dict, f"{path}.data[{index}]")
            if set(row) - {"x", "y", "group"} or not {"x", "y"} <= set(row):
                _fail(f"{path}.data[{index}]", "散点图必须使用 x、y 字段")
    elif tool == "generate_liquid_chart":
        percent = chart.get("percent", args.get("percent"))
        if not isinstance(percent, (int, float)) or not 0 <= percent <= 1:
            _fail(f"{path}.percent", "必须是 [0,1] 范围内的 number")
    elif data is not None:
        _require(data, (list, dict), f"{path}.data")


def validate_chart_descriptor(chart: dict[str, Any], path: str) -> None:
    _require(chart, dict, path)
    allowed = {"id", "tool", "type", "mode", "title", "data", "args", "mapping", "status", "reason"}
    unknown = set(chart) - allowed
    if unknown:
        _fail(path, f"存在未定义字段: {', '.join(sorted(unknown))}")
    _non_empty_string(chart.get("id"), f"{path}.id")
    tool = chart.get("tool")
    if tool not in CHART_TOOLS:
        _fail(f"{path}.tool", "不是受支持的图表工具")
    _non_empty_string(chart.get("title"), f"{path}.title")
    mapping = chart.get("mapping")
    _require(mapping, dict, f"{path}.mapping")
    _non_empty_string(mapping.get("dimension"), f"{path}.mapping.dimension")
    _non_empty_string(mapping.get("role"), f"{path}.mapping.role")
    if chart.get("status") is not None and chart["status"] not in {"ready", "fallback"}:
        _fail(f"{path}.status", "必须是 ready 或 fallback")
    if chart.get("status") == "fallback":
        _non_empty_string(chart.get("reason"), f"{path}.reason")
    _validate_chart_data(chart, path)


def validate_visual_coverage(section: dict[str, Any], path: str) -> None:
    metrics = section.get("metrics") or []
    charts = section.get("charts") or []
    metric_ids: set[str] = set()
    for index, metric in enumerate(metrics):
        metric_path = f"{path}.metrics[{index}]"
        _require(metric, dict, metric_path)
        _non_empty_string(metric.get("id"), f"{metric_path}.id")
        metric_ids.add(metric["id"])
        for field in ("label", "source", "as_of", "visual"):
            _non_empty_string(metric.get(field), f"{metric_path}.{field}")
        if "value" not in metric:
            _fail(f"{metric_path}.value", "必须提供数值或可显示值")
    mapped: set[str] = set()
    for index, chart in enumerate(charts):
        validate_chart_descriptor(chart, f"{path}.charts[{index}]")
        mapped.add(chart["mapping"]["dimension"])
    missing = metric_ids - mapped
    if missing:
        _fail(f"{path}.metrics", f"指标缺少 visual/chart 覆盖: {', '.join(sorted(missing))}")
    unknown = mapped - metric_ids
    if unknown:
        _fail(f"{path}.charts", f"图表引用不存在的指标: {', '.join(sorted(unknown))}")


def validate_section(section: dict[str, Any], path: str) -> None:
    _require(section, dict, path)
    for field in ("id", "title", "summary"):
        _non_empty_string(section.get(field), f"{path}.{field}")
    if section.get("status") not in SECTION_STATUSES:
        _fail(f"{path}.status", "必须是 available、partial 或 unavailable")
    _require(section.get("metrics", []), list, f"{path}.metrics")
    _require(section.get("charts", []), list, f"{path}.charts")
    _require(section.get("evidence", []), list, f"{path}.evidence")
    _require(section.get("gaps", []), list, f"{path}.gaps")
    if section["status"] == "unavailable" and not section["gaps"]:
        _fail(f"{path}.gaps", "unavailable 分区必须说明数据缺口")
    if section["status"] != "unavailable":
        validate_visual_coverage(section, path)


def validate_report_payload(payload: dict[str, Any]) -> None:
    _require(payload, dict, "payload")
    reject_external_resources(payload)
    missing = REQUIRED_TOP_LEVEL - set(payload)
    if missing:
        _fail("payload", f"缺少字段: {', '.join(sorted(missing))}")
    for field in ("report_id", "thread_id", "title", "report_type", "generated_at"):
        _non_empty_string(payload.get(field), f"payload.{field}")
    _require(payload["subject"], dict, "payload.subject")
    _require(payload["period"], dict, "payload.period")
    for field in ("start", "end"):
        _non_empty_string(payload["period"].get(field), f"payload.period.{field}")
    _require(payload["assessment"], dict, "payload.assessment")
    _non_empty_string(payload["assessment"].get("label"), "payload.assessment.label")
    _non_empty_string(payload["assessment"].get("risk_level"), "payload.assessment.risk_level")
    _require(payload["sections"], list, "payload.sections")
    if not payload["sections"]:
        _fail("payload.sections", "至少需要一个研究分区")
    for index, section in enumerate(payload["sections"]):
        validate_section(section, f"payload.sections[{index}]")
    _require(payload["coverage"], list, "payload.coverage")
    _require(payload["references"], list, "payload.references")
