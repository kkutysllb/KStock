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
    return result, (tmp_path / "outputs/report.html").read_text(encoding="utf-8")


def _minimum_chart_fillers():
    return [
        {
            "tool": "generate_line_chart",
            "title": "填充趋势 A",
            "alt": "填充趋势 A",
            "args": {"data": [{"time": "D0", "value": 1}, {"time": "D1", "value": 2}]},
        },
        {
            "tool": "generate_line_chart",
            "title": "填充趋势 B",
            "alt": "填充趋势 B",
            "args": {"data": [{"time": "D0", "value": 2}, {"time": "D1", "value": 1}]},
        },
    ]


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


def test_radar_chart_accepts_group_only_dimension_rows(tmp_path, monkeypatch):
    """回归：agent 易把雷达图维度名误放到 group，renderer 应归一化而非卡死重试。"""
    p = payload()
    p["charts"] = [
        p["charts"][0],
        p["charts"][1],
        {
            "tool": "generate_radar_chart",
            "title": "7只ETF综合评分雷达",
            "alt": "ETF评分雷达",
            "args": {
                "data": [
                    {"value": 55, "group": "沪深300ETF"},
                    {"value": 55, "group": "中证500ETF"},
                    {"value": 38, "group": "上证50ETF"},
                ]
            },
        },
    ]

    monkeypatch.setenv("KSTOCK_APP_DATA_DIR", str(tmp_path / "data"))
    result = render_html_report_tool.func(
        runtime(tmp_path), json.dumps(p, ensure_ascii=False), "call-radar"
    )

    assert "error" not in result.update["messages"][0].content
    html = (tmp_path / "outputs/report.html").read_text(encoding="utf-8")
    assert "沪深300ETF" in html
    assert "中证500ETF" in html


def test_chart_alias_axis_labels_are_normalized(tmp_path, monkeypatch):
    """回归：agent 常生成 x_label/y_label，renderer 应归一化为官方 axis*Title。"""
    p = payload()
    p["charts"][0]["args"]["x_label"] = "ETF"
    p["charts"][0]["args"]["y_label"] = "评分"

    result, html = _render_report(tmp_path, monkeypatch, p)

    assert "error" not in result.update["messages"][0].content
    assert "测试看板" in html


def test_scatter_chart_accepts_optional_name_label(tmp_path, monkeypatch):
    """回归：散点图行携带 name 标签时不应因额外字段阻断整份报告。"""
    p = payload()
    p["charts"] = [
        p["charts"][0],
        p["charts"][1],
        {
            "tool": "generate_scatter_chart",
            "title": "价跌幅度 vs 份额净变化",
            "alt": "背离象限图",
            "args": {
                "data": [
                    {"x": -2.10, "y": 18.252, "name": "沪深300ETF"},
                    {"x": -2.93, "y": 0.516, "name": "中证500ETF"},
                ]
            },
        },
    ]

    result, html = _render_report(tmp_path, monkeypatch, p)

    assert "error" not in result.update["messages"][0].content
    assert "价跌幅度 vs 份额净变化" in html


def test_html_dashboard_embeds_interactive_chart_runtime(tmp_path, monkeypatch):
    """HTML 看板必须是可交互图表：tooltip、高亮与表格排序均离线内嵌。"""
    p = payload()
    p["charts"] = [
        p["charts"][0],
        {
            "tool": "generate_pie_chart",
            "title": "成交额占比",
            "alt": "成交额占比",
            "args": {
                "data": [
                    {"category": "沪深300ETF", "value": 333.7},
                    {"category": "中证500ETF", "value": 299.9},
                    {"category": "创业板ETF", "value": 639.4},
                ]
            },
        },
        {
            "tool": "generate_spreadsheet",
            "title": "方向矩阵",
            "alt": "方向矩阵表格",
            "args": {
                "rows": [
                    ["品种", "评分", "方向"],
                    ["沪深300ETF", "55", "中性"],
                    ["上证50ETF", "38", "偏空"],
                ]
            },
        },
    ]

    result, html = _render_report(tmp_path, monkeypatch, p)

    assert "error" not in result.update["messages"][0].content
    assert 'id="chart-tooltip"' in html
    assert "data-tip=" in html
    assert "chart-mark" in html
    assert "data-sortable-table" in html
    assert "initDashboardInteractions" in html


def test_dashboard_uses_a_share_red_up_green_down_semantics(tmp_path, monkeypatch):
    """A 股习惯：上涨/流入/增加为红，跌/流出/减少为绿。"""
    p = payload()
    p["data_overview"] = [
        {"metric": "周涨跌幅", "current": "+2.10%", "change": "上涨"},
        {"metric": "主力资金", "current": "-12.40亿", "change": "流出"},
        {"metric": "ETF份额净变化", "current": "+18.25亿份", "change": "增加"},
    ]
    p["sections"] = [
        {
            "id": "flow",
            "title": "资金与份额",
            "metrics": [
                {"label": "主力净流入", "value": 631.2, "unit": "亿"},
                {"label": "份额减少", "value": -4.05, "unit": "亿份"},
            ],
            "charts": p["charts"],
        }
    ]

    result, html = _render_report(tmp_path, monkeypatch, p)

    assert "error" not in result.update["messages"][0].content
    assert "--up:" in html and "--down:" in html
    assert 'class="value value-up"' in html
    assert 'class="value value-down"' in html


