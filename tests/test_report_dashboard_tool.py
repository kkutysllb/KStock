import json
from pathlib import Path
from types import SimpleNamespace

from scripts.kstock_tools.report_dashboard_tool import (
    render_html_report_from_file_tool,
    render_html_report_tool,
)
from scripts.kstock_reports import ReportLibraryStore


def payload(report_id="report-1", generated_at="2026-08-01T10:00:00+08:00"):
    def chart(index, title, value):
        data = [{"time": "2026-07-31", "value": value}]
        return {
            "tool": "generate_line_chart",
            "title": title,
            "alt": f"{title}图",
            "args": {"data": data, "title": title, "axisXTitle": "日期", "axisYTitle": "数值"},
        }
    return {
        "report_id": report_id,
        "thread_id": "thread-1",
        "title": "测试看板",
        "generated_at": generated_at,
        "summary": "稳定",
        "assessment": "中性",
        "risk_level": "中",
        "data_overview": [{"metric": "综合评分", "current": "52", "change": "+2", "yoy": "—"}],
        "core_analysis": ["分析结论一", "分析结论二"],
        "risks": ["风险一"],
        "references": ["fixture"],
        "charts": [chart(1, "趋势", 52), chart(2, "评分", 60), chart(3, "对比", 45)],
    }


def runtime(tmp_path: Path):
    return SimpleNamespace(
        context={"user_id": "alice", "thread_id": "thread-1"},
        state={
            "thread_data": {
                "workspace_path": str(tmp_path / "workspace"),
                "uploads_path": str(tmp_path / "uploads"),
                "outputs_path": str(tmp_path / "outputs"),
            }
        },
    )


def test_tool_writes_thread_output_and_library(tmp_path, monkeypatch):
    monkeypatch.setenv("KSTOCK_APP_DATA_DIR", str(tmp_path / "data"))
    result = render_html_report_tool.func(runtime(tmp_path), json.dumps(payload(), ensure_ascii=False), "call-1")
    payload_out = json.loads(result.update["messages"][0].content)
    assert payload_out["report_id"] == "report-1"
    assert result.update["artifacts"] == ["/outputs/report.html"]
    assert (tmp_path / "outputs/report.html").exists()
    assert (tmp_path / "data/reports/alice/2026/08/01/report-1.html").exists()


def test_from_file_tool_reads_workspace_json_and_writes_artifact(tmp_path, monkeypatch):
    monkeypatch.setenv("KSTOCK_APP_DATA_DIR", str(tmp_path / "data"))
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    (workspace / "report.json").write_text(json.dumps(payload(), ensure_ascii=False), encoding="utf-8")

    result = render_html_report_from_file_tool.func(
        runtime(tmp_path),
        "/mnt/user-data/workspace/report.json",
        "call-file",
        filename="weekly.html",
    )

    payload_out = json.loads(result.update["messages"][0].content)
    assert payload_out["thread_virtual_path"] == "/outputs/weekly.html"
    assert result.update["artifacts"] == ["/outputs/weekly.html"]
    assert (tmp_path / "outputs/weekly.html").exists()
    assert (tmp_path / "data/reports/alice/2026/08/01/report-1.html").exists()


def test_from_file_tool_rejects_non_workspace_input_path(tmp_path, monkeypatch):
    monkeypatch.setenv("KSTOCK_APP_DATA_DIR", str(tmp_path / "data"))
    outputs = tmp_path / "outputs"
    outputs.mkdir()
    (outputs / "report.json").write_text(json.dumps(payload()), encoding="utf-8")

    result = render_html_report_from_file_tool.func(
        runtime(tmp_path),
        "/mnt/user-data/outputs/report.json",
        "call-file",
    )

    assert "error" in result.update["messages"][0].content
    assert "workspace" in result.update["messages"][0].content
    assert not (tmp_path / "outputs/report.html").exists()


