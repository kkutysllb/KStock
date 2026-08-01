from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "render_report.py"


def valid_payload() -> dict:
    return {
        "report_id": "report-fixture",
        "thread_id": "thread-fixture",
        "title": "示例研究看板",
        "subject": {"symbol": "600000", "name": "示例标的"},
        "report_type": "stock-research",
        "generated_at": "2026-08-01T10:00:00+08:00",
        "period": {"start": "2025-01-01", "end": "2026-07-31"},
        "assessment": {"label": "中性", "risk_level": "中"},
        "sections": [
            {
                "id": "summary",
                "title": "摘要",
                "status": "available",
                "summary": "关键指标保持稳定。",
                "metrics": [
                    {
                        "id": "score",
                        "label": "综合评分",
                        "value": 52,
                        "unit": "分",
                        "change": 2,
                        "source": "fixture",
                        "as_of": "2026-07-31",
                        "visual": "line",
                    }
                ],
                "charts": [
                    {
                        "id": "score-trend",
                        "tool": "generate_line_chart",
                        "title": "评分趋势",
                        "data": [
                            {"time": "2026-07-30", "value": 50},
                            {"time": "2026-07-31", "value": 52},
                        ],
                        "mapping": {"dimension": "score", "role": "trend"},
                    }
                ],
                "evidence": ["fixture evidence"],
                "gaps": [],
            }
        ],
        "coverage": [],
        "references": ["fixture source"],
    }


def run_renderer(tmp_path: Path, value: dict, basename: str = "report"):
    input_path = tmp_path / "report.json"
    input_path.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
    return subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            "--input",
            str(input_path),
            "--output-dir",
            str(tmp_path),
            "--basename",
            basename,
        ],
        capture_output=True,
        text=True,
    )


def test_render_report_writes_only_one_html(tmp_path: Path) -> None:
    result = run_renderer(tmp_path, valid_payload())

    assert result.returncode == 0, result.stderr
    assert (tmp_path / "report.html").exists()
    assert not list(tmp_path.glob("*.md"))
    assert not list(tmp_path.glob("*.pdf"))
    assert not list(tmp_path.glob("*.docx"))


def test_render_report_rejects_metric_without_visual_mapping(tmp_path: Path) -> None:
    payload = valid_payload()
    payload["sections"][0]["metrics"][0].pop("visual")

    result = run_renderer(tmp_path, payload)

    assert result.returncode != 0
    assert "visual" in result.stderr


def test_render_report_rejects_external_resource(tmp_path: Path) -> None:
    payload = valid_payload()
    payload["sections"][0]["summary"] = '<script src="https://example.com/a.js"></script>'

    result = run_renderer(tmp_path, payload)

    assert result.returncode != 0
    assert "external" in result.stderr.lower()


def test_render_report_keeps_unavailable_section_visible(tmp_path: Path) -> None:
    payload = valid_payload()
    payload["sections"].append(
        {
            "id": "backtest",
            "title": "回测",
            "status": "unavailable",
            "summary": "没有策略与区间数据",
            "metrics": [],
            "charts": [],
            "evidence": [],
            "gaps": ["缺少回测区间"],
        }
    )

    result = run_renderer(tmp_path, payload)

    assert result.returncode == 0, result.stderr
    html = (tmp_path / "report.html").read_text(encoding="utf-8")
    assert "没有策略与区间数据" in html
    assert "缺少回测区间" in html


def test_render_report_rejects_unknown_chart_field(tmp_path: Path) -> None:
    payload = valid_payload()
    payload["sections"][0]["charts"][0]["unsupported"] = True

    result = run_renderer(tmp_path, payload, basename="invalid")

    assert result.returncode != 0
    assert "未定义字段" in result.stderr or "unsupported" in result.stderr
    assert not (tmp_path / "invalid.html").exists()


def test_render_report_accepts_offline_chart_descriptor_args(tmp_path: Path) -> None:
    payload = valid_payload()
    chart = payload["sections"][0]["charts"][0]
    chart.pop("data")
    chart.update({
        "mode": "offline",
        "type": "line",
        "args": {"data": [{"time": "2026-07-31", "value": 52}]},
        "status": "ready",
    })
    result = run_renderer(tmp_path, payload, basename="descriptor")
    assert result.returncode == 0, result.stderr
    assert (tmp_path / "descriptor.html").exists()


def test_render_report_rejects_chart_mapping_to_unknown_metric(tmp_path: Path) -> None:
    payload = valid_payload()
    payload["sections"][0]["charts"][0]["mapping"]["dimension"] = "missing"
    result = run_renderer(tmp_path, payload, basename="unknown-mapping")
    assert result.returncode != 0
    assert "不存在的指标" in result.stderr or "缺少 visual/chart 覆盖" in result.stderr
