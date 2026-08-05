"""KStock 开发日志基础设施。

在项目根 ``logs/`` 目录集中收集开发期四类日志（gateway / langgraph /
frontend / desktop）。覆写模式：每次进程启动清空自己的日志文件，
从本次运行开始记录，不追加到历史残留。

职责分工
--------
- ``gateway.log`` / ``langgraph.log`` —— 由本模块的 ``FileHandler`` 写入。
  在 ``scripts/run_gateway.py::create_app()`` 里注入：root logger 写
  gateway.log（全集），``langgraph`` named logger 额外写 langgraph.log
  （编排排查便利子集），``propagate`` 保持 True 让 gateway.log 仍含完整链路。
- ``frontend.log`` / ``desktop.log`` —— 由 Node wrapper
  ``scripts/run_with_log.mjs`` 的 stdout/stderr tee 写入（浏览器和 Electron
  主进程无法直接写本地文件）。
"""
from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def default_logs_dir() -> Path:
    """返回 KStock 日志目录。

    源码开发态继续使用仓库 ``logs/``，方便本地调试；PyInstaller 打包态
    ``__file__`` 位于 ``.app/Contents/Resources/gateway/_internal``，该目录
    属于已签名、只读的应用包资源，不能写日志。打包态必须写入用户数据空间。
    """
    if getattr(sys, "frozen", False):
        data_root = Path(os.environ.get("KSTOCK_APP_DATA_DIR") or (Path.home() / ".kstock"))
        return data_root / "logs"
    return REPO_ROOT / "logs"


LOGS_DIR = default_logs_dir()

# 四类日志的规范文件名。frontend/desktop 由 Node wrapper 清空写入，
# gateway/langgraph 由本模块的 FileHandler 清空写入。
LOG_FILES: dict[str, str] = {
    "gateway": "gateway.log",
    "langgraph": "langgraph.log",
    "frontend": "frontend.log",
    "desktop": "desktop.log",
}

DEV_LOG_FORMAT = "%(asctime)s %(levelname)-8s %(name)s: %(message)s"


def ensure_logs_dir() -> Path:
    """确保 ``logs/`` 目录存在（幂等）。返回 LOGS_DIR 路径。"""
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    return LOGS_DIR


def clear_dev_log(name: str) -> Path:
    """清空指定名称的日志文件（truncate mode ``w``）。返回文件路径。

    文件不存在时创建空文件；存在时清空内容，保证本次运行从头写入。
    """
    if name not in LOG_FILES:
        raise ValueError(f"未知日志名称: {name}")
    ensure_logs_dir()
    path = LOGS_DIR / LOG_FILES[name]
    # open mode='w' 即 truncate（不存在则创建空文件）
    path.open("w", encoding="utf-8").close()
    return path


def clear_server_logs() -> None:
    """清空网关进程负责的两个日志文件（gateway + langgraph）。

    在 gateway 启动入口调用，保证本次运行不残留上次日志。
    """
    clear_dev_log("gateway")
    clear_dev_log("langgraph")


def make_file_handler(name: str, level: int = logging.DEBUG) -> logging.FileHandler:
    """构造一个 FileHandler，写入 ``logs/<name>.log``，UTF-8，追加模式。

    清空由 ``clear_dev_log()`` 在进程启动时一次性完成；handler 只负责
    本次运行的追加写入（mode='a'，配合启动时 truncate 实现覆写语义）。
    """
    ensure_logs_dir()
    path = LOGS_DIR / LOG_FILES[name]
    handler = logging.FileHandler(path, mode="a", encoding="utf-8")
    handler.setLevel(level)
    handler.setFormatter(logging.Formatter(DEV_LOG_FORMAT))
    return handler


def install_gateway_log_handlers() -> None:
    """给 root logger 和 langgraph logger 追加 FileHandler。

    在 ``run_gateway.create_app()`` 里、vendor app 构造之后调用。
    vendor 的 ``configure_logging()``（lifespan 调用）只调整已有 handler 的
    filter/formatter、不清除 handler，所以追加安全。

    - root logger → ``gateway.log``（全集，含引擎 HTTP + langgraph 编排）
    - ``langgraph`` named logger → ``langgraph.log``（编排子集视图）
    - ``propagate`` 保持 True（默认），langgraph 日志同时进两个文件

    root logger level 默认 WARNING，会把 DEBUG/INFO 消息拦在 handler 之前；
    开发日志需要完整链路，这里显式拉到 DEBUG（vendor lifespan 的
    ``apply_logging_level`` 随后会根据 config.log_level 进一步调整）。
    """
    root = logging.getLogger()
    if root.level == logging.NOTSET or root.level > logging.DEBUG:
        root.setLevel(logging.DEBUG)
    root.addHandler(make_file_handler("gateway"))

    langgraph_logger = logging.getLogger("langgraph")
    langgraph_logger.addHandler(make_file_handler("langgraph"))