def test_tool_cleans_intermediate_render_outputs(tmp_path, monkeypatch):
    """渲染中间产物（{stem}.md / -dark.html / -light.html）不得残留在 outputs 目录。"""
    monkeypatch.setenv("KSTOCK_APP_DATA_DIR", str(tmp_path / "data"))
    render_html_report_tool.func(runtime(tmp_path), json.dumps(payload(), ensure_ascii=False), "call-1")
    leftovers = [p.name for p in (tmp_path / "outputs").iterdir()]
    assert leftovers == ["report.html"]


def test_tool_rejects_non_html_filename_without_files(tmp_path, monkeypatch):
    monkeypatch.setenv("KSTOCK_APP_DATA_DIR", str(tmp_path / "data"))
    result = render_html_report_tool.func(runtime(tmp_path), json.dumps(payload()), "call-2", filename="report.md")
    assert "error" in result.update["messages"][0].content
    assert not (tmp_path / "outputs/report.md").exists()


def test_tool_regeneration_keeps_one_library_row(tmp_path, monkeypatch):
    monkeypatch.setenv("KSTOCK_APP_DATA_DIR", str(tmp_path / "data"))
    rt = runtime(tmp_path)
    render_html_report_tool.func(rt, json.dumps(payload()), "call-1")
    render_html_report_tool.func(rt, json.dumps(payload(generated_at="2026-08-02T10:00:00+08:00")), "call-2")
    store = ReportLibraryStore(tmp_path / "data")
    assert len(store.list_reports(user_id="alice")) == 1
    assert (tmp_path / "data/reports/alice/2026/08/01/report-1.html").exists() is False


def _with_spreadsheet(rows):
    p = payload()
    p["charts"] = [
        p["charts"][0],
        p["charts"][1],
        {
            "tool": "generate_spreadsheet",
            "title": "方向矩阵",
            "alt": "方向矩阵表格",
            "args": {"rows": rows},
        },
    ]
    return p


def _render_report(tmp_path, monkeypatch, p):
    monkeypatch.setenv("KSTOCK_APP_DATA_DIR", str(tmp_path / "data"))
    result = render_html_report_tool.func(
        runtime(tmp_path), json.dumps(p, ensure_ascii=False), "call-x"
    )
    return result, (tmp_path / "outputs/report.html").read_text()


def test_spreadsheet_rows_matrix_renders_table(tmp_path, monkeypatch):
    """rows=string[][]（首行表头）格式：校验通过且渲染为完整 <table>。"""
    rows = [
        ["品种", "期指信号", "期权信号"],
        ["IF 沪深300", "贴水 -1.09% + 净空头", "PCR 0.933 + 认沽端IV偏贵"],
        ["IC 中证500", "贴水 -1.32%", "PCR 1.003"],
    ]
    result, html = _render_report(tmp_path, monkeypatch, _with_spreadsheet(rows))
    assert "error" not in result.update["messages"][0].content
    assert html.count("<table") == 1
    for key in ("品种", "IF 沪深300", "贴水 -1.09% + 净空头", "PCR 0.933 + 认沽端IV偏贵"):
        assert key in html


def test_spreadsheet_data_objects_format_renders_table(tmp_path, monkeypatch):
    """官方 data=array<object> 格式：校验通过且渲染为完整 <table>。"""
    p = payload()
    p["charts"] = [
        p["charts"][0],
        p["charts"][1],
        {
            "tool": "generate_spreadsheet",
            "title": "持仓变化",
            "alt": "持仓变化表",
            "args": {
                "data": [
                    {"品种": "IF", "中信净变化": -19, "周度判断": "方向分歧"},
                    {"品种": "IC", "中信净变化": 283, "周度判断": "一致做多"},
                ],
                "columns": ["品种", "中信净变化", "周度判断"],
            },
        },
    ]
    result, html = _render_report(tmp_path, monkeypatch, p)
    assert "error" not in result.update["messages"][0].content
    assert html.count("<table") == 1
    for key in ("中信净变化", "-19", "一致做多"):
        assert key in html


