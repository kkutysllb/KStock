from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime
import mimetypes
import os
import sys
from pathlib import Path
from typing import Any
import uuid

from .config import SidecarConfig
from .data_space import DataSpaceInfo, KStockDataSpace


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
        self._data_space_info: DataSpaceInfo | None = None

    def _ensure_data_space(self) -> DataSpaceInfo:
        if self._data_space_info is None:
            data_space = KStockDataSpace(
                app_data_dir=self._config.app_data_dir,
                skill_root=self._config.skill_root,
                repo_root=self._config.repo_root,
                development_fallback=self._config.development_fallback,
            )
            self._data_space_info = data_space.ensure()
        return self._data_space_info

    def _ensure_qilin_environment(self) -> Path:
        info = self._ensure_data_space()
        qilin_repo_path = self._config.qilin_repo_path.resolve()
        if str(qilin_repo_path) not in sys.path:
            sys.path.insert(0, str(qilin_repo_path))
        os.environ["QILIN_PROJECT_ROOT"] = str(self._config.repo_root.resolve())
        os.environ["QILIN_CONFIG_PATH"] = str(info.runtime_config_path.resolve())
        os.environ["QILIN_HOME"] = str(info.qilin_home.resolve())
        os.environ["QILIN_SKILLS_PATH"] = str(info.skill_root.resolve())
        os.environ["KSTOCK_APP_DATA_DIR"] = str(info.app_data_dir.resolve())
        return qilin_repo_path

    def _data_space_payload(self, info: DataSpaceInfo | None = None) -> dict[str, object]:
        info = info or self._ensure_data_space()
        return KStockDataSpace(
            info.app_data_dir,
            skill_root=info.skill_root,
            repo_root=self._config.repo_root,
            development_fallback=info.is_development_fallback,
        ).as_dict(info)

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
        info = self._ensure_data_space()
        data_space = self._data_space_payload(info)
        client = self._client_or_none()
        if client is None:
            return {
                "status": "unavailable",
                "engine": "qilin",
                "detail": self._client_error or "QiLin 引擎尚未就绪",
                "source": str(qilin_repo_path),
                "config": str(info.runtime_config_path.resolve()),
                "dataSpace": data_space,
            }
        return {
            "status": "ok",
            "engine": "qilin",
            "detail": "QiLin 引擎可用",
            "source": str(qilin_repo_path),
            "config": str(info.runtime_config_path.resolve()),
            "dataSpace": data_space,
        }

    def workspace_info(self) -> dict[str, object]:
        return self._data_space_payload()

    def create_thread(self, *, title: str | None = None, project_id: str | None = None) -> dict[str, object]:
        self._ensure_qilin_environment()
        info = self._ensure_data_space()
        thread_id = f"thread_{uuid.uuid4().hex[:16]}"

        from qilin.config.paths import get_paths

        paths = get_paths()
        paths.ensure_thread_dirs(thread_id, user_id=info.active_user_id)

        if project_id:
            from .product_store import ProductStore

            store = ProductStore(info.product_db_path)
            store.ensure_schema()
            store.link_thread(project_id, thread_id, title=title)

        return {
            "threadId": thread_id,
            "userId": info.active_user_id,
            "title": title,
            "createdAt": datetime.now(UTC).isoformat(),
            "paths": {
                "workspace": "/mnt/user-data/workspace",
                "uploads": "/mnt/user-data/uploads",
                "outputs": "/mnt/user-data/outputs",
                "hostThreadDir": str(paths.thread_dir(thread_id, user_id=info.active_user_id)),
            },
        }

    def list_artifacts(self, thread_id: str, *, project_id: str | None = None) -> dict[str, object]:
        self._ensure_qilin_environment()
        info = self._ensure_data_space()

        from qilin.config.paths import get_paths

        from .product_store import ProductStore

        outputs_dir = get_paths().sandbox_outputs_dir(thread_id, user_id=info.active_user_id)
        outputs_dir.mkdir(parents=True, exist_ok=True)

        store = ProductStore(info.product_db_path)
        store.ensure_schema()

        artifacts: list[dict[str, object]] = []
        for path in sorted(outputs_dir.iterdir()):
            if not path.is_file():
                continue
            mime_type, _ = mimetypes.guess_type(path.name)
            resolved_mime_type = mime_type or "application/octet-stream"
            virtual_path = f"/mnt/user-data/outputs/{path.name}"
            report = store.upsert_report_asset(
                thread_id=thread_id,
                project_id=project_id,
                title=path.stem,
                filename=path.name,
                virtual_path=virtual_path,
                host_path=str(path),
                mime_type=resolved_mime_type,
            )
            artifacts.append(
                {
                    "id": report["id"],
                    "filename": path.name,
                    "virtualPath": virtual_path,
                    "hostPath": str(path),
                    "mimeType": resolved_mime_type,
                    "size": path.stat().st_size,
                }
            )
        return {"threadId": thread_id, "count": len(artifacts), "artifacts": artifacts}
