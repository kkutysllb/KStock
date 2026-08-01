"""Runtime tool that renders and archives one offline HTML report."""

from __future__ import annotations

import json
import importlib.util
import os
import re
import tempfile
from pathlib import Path
from typing import Any, Annotated

from langchain.tools import tool, InjectedToolCallId
from langchain_core.messages import ToolMessage
from langgraph.types import Command

from scripts.kstock_reports import ReportLibraryStore
from qilin.tools.types import Runtime


_FILENAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,100}\.html$")
_RENDERER = Path(__file__).resolve().parents[2] / "vendor" / "skills" / "public" / "analysis-report" / "scripts" / "render_report.py"


def _renderer_module():
    spec = importlib.util.spec_from_file_location("kstock_analysis_report_renderer", _RENDERER)
    if spec is None or spec.loader is None:
        raise RuntimeError("analysis report renderer is unavailable")
    module = importlib.util.module_from_spec(spec)
    # render_report imports report_contract from its own directory.
    import sys
    sys.path.insert(0, str(_RENDERER.parent))
    try:
        spec.loader.exec_module(module)
    finally:
        sys.path.pop(0)
    return module


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

    Args:
        report_json: Structured analysis report JSON matching the analysis-report contract.
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
        renderer = _renderer_module()
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".json", delete=False) as handle:
            json.dump(payload, handle, ensure_ascii=False)
            temporary_input = Path(handle.name)
        output_path = renderer.render_report(temporary_input, outputs_dir, Path(filename).stem)
        store = ReportLibraryStore(Path(os.environ["KSTOCK_APP_DATA_DIR"]))
        metadata = {
            "user_id": user_id,
            "title": payload.get("title"),
            "symbol": (payload.get("subject") or {}).get("symbol"),
            "report_type": payload.get("report_type"),
            "generated_at": payload.get("generated_at"),
            "period_start": (payload.get("period") or {}).get("start"),
            "period_end": (payload.get("period") or {}).get("end"),
            "risk_level": (payload.get("assessment") or {}).get("risk_level"),
            "coverage_status": "complete" if all(s.get("status") == "available" for s in payload.get("sections", [])) else "partial",
        }
        row = store.archive(output_path, payload["report_id"], thread_id, metadata)
        result = {
            "report_id": payload["report_id"],
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
