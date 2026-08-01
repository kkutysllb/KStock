from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "render_report.py"


def line_chart_variants() -> dict:
    base_args = {
        "data": [
            {"time": "2026-07-20", "value": 50},
            {"time": "2026-07-21", "value": 52},
        ],
        "title": "综合评分趋势",
        "axisXTitle": "日期",
        "axisYTitle": "评分",
    }
    return {
        "tool": "generate_line_chart",
        "dark": {
            "url": "https://example.com/score-dark.png",
            "args": {
                **base_args,
                "theme": "dark",
                "style": {"backgroundColor": "#101418"},
            },
        },
        "light": {
            "url": "https://example.com/score-light.png",
            "args": {
                **base_args,
                "theme": "default",
                "style": {"backgroundColor": "#ffffff"},
            },
        },
        "title": "综合评分趋势",
        "alt": "综合评分趋势图",
    }


def payload() -> dict:
    return {
        "title": "本周市场联动分析",
        "generated_at": "2026-07-25 18:00",
        "summary": "资金与股指期货持仓信号中性。",
        "assessment": "中性",
        "risk_level": "中",
        "data_overview": [
            {"metric": "综合评分", "current": "52", "change": "+2", "yoy": "—"}
        ],
        "core_analysis": ["主力资金边际改善。", "中信与其他机构存在分歧。"],
        "risks": ["持仓数据仅覆盖可获取的席位排名。"],
        "references": ["Tushare Pro"],
        "charts": [
            line_chart_variants(),
            line_chart_variants(),
            line_chart_variants(),
        ],
    }


def run_renderer(tmp_path: Path, value: dict, basename: str = "weekly-market"):
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


def test_render_report_writes_markdown_and_dark_light_html(tmp_path: Path) -> None:
    result = run_renderer(tmp_path, payload())

    assert result.returncode == 0, result.stderr
    assert "Markdown: " in result.stdout
    assert "weekly-market.md" in result.stdout
    assert "weekly-market-dark.html" in result.stdout
    assert "weekly-market-light.html" in result.stdout

    markdown = (tmp_path / "weekly-market.md").read_text(encoding="utf-8")
    dark = (tmp_path / "weekly-market-dark.html").read_text(encoding="utf-8")
    light = (tmp_path / "weekly-market-light.html").read_text(encoding="utf-8")
    assert "# 本周市场联动分析" in markdown
    assert "## 执行摘要" in markdown
    assert "## 数据概览" in markdown
    assert "## 核心分析" in markdown
    assert "## 风险提示" in markdown
    assert "## 参考资料" in markdown
    assert 'data-theme="dark"' in dark
    assert 'data-theme="light"' in light
    assert "score-dark.png" in dark
    assert "score-light.png" in light
    assert "#101418" in dark
    assert "#ffffff" in light


def test_render_report_rejects_non_contract_chart_fields(tmp_path: Path) -> None:
    invalid = payload()
    invalid["charts"][0]["dark"]["args"]["data"][0] = {
        "date": "2026-07-20",
        "score": 50,
    }

    result = run_renderer(tmp_path, invalid, basename="invalid")

    assert result.returncode != 0
    assert "generate_line_chart" in result.stderr
    assert "time" in result.stderr
    assert not (tmp_path / "invalid-dark.html").exists()


def test_render_report_rejects_wrong_theme_variant(tmp_path: Path) -> None:
    invalid = payload()
    invalid["charts"][0]["light"]["args"]["theme"] = "dark"

    result = run_renderer(tmp_path, invalid, basename="wrong-theme")

    assert result.returncode != 0
    assert "light" in result.stderr
    assert "theme" in result.stderr


def test_render_report_rejects_unsupported_style_field(tmp_path: Path) -> None:
    invalid = payload()
    invalid["charts"][0]["dark"]["args"]["style"]["color"] = "#ffffff"

    result = run_renderer(tmp_path, invalid, basename="invalid-style")

    assert result.returncode != 0
    assert "style" in result.stderr
    assert "color" in result.stderr
    assert not (tmp_path / "invalid-style-dark.html").exists()


def test_render_report_rejects_non_data_theme_mismatch(tmp_path: Path) -> None:
    invalid = payload()
    invalid["charts"][0]["light"]["args"]["axisYTitle"] = "不同单位"

    result = run_renderer(tmp_path, invalid, basename="mismatched-args")

    assert result.returncode != 0
    assert "同一份 data" in result.stderr
    assert not (tmp_path / "mismatched-args-dark.html").exists()