def test_dashboard_cards_do_not_render_direction_as_full_width_red_rule(tmp_path, monkeypatch):
    """卡片方向色应落在数值/微型状态上，避免整条红线被误读成图表数据。"""
    p = payload()
    p["data_overview"] = [
        {"metric": "主力净流入", "current": "+631.2亿元", "change": "流入"},
    ]

    result, html = _render_report(tmp_path, monkeypatch, p)

    assert "error" not in result.update["messages"][0].content
    assert ".kpi.value-up::after" not in html
    assert ".metric.value-up::after" not in html
    assert "status-dot" in html


def test_bar_chart_colors_absolute_values_with_palette_not_red_green_semantics(tmp_path, monkeypatch):
    """Shibor/PCR/IV/余额等绝对值柱图不能因为数值为正就整片染成上涨红。"""
    p = payload()
    p["charts"] = [
        {
            "tool": "generate_bar_chart",
            "title": "Shibor 各期限利率（%）",
            "alt": "Shibor 期限利率",
            "args": {
                "data": [
                    {"category": "ON", "value": 1.41},
                    {"category": "1W", "value": 1.453},
                    {"category": "1Y", "value": 1.48},
                ]
            },
        }
    ] + _minimum_chart_fillers()

    result, html = _render_report(tmp_path, monkeypatch, p)

    assert "error" not in result.update["messages"][0].content
    assert 'data-tip="ON: 1.41"' in html
    assert html.count('fill="#e64646"') == 0
    assert html.count('fill="#22a06b"') == 0


def test_bar_chart_direction_distribution_uses_label_semantics(tmp_path, monkeypatch):
    """偏多/中性/偏空分布应按类别语义着色，而不是三个正数柱全变红。"""
    p = payload()
    p["charts"] = [
        {
            "tool": "generate_bar_chart",
            "title": "8 维度偏向分布",
            "alt": "8 维度偏向统计",
            "args": {
                "data": [
                    {"category": "偏多", "value": 5},
                    {"category": "中性", "value": 2},
                    {"category": "偏空", "value": 1},
                ]
            },
        }
    ] + _minimum_chart_fillers()

    result, html = _render_report(tmp_path, monkeypatch, p)

    assert "error" not in result.update["messages"][0].content
    assert 'data-tip="偏多: 5"' in html
    assert 'data-tip="偏空: 1"' in html
    assert html.count('fill="#e64646"') == 1
    assert html.count('fill="#22a06b"') == 1


def test_bar_chart_signed_money_flow_keeps_a_share_red_green_semantics(tmp_path, monkeypatch):
    """资金/份额/涨跌变化类图表继续遵循 A 股红涨绿跌、流入红流出绿。"""
    p = payload()
    p["charts"] = [
        {
            "tool": "generate_bar_chart",
            "title": "主力净流入/净流出 TOP",
            "alt": "主力净额",
            "args": {
                "data": [
                    {"category": "东山精密", "value": 32.5},
                    {"category": "宁德时代", "value": -12.4},
                ]
            },
        }
    ] + _minimum_chart_fillers()

    result, html = _render_report(tmp_path, monkeypatch, p)

    assert "error" not in result.update["messages"][0].content
    assert 'data-tip="东山精密: 32.5"' in html
    assert 'fill="#e64646"' in html
    assert 'fill="#22a06b"' in html


def test_dashboard_auto_renders_section_matrix_and_score_semantics(tmp_path, monkeypatch):
    """有 sections 时自动生成可排序分区矩阵；评分>=60 红，<=40 绿。"""
    p = payload()
    p["data_overview"] = [
        {"metric": "综合评分", "current": "62.0/100", "change": "偏多"},
    ]
    p["sections"] = [
        {
            "id": "basis",
            "title": "股指期货基差",
            "status": "ok",
            "summary": "评分 10 · 偏空",
            "metrics": [{"label": "评分", "value": 10, "unit": "/100"}],
            "charts": p["charts"],
        },
        {
            "id": "flow",
            "title": "主力资金流向",
            "status": "available",
            "summary": "评分 75 · 偏多",
            "metrics": [{"label": "评分", "value": 75, "unit": "/100"}],
        },
    ]

    result, html = _render_report(tmp_path, monkeypatch, p)

    assert "error" not in result.update["messages"][0].content
    assert "分区评分矩阵" in html
    assert "已覆盖" in html
    assert "主力资金流向" in html
    assert "股指期货基差" in html
    assert 'class="value value-up">62.0/100' in html
    assert 'class="value value-down">10/100' in html
    assert 'class="value value-up">75/100' in html


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


def test_all_negative_bar_chart_stays_inside_svg_viewbox(tmp_path, monkeypatch):
    """全负值柱图（如周跌幅/贴水）不能生成负 y 或超高矩形，避免图形溢出成横贯线。"""
    p = payload()
    p["charts"] = [
        {
            "tool": "generate_bar_chart",
            "title": "四品种周度涨跌（%）",
            "alt": "四品种周度涨跌",
            "args": {
                "data": [
                    {"category": "IF", "value": -2.1},
                    {"category": "IH", "value": -1.02},
                    {"category": "IC", "value": -3.05},
                    {"category": "IM", "value": -2.22},
                ]
            },
        }
    ] + _minimum_chart_fillers()

    result, html = _render_report(tmp_path, monkeypatch, p)

    assert "error" not in result.update["messages"][0].content
    assert 'y="-"' not in html
    assert 'height="-"' not in html
    assert 'height="600.0"' not in html
