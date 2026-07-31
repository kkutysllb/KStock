from __future__ import annotations

from collections.abc import Callable
import os
import sys
from pathlib import Path
from typing import Any

from .config import REPO_ROOT, SidecarConfig


class QiLinAdapter:
    def __init__(
        self,
        client_factory: Callable[[], Any | None] | None = None,
        config: SidecarConfig | None = None,
    ) -> None:
        self._config = config or SidecarConfig()
        self._client_factory = client_factory or self._default_client_factory
        self._client: Any | None = None
        self._client_error: str | None = None

    def _ensure_qilin_environment(self) -> Path:
        qilin_repo_path = self._config.qilin_repo_path.resolve()
        if str(qilin_repo_path) not in sys.path:
            sys.path.insert(0, str(qilin_repo_path))
        os.environ.setdefault("QILIN_PROJECT_ROOT", str(REPO_ROOT))
        os.environ.setdefault("QILIN_CONFIG_PATH", str(self._config.qilin_config_path.resolve()))
        os.environ.setdefault("QILIN_HOME", str(self._config.qilin_home.resolve()))
        os.environ.setdefault("QILIN_SKILLS_PATH", str(self._config.skill_root.resolve()))
        return qilin_repo_path

    def _default_client_factory(self) -> Any | None:
        self._ensure_qilin_environment()
        try:
            from qilin.client import QiLinClient
        except Exception:
            return None
        return QiLinClient()

    def _client_or_none(self) -> Any | None:
        if self._client is None:
            try:
                self._client = self._client_factory()
                self._client_error = None
            except Exception as exc:
                self._client_error = str(exc)
                return None
        return self._client

    def health(self) -> dict[str, Any]:
        qilin_repo_path = self._ensure_qilin_environment()
        client = self._client_or_none()
        if client is None:
            return {
                "status": "unavailable",
                "engine": "qilin",
                "detail": self._client_error or "QiLin 引擎尚未就绪",
                "source": str(qilin_repo_path),
                "config": str(self._config.qilin_config_path.resolve()),
            }
        return {
            "status": "ok",
            "engine": "qilin",
            "detail": "QiLin 引擎可用",
            "source": str(qilin_repo_path),
            "config": str(self._config.qilin_config_path.resolve()),
        }
