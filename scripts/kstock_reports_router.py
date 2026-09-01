"""Gateway endpoints for the user-scoped HTML report library."""

from __future__ import annotations

import logging
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse

from qilin.runtime.user_context import get_effective_user_id


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/kstock/reports", tags=["kstock-reports"])


def _store(request: Request):
    store = getattr(request.app.state, "kstock_report_store", None)
    if store is None:
        raise HTTPException(status_code=503, detail="报告库尚未初始化")
    return store


@router.get("")
def list_reports(request: Request, date: str | None = None, symbol: str | None = None, query: str | None = None):
    store = _store(request)
    user_id = get_effective_user_id()
    # 交付文件自动进库：扫描该用户全部线程 outputs 中未归档的 HTML 交付物
    # （兼容 render_html_report 工具改造前由技能 CLI 直调生成的历史产物）。
    qilin_home = Path(os.environ.get("QILIN_HOME") or "")
    if qilin_home.is_dir():
        try:
            store.scan_threads_and_archive(qilin_home / "users" / user_id / "threads", user_id)
        except Exception:
            logger.exception("报告库自动扫描归档失败")
    return {"reports": store.list_reports(user_id=user_id, date=date, symbol=symbol, query=query)}


@router.get("/{report_id}")
def get_report(report_id: str, request: Request):
    user_id = get_effective_user_id()
    row = _store(request).get_report(report_id, user_id=user_id)
    if row is None:
        raise HTTPException(status_code=404, detail="报告不存在")
    return {**row, "content_url": f"/api/v1/kstock/reports/{report_id}/content"}


@router.get("/{report_id}/content")
def get_report_content(report_id: str, request: Request):
    try:
        path = _store(request).open_report_path(report_id, user_id=get_effective_user_id())
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="报告不存在") from exc
    return FileResponse(
        path,
        media_type="text/html",
        headers={
            "Content-Disposition": "inline",
            # 直接用浏览器打开 content_url 时强制 opaque origin：脚本可继续
            # 运行（图表/交互不被破坏），但文档拿不到 gateway 同源下的
            # csrf_token cookie（httponly=False），无法构造带 X-CSRF-Token
            # 的同源调用——堵住「报告 HTML 落地浏览器 → 同源 RCE」链路。
            "Content-Security-Policy": "sandbox allow-scripts",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.delete("/{report_id}")
def delete_report(report_id: str, request: Request):
    store = _store(request)
    user_id = get_effective_user_id()
    if store.get_report(report_id, user_id=user_id) is None:
        raise HTTPException(status_code=404, detail="报告不存在")
    store.delete(report_id, user_id=user_id)
    return {"deleted": True, "report_id": report_id}
