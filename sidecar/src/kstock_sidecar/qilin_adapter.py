from __future__ import annotations

from collections.abc import Callable
from typing import Any


class QiLinAdapter:
    def __init__(self, client_factory: Callable[[], Any | None] | None = None) -> None:
        self._client_factory = client_factory or self._default_client_factory
        self._client: Any | None = None

    def _default_client_factory(self) -> Any | None:
        try:
            from qilin.client import QiLinClient
        except Exception:
            return None
        return QiLinClient()

    def _client_or_none(self) -> Any | None:
        if self._client is None:
            self._client = self._client_factory()
        return self._client

    def health(self) -> dict[str, Any]:
        client = self._client_or_none()
        if client is None:
            return {
                "status": "unavailable",
                "engine": "qilin",
                "detail": "QiLin 引擎尚未就绪",
            }
        return {
            "status": "ok",
            "engine": "qilin",
            "detail": "QiLin 引擎可用",
        }