def test_spreadsheet_rejects_missing_data_and_rows(tmp_path, monkeypatch):
    """data 与 rows 都缺失时报契约错误（回归：agent 曾 4 次失败后误判无表格工具）。"""
    p = payload()
    p["charts"] = [
        p["charts"][0],
        p["charts"][1],
        {
            "tool": "generate_spreadsheet",
            "title": "空表",
            "alt": "空表",
            "args": {"rows": []},
        },
    ]
    monkeypatch.setenv("KSTOCK_APP_DATA_DIR", str(tmp_path / "data"))
    result = render_html_report_tool.func(
        runtime(tmp_path), json.dumps(p, ensure_ascii=False), "call-x"
    )
    content = result.update["messages"][0].content
    assert "error" in content
    assert "rows" in content


def test_spreadsheet_rejects_both_data_and_rows(tmp_path, monkeypatch):
    p = payload()
    p["charts"] = [
        p["charts"][0],
        p["charts"][1],
        {
            "tool": "generate_spreadsheet",
            "title": "冲突",
            "alt": "冲突",
            "args": {"data": [{"a": 1}], "rows": [["a"], ["1"]]},
        },
    ]
    monkeypatch.setenv("KSTOCK_APP_DATA_DIR", str(tmp_path / "data"))
    result = render_html_report_tool.func(
        runtime(tmp_path), json.dumps(p, ensure_ascii=False), "call-x"
    )
    content = result.update["messages"][0].content
    assert "error" in content
    assert "只能提供一个" in content


def section_payload():
    return {
        "report_id": "section-report",
        "thread_id": "thread-1",
        "title": "分区契约报告",
        "generated_at": "2026-08-02T10:00:00+08:00",
        "summary": "分区报告摘要",
        "assessment": {"label": "中性", "risk_level": "中"},
        "references": [
            {"title": "数据源 A", "source": "fixture", "as_of": "2026-08-02"},
        ],
        "sections": [
            {
                "id": "flow",
                "title": "资金流向",
                "status": "available",
                "summary": "净流入与净流出并存。",
                "metrics": [
                    {"id": "inflow", "label": "净流入", "value": 32.5, "unit": "亿元", "source": "fixture", "as_of": "2026-08-02"},
                    {"id": "outflow", "label": "净流出", "value": -12.4, "unit": "亿元", "source": "fixture", "as_of": "2026-08-02"},
                ],
                "charts": [
                    {
                        "tool": "generate_bar_chart",
                        "title": "净流入/净流出",
                        "alt": "正负值柱状图",
                        "data": [
                            {"category": "东山精密", "value": 32.5},
                            {"category": "宁德时代", "value": -12.4},
                        ],
                    },
                    {
                        "tool": "generate_spreadsheet",
                        "title": "资金流向明细",
                        "alt": "资金流向明细表",
                        "rows": [
                            ["方向", "标的", "金额"],
                            ["流入", "东山精密", "32.5"],
                            ["流出", "宁德时代", "-12.4"],
                        ],
                    },
                    {
                        "tool": "generate_line_chart",
                        "title": "北向资金趋势",
                        "alt": "北向资金趋势",
                        "data": [
                            {"time": "D-1", "value": 20},
                            {"time": "D0", "value": 35},
                        ],
                    },
                ],
                "evidence": ["fixture"],
                "gaps": [],
            }
        ],
        "core_analysis": [
            {"title": "结构判断", "content": "资金端偏多，但期货端对冲较强。"},
        ],
        "risks": [
            {"title": "期现背离风险", "detail": "期指贴水可能放大波动。"},
        ],
    }


def test_section_contract_renders_without_raw_dicts_or_missing_title(tmp_path, monkeypatch):
    result, html = _render_report(tmp_path, monkeypatch, section_payload())
    assert "error" not in result.update["messages"][0].content
    assert "<h1>分区契约报告</h1>" in html
    assert "资金流向" in html
    assert "结构判断" in html
    assert "资金端偏多" in html
    assert "{&#x27;title&#x27;" not in html
    assert "&#x27;content&#x27;" not in html


def test_bar_chart_with_negative_values_stays_inside_svg_viewbox(tmp_path, monkeypatch):
    result, html = _render_report(tmp_path, monkeypatch, section_payload())
    assert "error" not in result.update["messages"][0].content
    assert 'y="-"' not in html
    assert 'height="-"' not in html
