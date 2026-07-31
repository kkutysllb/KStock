from __future__ import annotations

import sys
from typing import TextIO

from .protocol import Request, Response
from .qilin_adapter import QiLinAdapter


def dispatch_request(request: Request, adapter: QiLinAdapter | None = None) -> Response:
    adapter = adapter or QiLinAdapter()
    if request.method == "health":
        return Response(id=request.id, ok=True, result=adapter.health())
    if request.method in {"workspace.init", "workspace.info"}:
        return Response(id=request.id, ok=True, result=adapter.workspace_info())
    if request.method == "thread.create":
        title = request.params.get("title")
        project_id = request.params.get("projectId")
        return Response(
            id=request.id,
            ok=True,
            result=adapter.create_thread(
                title=title if isinstance(title, str) else None,
                project_id=project_id if isinstance(project_id, str) else None,
            ),
        )
    if request.method == "artifact.list":
        thread_id = request.params.get("threadId")
        if not isinstance(thread_id, str) or not thread_id:
            return Response(id=request.id, ok=False, error="缺少 threadId")
        project_id = request.params.get("projectId")
        return Response(
            id=request.id,
            ok=True,
            result=adapter.list_artifacts(
                thread_id,
                project_id=project_id if isinstance(project_id, str) else None,
            ),
        )
    return Response(
        id=request.id,
        ok=False,
        error=f"不支持的方法：{request.method}",
    )


def serve(stdin: TextIO | None = None, stdout: TextIO | None = None) -> None:
    stdin = stdin or sys.stdin
    stdout = stdout or sys.stdout
    adapter = QiLinAdapter()

    for raw_line in stdin:
        line = raw_line.strip()
        if not line:
            continue
        try:
            request = Request.model_validate_json(line)
            response = dispatch_request(request, adapter=adapter)
        except Exception as exc:  # pragma: no cover - defensive outer boundary
            response = Response(id="unknown", ok=False, error=str(exc))
        stdout.write(response.model_dump_json(ensure_ascii=False) + "\n")
        stdout.flush()


def main() -> None:
    serve()
