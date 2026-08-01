"""Gateway endpoints for the user-scoped HTML report library."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse

from qilin.runtime.user_context import get_effective_user_id


router = APIRouter(prefix="/api/v1/kstock/reports", tags=["kstock-reports"])


def _store(request: Request):
    store = getattr(request.app.state, "kstock_report_store", None)
    if store is None:
        raise HTTPException(status_code=503, detail="报告库尚未初始化")
    return store


@router.get("")
def list_reports(request: Request, date: str | None = None, symbol: str | None = None, query: str | None = None):
    return {"reports": _store(request).list_reports(user_id=get_effective_user_id(), date=date, symbol=symbol, query=query)}


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
    return FileResponse(path, media_type="text/html", headers={"Content-Disposition": "inline"})


@router.delete("/{report_id}")
def delete_report(report_id: str, request: Request):
    store = _store(request)
    user_id = get_effective_user_id()
    if store.get_report(report_id, user_id=user_id) is None:
        raise HTTPException(status_code=404, detail="报告不存在")
    store.delete(report_id, user_id=user_id)
    return {"deleted": True, "report_id": report_id}
