"""KStock 开发日志基础设施单元测试。

用 tmp_path + monkeypatch 隔离 LOGS_DIR，不触碰项目根真实 logs/ 目录。
对 install_gateway_log_handlers 这类修改全局 root logger 的测试，用
autoend fixture 在测试后移除追加的 handler，避免污染其他测试。
"""
import logging

import pytest

from scripts.kstock_dev_logs import (
    LOG_FILES,
    clear_dev_log,
    ensure_logs_dir,
    install_gateway_log_handlers,
    make_file_handler,
)


# ── 全局 logger 清理 fixture ─────────────────────────────────────────
# install_gateway_log_handlers 会给 root 和 langgraph logger 追加 FileHandler。
# 记录测试前的 handler 列表，测试后恢复，避免污染同进程的其他测试。


@pytest.fixture
def isolated_root_handlers():
    """记录并恢复 root + langgraph logger 的 handlers 与 level。"""
    root = logging.getLogger()
    langgraph_logger = logging.getLogger("langgraph")
    root_before = list(root.handlers)
    lg_before = list(langgraph_logger.handlers)
    root_level_before = root.level
    yield
    root.handlers = root_before
    langgraph_logger.handlers = lg_before
    root.setLevel(root_level_before)


# ── ensure_logs_dir ─────────────────────────────────────────────────


def test_ensure_logs_dir_creates_directory(tmp_path, monkeypatch):
    """目录不存在时创建，已存在时幂等。"""
    monkeypatch.setattr("scripts.kstock_dev_logs.LOGS_DIR", tmp_path / "logs")
    result = ensure_logs_dir()
    assert result.exists()
    assert result.is_dir()


def test_ensure_logs_dir_idempotent(tmp_path, monkeypatch):
    """目录已存在时不报错。"""
    target = tmp_path / "logs"
    target.mkdir()
    monkeypatch.setattr("scripts.kstock_dev_logs.LOGS_DIR", target)
    result = ensure_logs_dir()
    assert result == target


# ── clear_dev_log ───────────────────────────────────────────────────


def test_clear_dev_log_truncates_existing_content(tmp_path, monkeypatch):
    """已有内容的日志文件被清空（覆写语义）。"""
    monkeypatch.setattr("scripts.kstock_dev_logs.LOGS_DIR", tmp_path)
    log_file = tmp_path / LOG_FILES["gateway"]
    log_file.write_text("旧日志内容\n" * 100, encoding="utf-8")

    clear_dev_log("gateway")

    assert log_file.read_text(encoding="utf-8") == ""


def test_clear_dev_log_creates_empty_file(tmp_path, monkeypatch):
    """文件不存在时创建空文件。"""
    monkeypatch.setattr("scripts.kstock_dev_logs.LOGS_DIR", tmp_path)

    path = clear_dev_log("langgraph")

    assert path.exists()
    assert path.read_text(encoding="utf-8") == ""


def test_clear_dev_log_rejects_unknown_name(tmp_path, monkeypatch):
    """未知日志名称抛 ValueError。"""
    monkeypatch.setattr("scripts.kstock_dev_logs.LOGS_DIR", tmp_path)
    with pytest.raises(ValueError):
        clear_dev_log("nonexistent")


def test_clear_server_logs_clears_both(tmp_path, monkeypatch):
    """clear_server_logs 同时清空 gateway 和 langgraph 两个文件。"""
    from scripts.kstock_dev_logs import clear_server_logs

    monkeypatch.setattr("scripts.kstock_dev_logs.LOGS_DIR", tmp_path)
    gw = tmp_path / LOG_FILES["gateway"]
    lg = tmp_path / LOG_FILES["langgraph"]
    gw.write_text("旧 gateway", encoding="utf-8")
    lg.write_text("旧 langgraph", encoding="utf-8")

    clear_server_logs()

    assert gw.read_text(encoding="utf-8") == ""
    assert lg.read_text(encoding="utf-8") == ""


# ── make_file_handler ───────────────────────────────────────────────


def test_make_file_handler_writes_formatted_record(tmp_path, monkeypatch):
    """FileHandler 按格式写入日志，文件可读。"""
    monkeypatch.setattr("scripts.kstock_dev_logs.LOGS_DIR", tmp_path)
    handler = make_file_handler("gateway")
    logger = logging.getLogger("test_handler_tmp")
    logger.handlers.clear()
    logger.addHandler(handler)
    logger.setLevel(logging.DEBUG)
    logger.propagate = False

    logger.info("测试消息")

    handler.flush()
    content = (tmp_path / LOG_FILES["gateway"]).read_text(encoding="utf-8")
    assert "测试消息" in content
    assert "INFO" in content
    assert "test_handler_tmp" in content


# ── install_gateway_log_handlers ────────────────────────────────────


def test_install_gateway_log_handlers_attaches_to_root_and_langgraph(
    tmp_path, monkeypatch, isolated_root_handlers
):
    """install 后 root 和 langgraph logger 各有一个 FileHandler 指向对应文件。"""
    monkeypatch.setattr("scripts.kstock_dev_logs.LOGS_DIR", tmp_path)
    root = logging.getLogger()
    langgraph_logger = logging.getLogger("langgraph")
    root_handlers_before = len(root.handlers)
    lg_handlers_before = len(langgraph_logger.handlers)

    install_gateway_log_handlers()

    assert len(root.handlers) == root_handlers_before + 1
    assert len(langgraph_logger.handlers) == lg_handlers_before + 1
    # langgraph propagate 保持 True（gateway.log 收完整日志）
    assert langgraph_logger.propagate is True


def test_langgraph_log_separate_from_gateway(
    tmp_path, monkeypatch, isolated_root_handlers
):
    """langgraph 日志进 langgraph.log，引擎 HTTP 日志只进 gateway.log。

    gateway.log 是全集（含 langgraph，因为 propagate=True）；
    langgraph.log 是编排子集视图。
    """
    monkeypatch.setattr("scripts.kstock_dev_logs.LOGS_DIR", tmp_path)
    install_gateway_log_handlers()

    logging.getLogger("langgraph.graph").info("langgraph 编排事件")
    logging.getLogger("app.gateway.routers.threads").info("HTTP 请求")

    # 强制 flush 所有 handler
    for h in logging.getLogger().handlers:
        h.flush()
    for h in logging.getLogger("langgraph").handlers:
        h.flush()

    gateway_text = (tmp_path / LOG_FILES["gateway"]).read_text(encoding="utf-8")
    langgraph_text = (tmp_path / LOG_FILES["langgraph"]).read_text(encoding="utf-8")

    # langgraph.log 只含 langgraph 编排日志
    assert "langgraph 编排事件" in langgraph_text
    assert "HTTP 请求" not in langgraph_text
    # gateway.log 是全集：含 HTTP 请求 + langgraph（propagate）
    assert "HTTP 请求" in gateway_text
    assert "langgraph 编排事件" in gateway_text
