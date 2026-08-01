import json
from pathlib import Path
from types import SimpleNamespace

from scripts.kstock_tools.report_dashboard_tool import render_html_report_tool
from scripts.kstock_reports import ReportLibraryStore


def payload(report_id="report-1", generated_at="2026-08-01T10:00:00+08:00"):
    return {
        "report_id": report_id,
        "thread_id": "thread-1",
        "title": "测试看板",
        "subject": {"symbol": "600000", "name": "测试"},
        "report_type": "stock-research",
        "generated_at": generated_at,
        "period": {"start": "2026-01-01", "end": "2026-07-31"},
        "assessment": {"label": "中性", "risk_level": "中"},
        "sections": [{
            "id": "summary", "title": "摘要", "status": "available", "summary": "稳定",
            "metrics": [{"id": "score", "label": "评分", "value": 52, "unit": "分", "source": "fixture", "as_of": "2026-07-31", "visual": "line"}],
            "charts": [{"id": "score", "tool": "generate_line_chart", "title": "趋势", "data": [{"time": "2026-07-31", "value": 52}], "mapping": {"dimension": "score", "role": "trend"}}],
            "evidence": ["fixture"], "gaps": [],
        }],
        "coverage": [], "references": [],
    }


def runtime(tmp_path: Path):
    return SimpleNamespace(
        context={"user_id": "alice", "thread_id": "thread-1"},
        state={"thread_data": {"outputs_path": str(tmp_path / "outputs")}},
    )


def test_tool_writes_thread_output_and_library(tmp_path, monkeypatch):
    monkeypatch.setenv("KSTOCK_APP_DATA_DIR", str(tmp_path / "data"))
    result = render_html_report_tool.func(runtime(tmp_path), json.dumps(payload(), ensure_ascii=False), "call-1")
    payload_out = json.loads(result.update["messages"][0].content)
    assert payload_out["report_id"] == "report-1"
    assert result.update["artifacts"] == ["/outputs/report.html"]
    assert (tmp_path / "outputs/report.html").exists()
    assert (tmp_path / "data/reports/alice/2026/08/01/report-1.html").exists()


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

