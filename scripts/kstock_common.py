"""KStock 产品层共享小工具：数据根路径 / 原子写 / pydantic 校验错误明细。

从 kstock_models / kstock_general_settings / kstock_extensions_config /
kstock_runtime_config 收敛的同构实现，避免各路由模块各自复制。
静态导入即可被 PyInstaller 自动打包，无需加入 spec hiddenimports。
"""

from __future__ import annotations

import json
import os
import shutil
import tempfile
from collections.abc import Callable
from pathlib import Path
from typing import Any


def data_root() -> Path:
    """返回当前 KStock 用户数据根目录（由 run_gateway.py 注入环境变量）。"""
    return Path(os.environ["KSTOCK_APP_DATA_DIR"])


def atomic_write(
    path: Path,
    write: Callable[[Any], None],
    *,
    backup_dir: Path | None = None,
    append_newline: bool = False,
) -> None:
    """把 ``write(fh)`` 的输出原子写入 path（tmp 文件 + os.replace）。

    - ``backup_dir`` 提供时，写前把原文件备份为
      ``<backup_dir>/<name>.<mtime_ms>.bak``（runtime.yaml 场景的产品级要求）。
    - ``append_newline`` 为 True 时末尾补一个换行（JSON 落盘的既有约定）。
    失败时清理 tmp 并原样抛出，目标文件不被破坏。
    """
    if backup_dir is not None and path.exists():
        backup_dir.mkdir(parents=True, exist_ok=True)
        backup_name = f"{path.name}.{int(path.stat().st_mtime * 1000)}.bak"
        shutil.copy2(path, backup_dir / backup_name)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            write(fh)
            if append_newline:
                fh.write("\n")
        os.replace(tmp, str(path))
    except Exception:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise


def write_json_atomic(
    path: Path,
    data: dict[str, Any],
    *,
    backup_dir: Path | None = None,
) -> None:
    """以既有 JSON 落盘约定（ensure_ascii=False + indent=2 + 末尾换行）原子写入。"""
    atomic_write(
        path,
        lambda fh: json.dump(data, fh, ensure_ascii=False, indent=2),
        backup_dir=backup_dir,
        append_newline=True,
    )


def validation_error_details(exc: Exception) -> list[dict[str, str]]:
    """pydantic ValidationError → 字段级错误明细（前端定位用）。

    非 pydantic 异常（无 ``errors()``）降级为单条 root 错误。
    """
    errors: list[dict[str, str]] = []
    if hasattr(exc, "errors"):
        for err in exc.errors():
            loc = ".".join(str(p) for p in err["loc"])
            errors.append({"field": loc or "(root)", "message": err["msg"], "type": err["type"]})
    else:
        errors.append({"field": "(root)", "message": str(exc), "type": "value_error"})
    return errors