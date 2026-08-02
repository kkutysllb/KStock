"""Runtime tool that renders and archives one offline HTML report."""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import tempfile
from pathlib import Path
from typing import Any, Annotated

from langchain.tools import tool, InjectedToolCallId
from langchain_core.messages import ToolMessage
from langgraph.types import Command

from scripts.kstock_reports import ReportLibraryStore
from scripts.kstock_reports_renderer import render
from qilin.tools.types import Runtime


_FILENAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,100}\.html$")


def _runtime_context(runtime: Any) -> dict[str, Any]:
    context = getattr(runtime, "context", None)
    return context if isinstance(context, dict) else {}


def _thread_data(runtime: Any) -> dict[str, Any]:
    state = getattr(runtime, "state", None)
    if isinstance(state, dict) and isinstance(state.get("thread_data"), dict):
        return state["thread_data"]
    return {}


def _user_id(runtime: Any) -> str:
    context = _runtime_context(runtime)
    value = context.get("user_id")
    if value:
        return str(value)
    from qilin.runtime.user_context import get_effective_user_id
    return str(get_effective_user_id())


def _thread_id(runtime: Any) -> str:
    context = _runtime_context(runtime)
    value = context.get("thread_id") or _thread_data(runtime).get("thread_id")
    if not value:
        raise ValueError("当前运行上下文缺少 thread_id")
    return str(value)


@tool("render_html_report", parse_docstring=True)
def render_html_report_tool(
    runtime: Runtime,
    report_json: str,
    tool_call_id: Annotated[str, InjectedToolCallId],
    filename: str = "report.html",
) -> Command:
    """Render one structured report JSON into an offline HTML dashboard.

    Report JSON contract (LLM 生成时必须遵守):
    - 顶层必填: title(string), generated_at(string, 真实执行时间), summary(string),
      assessment(string), risk_level(string), data_overview(array<{label,value,unit?}>),
      core_analysis(array<{title,content}>), risks(array<{title,detail}>),
      references(array<string>), charts(array, 至少 3 个图表)。
    - charts[] 每项: {tool, title, alt, args}。tool 取值: generate_line_chart /
      generate_bar_chart / generate_column_chart / generate_pie_chart /
      generate_radar_chart / generate_scatter_chart / generate_area_chart /
      generate_spreadsheet。args.data 为记录数组，行字段按 tool 区分: line/area
      (time,value[,group])、bar/column (category,value[,group])、pie (category,value)、
      radar (name,value[,group])、scatter (x,y[,group])。spreadsheet 支持两种格式任选其一:
      (a) rows=string[][] 二维数组，首行即表头；(b) data=array<object> + 可选 columns
      (string[] 指定列序)。表格以完整 <table> 渲染，禁止用图表替代表格。
      图表以内嵌 SVG 渲染，禁止使用远程图片 URL。
    - 可选归档字段: report_id / subject{symbol} / period{start,end} /
      sections[{status}] / report_type，用于报告库元数据。
    - 全部数值必须与数据源输出一致，禁止改写或编造；表格数据必须完整收录。

    Args:
        report_json: 符合上述契约的结构化报告 JSON 字符串。
        filename: Safe HTML filename written to the current thread outputs.
    """
    output_path: Path | None = None
    temporary_input: Path | None = None
    try:
        if not isinstance(filename, str) or not _FILENAME.fullmatch(filename):
            raise ValueError("filename must be a safe .html filename")
        payload = json.loads(report_json) if isinstance(report_json, str) else report_json
        if not isinstance(payload, dict):
            raise ValueError("report_json must be a JSON object")
        thread_id = _thread_id(runtime)
        user_id = _user_id(runtime)
        thread_data = _thread_data(runtime)
        outputs = thread_data.get("outputs_path")
        if not outputs:
            raise ValueError("当前运行上下文缺少 outputs_path")
        outputs_dir = Path(outputs).resolve()
        outputs_dir.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".json", delete=False) as handle:
            json.dump(payload, handle, ensure_ascii=False)
            temporary_input = Path(handle.name)
        # render 引擎输出 {stem}.md / {stem}-dark.html / {stem}-light.html 三份产物；
        # 交付文件名按调用方指定的 filename（如 report.html）落盘，取 dark 版拷贝。
        _, dark_path, _ = render(temporary_input, outputs_dir, Path(filename).stem)
        output_path = outputs_dir / filename
        if dark_path.resolve() != output_path.resolve():
            shutil.copyfile(dark_path, output_path)
        store = ReportLibraryStore(Path(os.environ["KSTOCK_APP_DATA_DIR"]))
        # 工具契约不含 report_id，按标题稳定派生以便重复生成覆盖归档。
        report_id = str(payload.get("report_id") or "")
        if not report_id:
            title = str(payload.get("title") or "report")
            report_id = "report-" + hashlib.sha256(title.encode("utf-8")).hexdigest()[:12]
        subject = payload.get("subject")
        period = payload.get("period")
        assessment = payload.get("assessment")
        sections = payload.get("sections")
        risk_level = payload.get("risk_level")
        if not risk_level and isinstance(assessment, dict):
            risk_level = assessment.get("risk_level")
        metadata = {
            "user_id": user_id,
            "title": payload.get("title"),
            "symbol": (subject or {}).get("symbol") if isinstance(subject, dict) else None,
            "report_type": payload.get("report_type") or "analysis",
            "generated_at": payload.get("generated_at"),
            "period_start": (period or {}).get("start") if isinstance(period, dict) else None,
            "period_end": (period or {}).get("end") if isinstance(period, dict) else None,
            "risk_level": risk_level,
            "coverage_status": (
                "complete" if all(s.get("status") == "available" for s in sections) else "partial"
            ) if isinstance(sections, list) and sections else "complete",
        }
        row = store.archive(output_path, report_id, thread_id, metadata)
        result = {
            "report_id": report_id,
            "thread_id": thread_id,
            "thread_virtual_path": f"/outputs/{filename}",
            "library_relative_path": row["relative_path"],
            "size_bytes": row["size_bytes"],
        }
        # 写回 ThreadState.artifacts（与 present_files 同款模式），
        # 前端 ReportPanel 才能通过 values 快照展示报告产物。
        return Command(
            update={
                "artifacts": [f"/outputs/{filename}"],
                "messages": [ToolMessage(json.dumps(result, ensure_ascii=False), tool_call_id=tool_call_id)],
            }
        )
    except Exception as exc:
        return Command(
            update={
                "messages": [ToolMessage(f"{{'error': {str(exc)!r}}}", tool_call_id=tool_call_id, status="error")]
            }
        )
    finally:
        if temporary_input:
            temporary_input.unlink(missing_ok=True)
