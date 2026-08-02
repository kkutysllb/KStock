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
import logging
import os
import re
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
    - ``skills.path`` = 仓库内 ``vendor/skills`` 的绝对路径

    这是修复数据库错误落到项目根 ``.qilin/`` 的核心：vendor 的
    ``DatabaseConfig.sqlite_dir`` 默认值 ``.qilin/data`` 是相对 CWD 的，
    不显式配置就会写到仓库里。

    关键修复：仅当 ``runtime.yaml`` **不存在**时才生成。已存在时保留用户配置——
    用户通过设置页 API 写入的 models / memory / database 等配置必须跨重启
    持久化。早期实现每次启动都从模板重新生成，会覆盖整个文件，导致「每次
    重启都要重新配置模型」。

    已存在时的增量合并策略（产品级配置覆盖安全，用户级配置保留）：
    - ``tools`` 段：直接用模板覆盖。这是修复「老用户 runtime.yaml 缺 tools 段
      导致 agent 不识别工具」的关键——老版本首次启动生成的 yaml 没有这段，
      后续模板加上的内置工具必须能增量同步过来，否则 ``config.tools`` 为空，
      LLM 看不到任何工具。
    - ``subagents.custom_agents`` 段：按 name key 合并。模板里定义的预置角色
      （如 market-data-analyst）是产品级定义，覆盖用户改动（保证角色定义权威）；
      用户自己新增的同名以外的角色保留。
    - ``subagents.agents`` 段：按 name key 合并。模板里定义的 per-agent
      overrides（如 general-purpose.skills 技能白名单）是产品级默认，覆盖
      用户同名；用户自定义的 key 保留。
    - 其他 subagents 子字段（timeout_seconds / max_turns / max_total_per_run /
      token_budget）一律保留用户配置。
    """
    import yaml

    template_path = repo_root / "config" / "qilin.config.yaml"
    with template_path.open("r", encoding="utf-8") as fh:
        template_cfg: dict[str, Any] = yaml.safe_load(fh) or {}

    # 已存在：保留用户配置，增量合并产品级段（tools / subagents.custom_agents）
    if runtime_config_path.exists():
        with runtime_config_path.open("r", encoding="utf-8") as fh:
            existing: dict[str, Any] = yaml.safe_load(fh) or {}
        changed = False

        # 1) tools 段：直接用模板覆盖（产品级，非用户级）
        template_tools = template_cfg.get("tools")
        if template_tools and existing.get("tools") != template_tools:
            existing["tools"] = template_tools
            changed = True

        # 2) subagents.custom_agents 段：按 name key 合并
        #    模板里的预置角色 → 覆盖用户同名角色（产品级定义权威）
        #    用户自定义的独立 name → 保留
        template_subagents = template_cfg.get("subagents") or {}
        template_custom_agents = template_subagents.get("custom_agents") or {}
        if template_custom_agents:
            existing_subagents = dict(existing.get("subagents") or {})
            existing_custom_agents = dict(existing_subagents.get("custom_agents") or {})
            for agent_name, agent_def in template_custom_agents.items():
                if existing_custom_agents.get(agent_name) != agent_def:
                    existing_custom_agents[agent_name] = agent_def
                    changed = True
            if existing_custom_agents != existing_subagents.get("custom_agents"):
                existing_subagents["custom_agents"] = existing_custom_agents
                existing["subagents"] = existing_subagents

        # 3) subagents.agents 段：按 name key 合并（模板 key 权威，用户 key 保留）
        #    agents 段是内置子代理的 per-agent overrides（timeout/max_turns/
        #    model/skills）。模板里定义的 key（如 general-purpose.skills 技能
        #    白名单）是产品级默认，覆盖用户同名；用户自定义的 key 保留。
        template_agents = template_subagents.get("agents") or {}
        if template_agents:
            existing_subagents = dict(existing.get("subagents") or {})
            existing_agents = dict(existing_subagents.get("agents") or {})
            for agent_name, agent_def in template_agents.items():
                if existing_agents.get(agent_name) != agent_def:
                    existing_agents[agent_name] = agent_def
                    changed = True
            if existing_agents != existing_subagents.get("agents"):
                existing_subagents["agents"] = existing_agents
                existing["subagents"] = existing_subagents

        # 4) skills.root → skills.path 字段迁移（引擎只认 path，旧配置的 root
        #    被 Pydantic 静默忽略导致技能系统失效；绝对路径保持用户值）
        existing_skills = dict(existing.get("skills") or {})
        if "path" not in existing_skills and "root" in existing_skills:
            existing_skills["path"] = existing_skills.pop("root")
            existing["skills"] = existing_skills
            changed = True

        if changed:
            with runtime_config_path.open("w", encoding="utf-8") as fh:
                yaml.safe_dump(existing, fh, allow_unicode=True, sort_keys=False)
        return

    # 首次生成：以模板为基础
    cfg = template_cfg

    # ── 持久化层：强制 SQLite 落到用户数据目录的绝对路径 ──────────────
    database = dict(cfg.get("database") or {})
    database["backend"] = "sqlite"
    database["sqlite_dir"] = str(qilin_data_dir)
    cfg["database"] = database

    # 运行事件进入数据库，与设计文档一致
    run_events = dict(cfg.get("run_events") or {})
    run_events["backend"] = "db"
    cfg["run_events"] = run_events

    # 技能根目录转绝对路径（模板里是相对 ``vendor/skills``）。
    # 引擎 SkillsConfig 只认 ``path`` 字段（``root`` 会被 Pydantic 静默忽略，
    # 导致技能目录回退到不存在的项目根 ``skills/``，技能系统整体失效）。
    skills = dict(cfg.get("skills") or {})
    skills_path = skills.get("path") or skills.pop("root", None) or "vendor/skills"
    cfg["skills"] = {**skills, "path": str((repo_root / skills_path).resolve())}

    runtime_config_path.parent.mkdir(parents=True, exist_ok=True)
    with runtime_config_path.open("w", encoding="utf-8") as fh:
        yaml.safe_dump(cfg, fh, allow_unicode=True, sort_keys=False)


def _write_default_extensions_config(path: Path) -> None:
    """写入空的 extensions_config.json（MCP server CRUD 的初始真源文件）。"""
    empty = {"middlewares": [], "mcpServers": {}, "skills": {}}
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        json.dump(empty, fh, ensure_ascii=False, indent=2)
        fh.write("\n")


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
    reports_dir = data_root / "reports"

    # 建立目录结构（见设计文档「目录结构」）
    for directory in (config_dir, qilin_data_dir, logs_dir, product_dir, reports_dir):
        directory.mkdir(parents=True, exist_ok=True)

    # 生成运行时配置（显式写入 database.sqlite_dir 绝对路径）
    runtime_config_path = config_dir / "qilin.runtime.yaml"
    _generate_runtime_config(runtime_config_path, qilin_data_dir, REPO_ROOT)

    # Lead Agent 运行守则（首次启动写入，已存在保留）
    _ensure_default_soul(runtime_qilin)

    # 确保 extensions_config.json 存在（MCP server / skills 管理用）
    extensions_config_path = config_dir / "extensions_config.json"
    if not extensions_config_path.exists():
        _write_default_extensions_config(extensions_config_path)

    # 注入运行时环境变量（设计文档「配置生成」）
    os.environ["KSTOCK_APP_DATA_DIR"] = str(data_root)
    os.environ["QILIN_CONFIG_PATH"] = str(runtime_config_path)
    os.environ["QILIN_EXTENSIONS_CONFIG_PATH"] = str(extensions_config_path)
    os.environ["QILIN_HOME"] = str(runtime_qilin)

    return {
        "data_root": data_root,
        "runtime_config": runtime_config_path,
        "extensions_config": extensions_config_path,
        "qilin_home": runtime_qilin,
        "qilin_data_dir": qilin_data_dir,
        "reports_dir": reports_dir,
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


def _load_secrets_env(data_root: Path) -> None:
    """加载 secrets.env 到 ``os.environ``（gateway 进程级别）。

    模型 API key 明文存在 ``secrets.env``，``runtime.yaml`` 只存 ``$ENV`` 引用。
    引擎热重载 ``runtime.yaml`` 时通过 ``os.environ`` 解析 ``$KEY`` 引用，
    故 gateway 启动时必须把已有 secrets 加载到进程环境；运行时新增的由
    ``kstock_models.upsert_secret`` 同步更新。
    """
    secrets_path = data_root / "config" / "secrets.env"
    if not secrets_path.exists():
        return
    pattern = re.compile(r'^([A-Za-z_][A-Za-z0-9_]*)="(.*)"$')
    loaded = 0
    for line in secrets_path.read_text(encoding="utf-8").splitlines():
        m = pattern.match(line.strip())
        if m:
            os.environ[m.group(1)] = m.group(2)
            loaded += 1
    if loaded:
        print(f"  secrets.env   : 已加载 {loaded} 个密钥", flush=True)


def _allow_public_landing_news() -> None:
    """Expose only the landing-news read endpoint before QiLin builds middleware."""
    from app.gateway import auth_middleware

    path = "/api/v1/kstock/landing-news"
    if path not in auth_middleware._PUBLIC_EXACT_PATHS:
        auth_middleware._PUBLIC_EXACT_PATHS = frozenset(
            {*auth_middleware._PUBLIC_EXACT_PATHS, path}
        )


def _allow_public_data_source_status() -> None:
    """Expose only the secret-free data-source status endpoint."""
    from app.gateway import auth_middleware

    path = "/api/v1/kstock/data-source-status"
    if path not in auth_middleware._PUBLIC_EXACT_PATHS:
        auth_middleware._PUBLIC_EXACT_PATHS = frozenset(
            {*auth_middleware._PUBLIC_EXACT_PATHS, path}
        )


# ── 沙箱数据凭据注入（修复沙箱 token 被 scrub 的注入缺口）───────────────
# 引擎 env_policy（issue #3861）会按 *TOKEN*/*KEY* 模式 scrub 沙箱子进程继承
# 的环境变量；授权通道是 config.context.secrets → SkillActivationMiddleware →
# bash 工具 per-call env。KStock 在服务端兜底供货：secrets.env 已由
# _load_secrets_env 加载进 os.environ，这里把白名单数据凭据注入每个 run 的
# config.context.secrets。客户端显式提供的同名值优先（覆盖兜底值）。
_SANDBOX_DATA_SECRET_KEYS: tuple[str, ...] = ("TUSHARE_TOKEN", "IWENCAI_API_KEY")


def _inject_data_secrets(config: dict[str, Any]) -> None:
    """把白名单数据凭据注入 RunnableConfig.context.secrets（沙箱授权通道）。"""
    available = {
        key: os.environ[key] for key in _SANDBOX_DATA_SECRET_KEYS if os.environ.get(key)
    }
    if not available:
        return
    context = config.setdefault("context", {})
    existing = context.get("secrets") if isinstance(context.get("secrets"), dict) else {}
    context["secrets"] = {**available, **existing}


def _install_secrets_injection() -> None:
    """Monkey-patch build_run_config：为每个 run 的 context.secrets 注入数据凭据。

    vendor 只读（同 _PUBLIC_EXACT_PATHS 先例）：不改引擎，只在 KStock 包装层
    把沙箱需要的数据凭据接上引擎既有注入通道。
    """
    from app.gateway import services as _gateway_services

    _original_build_run_config = _gateway_services.build_run_config

    def _build_run_config_with_secrets(*args, **kwargs):
        config = _original_build_run_config(*args, **kwargs)
        _inject_data_secrets(config)
        return config

    _gateway_services.build_run_config = _build_run_config_with_secrets


# ── Lead Agent 运行守则（SOUL.md）模板 ────────────────────────────────
# 引擎把 QILIN_HOME/SOUL.md 注入 lead agent system prompt（默认 agent）。
# KStock 用它承载产品级行为约束（如「分析任务必须渲染 HTML 看板交付」），
# 不修改 vendor 的 lead prompt 与上游同步的 SKILL.md。已存在的 SOUL.md 视为
# 用户内容，绝不覆盖。
_SOUL_TEMPLATE = REPO_ROOT / "config" / "lead_soul.md"


def _patch_aiosqlite_busy_timeout() -> None:
    """统一 aiosqlite 连接的 SQLite 写锁等待超时为 30 秒。

    引擎的 LangGraph checkpointer / store / runs 状态写入均通过 aiosqlite
    直连（``AsyncSqliteSaver.from_conn_string`` 等不接受 busy_timeout 参数），
    默认只有 5 秒。多子代理并发执行时，事件批量落库（SQLAlchemy 连接，30s）
    与 checkpoint 保存（aiosqlite 连接，5s）互相竞争写锁，等待超过 5 秒即抛
    ``OperationalError: database is locked`` 导致 run 以 error 结束
    （run_events 表可复现：2026-08-02 c2fb3160 委派 3 个并行子代理后失败，
    历史 656c57cf 同错）。这里包装 aiosqlite.connect：连接建立后立即执行
    ``PRAGMA busy_timeout`` 与 ``journal_mode=WAL``，覆盖引擎内部所有
    aiosqlite 连接（PRAGMA 为连接级设置）。
    """
    import aiosqlite

    if getattr(aiosqlite, "_kstock_busy_timeout_patched", False):
        return
    original_connect = aiosqlite.connect

    async def _connect_with_timeout(*args, **kwargs):
        conn = await original_connect(*args, **kwargs)
        try:
            cursor = await conn.execute("PRAGMA busy_timeout=30000")
            await cursor.fetchone()
            await cursor.close()
            cursor = await conn.execute("PRAGMA journal_mode=WAL")
            await cursor.fetchone()
            await cursor.close()
        except Exception:
            pass
        return conn

    aiosqlite.connect = _connect_with_timeout
    aiosqlite._kstock_busy_timeout_patched = True


def _ensure_default_soul(qilin_home: Path) -> None:
    """首次启动时写入 Lead Agent 运行守则（SOUL.md），已存在则保留用户内容。"""
    soul_path = qilin_home / "SOUL.md"
    if soul_path.exists() or not _SOUL_TEMPLATE.exists():
        return
    qilin_home.mkdir(parents=True, exist_ok=True)
    soul_path.write_text(_SOUL_TEMPLATE.read_text(encoding="utf-8"), encoding="utf-8")
    print(f"  SOUL.md        : 已写入 Lead Agent 运行守则 → {soul_path}", flush=True)


def create_app():
    """应用工厂：先打垫片、初始化用户数据空间、配 CORS，再构造 QiLin gateway。"""
    _patch_aiosqlite_busy_timeout()
    _apply_vendor_extensions_config_compat_shim()
    # ── 开发日志：先清空网关负责的两个文件（覆写模式，不残留上次运行）──
    from scripts.kstock_dev_logs import (
        LOGS_DIR as DEV_LOGS_DIR,
        clear_server_logs,
        ensure_logs_dir,
        install_gateway_log_handlers,
    )
    ensure_logs_dir()
    clear_server_logs()
    paths = _ensure_data_space()
    _load_secrets_env(paths["data_root"])
    _configure_gateway_security()
    _allow_public_landing_news()
    _allow_public_data_source_status()
    _install_secrets_injection()
    # 启动日志：明确告知用户数据落点，便于排查
    print("=" * 64, flush=True)
    print("KStock 用户数据空间", flush=True)
    print(f"  数据根目录     : {paths['data_root']}", flush=True)
    print(f"  运行时配置     : {paths['runtime_config']}", flush=True)
    print(f"  QILIN_HOME     : {paths['qilin_home']}", flush=True)
    print(f"  SQLite 数据库  : {paths['qilin_data_dir'] / 'qilin.db'}", flush=True)
    print(f"  CORS origins   : {os.environ['GATEWAY_CORS_ORIGINS']}", flush=True)
    print(f"  开发日志       : {DEV_LOGS_DIR} (gateway.log / langgraph.log)", flush=True)
    print("=" * 64, flush=True)
    from app.gateway.app import create_app as _create_app

    app = _create_app()

    # Reports deliberately live outside thread workspaces. The store is shared
    # by the runtime tool and report-library router and scopes every operation
    # by the authenticated user id.
    from scripts.kstock_reports import ReportLibraryStore

    app.state.kstock_report_store = ReportLibraryStore(
        paths["data_root"], paths["qilin_data_dir"] / "qilin.db"
    )

    # ── 追加文件日志 handler（vendor app 构造后、lifespan 前）──────────────
    # vendor 的 configure_logging（lifespan）只调整 handler 的 filter/formatter，
    # 不清除已有 handler，所以这里追加的 FileHandler 会安全保留。
    install_gateway_log_handlers()
    logging.getLogger("scripts.run_gateway").info(
        "KStock gateway 开发日志已启用 → %s", DEV_LOGS_DIR
    )

    # KStock 自有的路由层（vendor 引擎只读，以下路由提供 KStock CRUD / 控制）
    from scripts.kstock_gateway_control import router as kstock_gateway_control_router
    from scripts.kstock_models import router as kstock_models_router
    from scripts.kstock_data_sources import router as kstock_data_sources_router
    from scripts.kstock_runtime_config import router as kstock_runtime_config_router
    from scripts.kstock_extensions_config import router as kstock_extensions_config_router
    from scripts.kstock_general_settings import router as kstock_general_settings_router
    from scripts.kstock_reports_router import router as kstock_reports_router
    from scripts.kstock_news_router import router as kstock_news_router

    app.include_router(kstock_models_router)
    app.include_router(kstock_data_sources_router)
    app.include_router(kstock_runtime_config_router)
    app.include_router(kstock_extensions_config_router)
    app.include_router(kstock_general_settings_router)
    app.include_router(kstock_reports_router)
    app.include_router(kstock_news_router)
    app.include_router(kstock_gateway_control_router)
    return app


# uvicorn 通过模块路径加载时需要模块级 ``app``
app = create_app()


def _run_server() -> None:
    """启动 uvicorn server（由 supervisor 作为子进程启动）。

    绑定 localhost（而非 127.0.0.1）：与前端 Vite dev (localhost:1420) 同属
    localhost registrable domain，浏览器将 access_token cookie 视为 same-site，
    fetch 带 credentials:"include" 时可正常携带。直接传 app 对象：脚本入口
    运行时 cwd 不一定是项目根，字符串导入会找不到 scripts 包；传对象更稳健。
    """
    import uvicorn

    host = os.environ.get("GATEWAY_HOST", "localhost")
    port = int(os.environ.get("GATEWAY_PORT", "18001"))
    uvicorn.run(app, host=host, port=port)


def _run_supervisor() -> None:
    """supervisor 模式：启动并监控子进程，子进程以 RESTART_EXIT_CODE 退出时自动重启。

    桌面端设置页的「重启后端」按钮通过 ``/api/v1/kstock/restart`` 端点让子进程
    以 ``RESTART_EXIT_CODE`` 退出，supervisor 检测到后自动重启干净的子进程——
    无需重启整个桌面端即可让配置变更（数据库后端切换、secrets 更新等）完全生效。

    模块级 ``app = create_app()`` 仍会执行（幂等：建目录 / 清日志 / 加载 secrets
    均无副作用），但 supervisor 本身不调用 uvicorn，只管理子进程生命周期。
    """
    import subprocess
    import time as _time

    from scripts.kstock_gateway_control import RESTART_EXIT_CODE, SUPERVISOR_PID_ENV

    env = os.environ.copy()
    env[SUPERVISOR_PID_ENV] = str(os.getpid())
    cmd = [sys.executable, str(Path(__file__).resolve()), "--serve"]

    attempt = 0
    while True:
        print(f"[supervisor] 启动 gateway 子进程（第 {attempt + 1} 次）…", flush=True)
        proc = subprocess.Popen(cmd, env=env)
        code = proc.wait()
        if code == RESTART_EXIT_CODE:
            attempt += 1
            print(
                f"[supervisor] 子进程请求重启（exit {code}），1 秒后重新启动…",
                flush=True,
            )
            _time.sleep(1)
            continue
        print(f"[supervisor] 子进程退出（exit {code}），supervisor 结束。", flush=True)
        sys.exit(code)


if __name__ == "__main__":
    if "--serve" in sys.argv:
        # server 模式：真正的 uvicorn 进程，由 supervisor 启动。
        _run_server()
    else:
        # 默认 supervisor 模式：管理子进程生命周期，支持「重启后端」。
        _run_supervisor()
