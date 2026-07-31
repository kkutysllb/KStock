r"""KStock QiLin gateway 启动入口（uv 运行）。

用途
----
在项目根目录用 uv 管理的 ``.venv`` 里启动内置 QiLin gateway，作为桌面端
登录注册与对话能力的本地后端：

    uv run python scripts/run_gateway.py

为什么需要这个入口（而不是直接 ``uvicorn app.gateway.app:app``）
---------------------------------------------------------------
``vendor/qilin`` 是只读快照，但当前快照 (config_version 31) 存在一处上游
不一致：``app/gateway/routers/mcp.py`` 引用了
``qilin.config.extensions_config`` 中尚未提供的三个符号——

- ``extensions_config_write_lock``
- ``atomic_write_extensions_config``
- ``normalize_mcp_transport_alias``

这三个符号只服务于 MCP 扩展配置的写入与 transport 别名规范化，与本地账户
登录注册流程完全无关，但它们在 ``mcp.py`` 模块顶层被 import，会阻断整个
gateway 的导入链。

按"vendor 仓库保持只读、所有产品定制只存在于 KStock"的原则，这里在导入
gateway 之前为上述三个符号注入兼容实现（带 ``hasattr`` 防御），构成一层
薄兼容垫片。待上游 QiLin 修复后通过 ``scripts/sync_upstreams.py`` 同步，
本垫片的 ``hasattr`` 分支会自动失效，可随后移除。

环境约定（用户数据空间）
------------------------
严格遵循《用户数据空间组织设计》：正式桌面端必须把用户数据放到跨平台
系统应用数据目录，而不是仓库内。本入口负责解析数据根目录、生成运行时
配置、建立完整目录结构：

- 数据根目录 ``KSTOCK_APP_DATA_DIR``（优先级见 ``_resolve_app_data_root``）：
    - macOS：``~/Library/Application Support/KStock``
    - Windows：``%APPDATA%\KStock``
    - Linux：``~/.local/share/KStock``
- 运行时环境变量（由本入口注入）：
    - ``QILIN_CONFIG_PATH`` → ``<数据根>/config/qilin.runtime.yaml``
    - ``QILIN_HOME``        → ``<数据根>/runtime/qilin``
    - ``KSTOCK_APP_DATA_DIR`` → ``<数据根>``

关键修复：vendor 的 ``DatabaseConfig.sqlite_dir`` 默认值是相对 CWD 的
``.qilin/data``，若不显式配置，数据库会错误落到项目根 ``.qilin/``。本入口
生成 ``qilin.runtime.yaml`` 时强制写入 ``database.sqlite_dir`` 为数据根下的
绝对路径，确保用户、线程、会话等所有 QiLin 运行时真源都落在用户数据目录。
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
import threading
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent

# 直接运行 ``python scripts/run_gateway.py`` 时 sys.path[0] 是 scripts/ 而非
# 仓库根，需显式注入才能 ``from scripts.xxx import ...``（kstock_models 等）。
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


def _apply_vendor_extensions_config_compat_shim() -> None:
    """为 vendor/qilin 快照缺失的 extensions_config 符号注入兼容实现。

    幂等且带 ``hasattr`` 防御：上游修复并重新同步后，这些分支会自动跳过，
    不会覆盖上游实现。
    """
    import qilin.config.extensions_config as ec

    # 1) 写入串行化锁 —— mcp.py 第 369 行 ``with extensions_config_write_lock:``
    if not hasattr(ec, "extensions_config_write_lock"):
        ec.extensions_config_write_lock = threading.Lock()

    # 2) 原子写入 extensions config —— mcp.py 第 412 行
    #    语义：把 config_data(dict) 以原子方式写入 config_path(Path/str)。
    if not hasattr(ec, "atomic_write_extensions_config"):
        def atomic_write_extensions_config(config_path: Any, config_data: Any) -> None:
            path = str(config_path)
            directory = os.path.dirname(path) or "."
            os.makedirs(directory, exist_ok=True)
            fd, tmp = tempfile.mkstemp(prefix=".ext_cfg_", suffix=".json", dir=directory)
            try:
                with os.fdopen(fd, "w", encoding="utf-8") as fh:
                    json.dump(config_data, fh, ensure_ascii=False, indent=2)
                os.replace(tmp, path)
            except Exception:
                if os.path.exists(tmp):
                    os.remove(tmp)
                raise

        ec.atomic_write_extensions_config = atomic_write_extensions_config

    # 3) transport 别名规范化 —— mcp.py 第 76 行（Pydantic model_validator before）
    #    语义：接收 model 原始输入 data，若为 dict 则规范 transport 字段别名后返回。
    if not hasattr(ec, "normalize_mcp_transport_alias"):
        _TRANSPORT_ALIASES: dict[str, str] = {
            "http": "streamable_http",
            "streamablehttp": "streamable_http",
            "ws": "sse",
            "websocket": "sse",
        }

        def normalize_mcp_transport_alias(data: Any) -> Any:
            if not isinstance(data, dict):
                return data
            for key in ("type", "transport"):
                raw = data.get(key)
                if isinstance(raw, str):
                    normalized = _TRANSPORT_ALIASES.get(raw.strip().lower(), raw.strip().lower())
                    data[key] = normalized
            return data

        ec.normalize_mcp_transport_alias = normalize_mcp_transport_alias


def _resolve_app_data_root() -> Path:
    """解析 KStock 用户数据根目录（跨平台）。

    优先级：
    1. ``KSTOCK_APP_DATA_DIR`` 环境变量 —— Tauri 正式运行时由宿主注入
       （``app_data_dir`` 命令解析系统目录后设此变量），命令行调试时也可
       显式指定。
    2. 系统标准 app data 目录（跨平台），与设计文档约定一致。

    遵循《用户数据空间组织设计》第 1 节：正式桌面端必须把用户数据放到跨
    平台系统应用数据目录，而不是仓库内的 ``.kstock``。
    """
    env_root = os.environ.get("KSTOCK_APP_DATA_DIR")
    if env_root:
        return Path(env_root).expanduser()

    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "KStock"
    if sys.platform == "win32":
        appdata = os.environ.get("APPDATA") or str(Path.home() / "AppData" / "Roaming")
        return Path(appdata) / "KStock"
    # Linux / 其他 POSIX：邗守 XDG_DATA_HOME
    xdg = os.environ.get("XDG_DATA_HOME") or str(Path.home() / ".local" / "share")
    return Path(xdg) / "KStock"


def _generate_runtime_config(
    runtime_config_path: Path,
    qilin_data_dir: Path,
    repo_root: Path,
) -> None:
    """生成 ``qilin.runtime.yaml``，显式写入用户数据空间的绝对路径。

    以发布包模板 ``config/qilin.config.yaml`` 为基础，覆盖路径相关字段：
    - ``database.backend`` = sqlite、``database.sqlite_dir`` = 绝对路径
    - ``run_events.backend`` = db（使运行事件进入 SQLite）
    - ``skills.root`` = 仓库内 ``vendor/skills`` 的绝对路径

    这是修复数据库错误落到项目根 ``.qilin/`` 的核心：vendor 的
    ``DatabaseConfig.sqlite_dir`` 默认值 ``.qilin/data`` 是相对 CWD 的，
    不显式配置就会写到仓库里。
    """
    import yaml

    template_path = repo_root / "config" / "qilin.config.yaml"
    with template_path.open("r", encoding="utf-8") as fh:
        cfg: dict[str, Any] = yaml.safe_load(fh) or {}

    # ── 持久化层：强制 SQLite 落到用户数据目录的绝对路径 ──────────────
    database = dict(cfg.get("database") or {})
    database["backend"] = "sqlite"
    database["sqlite_dir"] = str(qilin_data_dir)
    cfg["database"] = database

    # 运行事件进入数据库，与设计文档一致
    run_events = dict(cfg.get("run_events") or {})
    run_events["backend"] = "db"
    cfg["run_events"] = run_events

    # 技能根目录转绝对路径（模板里是相对 ``vendor/skills``）
    skills = dict(cfg.get("skills") or {})
    skills_root = skills.get("root", "vendor/skills")
    cfg["skills"] = {**skills, "root": str((repo_root / skills_root).resolve())}

    runtime_config_path.parent.mkdir(parents=True, exist_ok=True)
    with runtime_config_path.open("w", encoding="utf-8") as fh:
        yaml.safe_dump(cfg, fh, allow_unicode=True, sort_keys=False)


def _ensure_data_space() -> dict[str, Path]:
    """初始化 KStock 用户数据空间并注入运行时环境变量。

    建立设计文档定义的目录结构，生成运行时配置，返回关键路径供日志输出。
    """
    data_root = _resolve_app_data_root()
    config_dir = data_root / "config"
    runtime_qilin = data_root / "runtime" / "qilin"
    qilin_data_dir = runtime_qilin / "data"
    logs_dir = data_root / "logs"
    product_dir = data_root / "product"

    # 建立目录结构（见设计文档「目录结构」）
    for directory in (config_dir, qilin_data_dir, logs_dir, product_dir):
        directory.mkdir(parents=True, exist_ok=True)

    # 生成运行时配置（显式写入 database.sqlite_dir 绝对路径）
    runtime_config_path = config_dir / "qilin.runtime.yaml"
    _generate_runtime_config(runtime_config_path, qilin_data_dir, REPO_ROOT)

    # 注入运行时环境变量（设计文档「配置生成」）
    os.environ["KSTOCK_APP_DATA_DIR"] = str(data_root)
    os.environ["QILIN_CONFIG_PATH"] = str(runtime_config_path)
    os.environ["QILIN_HOME"] = str(runtime_qilin)

    return {
        "data_root": data_root,
        "runtime_config": runtime_config_path,
        "qilin_home": runtime_qilin,
        "qilin_data_dir": qilin_data_dir,
    }


def _configure_gateway_security() -> None:
    """注入桌面端 webview 的 CORS origin 白名单。

    桌面端 webview (Vite dev / Tauri 打包) 与 gateway 同在 ``localhost``，
    但 origin 不同源；必须显式加入 ``GATEWAY_CORS_ORIGINS``。FastAPI 的
    ``CORSMiddleware`` (allow_credentials=True) 与 ``CSRFMiddleware`` 的
    origin 白名单均读该变量。覆盖开发态与跨平台打包态。
    """
    desktop_origins = [
        "http://localhost:1420",      # Vite dev server（Tauri dev / 浏览器预览）
        "http://127.0.0.1:1420",      # Vite dev 备用
        "tauri://localhost",          # Tauri macOS / Linux 打包
        "https://tauri.localhost",    # Tauri Windows 打包
    ]
    existing = os.environ.get("GATEWAY_CORS_ORIGINS", "").strip()
    if existing:
        configured = {o.strip() for o in existing.split(",") if o.strip()}
        merged = list(configured) + [o for o in desktop_origins if o not in configured]
        os.environ["GATEWAY_CORS_ORIGINS"] = ",".join(merged)
    else:
        os.environ["GATEWAY_CORS_ORIGINS"] = ",".join(desktop_origins)


def create_app():
    """应用工厂：先打垫片、初始化用户数据空间、配 CORS，再构造 QiLin gateway。"""
    _apply_vendor_extensions_config_compat_shim()
    paths = _ensure_data_space()
    _configure_gateway_security()
    # 启动日志：明确告知用户数据落点，便于排查
    print("=" * 64, flush=True)
    print("KStock 用户数据空间", flush=True)
    print(f"  数据根目录     : {paths['data_root']}", flush=True)
    print(f"  运行时配置     : {paths['runtime_config']}", flush=True)
    print(f"  QILIN_HOME     : {paths['qilin_home']}", flush=True)
    print(f"  SQLite 数据库  : {paths['qilin_data_dir'] / 'qilin.db'}", flush=True)
    print(f"  CORS origins   : {os.environ['GATEWAY_CORS_ORIGINS']}", flush=True)
    print("=" * 64, flush=True)
    from app.gateway.app import create_app as _create_app

    app = _create_app()

    # KStock 自有的模型配置写入层（vendor 引擎只读，本路由提供 CRUD）
    from scripts.kstock_models import router as kstock_models_router

    app.include_router(kstock_models_router)
    return app


# uvicorn 通过模块路径加载时需要模块级 ``app``
app = create_app()


if __name__ == "__main__":
    import uvicorn

    # 绑定 localhost（而非 127.0.0.1）：与前端 Vite dev (localhost:1420) 同属
    # localhost registrable domain，浏览器将 access_token cookie 视为 same-site，
    # fetch 带 credentials:"include" 时可正常携带。
    host = os.environ.get("GATEWAY_HOST", "localhost")
    port = int(os.environ.get("GATEWAY_PORT", "18001"))
    # 直接传 app 对象：脚本入口运行时 cwd 不一定是项目根，字符串导入会
    # 找不到 scripts 包；传对象更稳健，且本入口不启用 reload。
    uvicorn.run(
        app,
        host=host,
        port=port,
    )
