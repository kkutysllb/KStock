"""thread 归档（qilin_archived）语义测试。

覆盖三件事：
1. THREAD_ARCHIVED_METADATA_KEY 常量已从 thread_meta 包导出（API 稳定性）。
2. ``_is_pin_metadata_patch`` 把 archive 单键 PATCH 识别为「不应 bump updated_at」，
   与 pin 行为一致；其它形状（空、多键、非 bool）仍走 touch=True。
3. ``_is_thread_archived`` 对 None / 非 dict / True / False / 其它类型的容错。
4. MemoryThreadMetaStore.update_metadata 在 archive PATCH（touch=False）时保留
   原有 updated_at，在普通 PATCH（touch=True）时刷新 updated_at。

注：search 端的 ``include_archived`` 过滤逻辑是 router 层 Python 过滤，
其行为通过 ``_is_thread_archived`` 的纯函数测试间接覆盖——内存 store 的
search 不过滤归档（过滤在 router），这是设计约定。
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any

import pytest

from qilin.persistence.thread_meta import (
    THREAD_ARCHIVED_METADATA_KEY,
    THREAD_PINNED_METADATA_KEY,
    MemoryThreadMetaStore,
    make_thread_store,
)


# ── 常量稳定性 ────────────────────────────────────────────────────────


def test_archive_metadata_key_constant_matches_api_contract():
    """归档 key 必须稳定为 'qilin_archived'，前端 turnsClient.ts 硬编码这个字符串。"""
    assert THREAD_ARCHIVED_METADATA_KEY == "qilin_archived"
    # pin key 仍保持原值（回归保护）
    assert THREAD_PINNED_METADATA_KEY == "qilin_pinned"


# ── _is_pin_metadata_patch（识别 pin / archive 不 bump updated_at）────


def _import_is_pin_patch():
    """从 router 模块导入。延迟到用例执行时，避免 import 时副作用（router 依赖 app.gateway）。"""
    from app.gateway.routers.threads import _is_pin_metadata_patch
    return _is_pin_metadata_patch


@pytest.mark.parametrize(
    "metadata,expected",
    [
        # pin 单键 bool —— touch=False（既有行为）
        ({THREAD_PINNED_METADATA_KEY: True}, True),
        ({THREAD_PINNED_METADATA_KEY: False}, True),
        # archive 单键 bool —— touch=False（本次新增）
        ({THREAD_ARCHIVED_METADATA_KEY: True}, True),
        ({THREAD_ARCHIVED_METADATA_KEY: False}, True),
        # 多键混合 —— 即使包含 pin/archive 也要 touch（避免误用做 rename 掩护）
        ({THREAD_ARCHIVED_METADATA_KEY: True, "other": 1}, False),
        # 非 bool 值 —— touch=True（非标准形状）
        ({THREAD_ARCHIVED_METADATA_KEY: "true"}, False),
        ({THREAD_ARCHIVED_METADATA_KEY: 1}, False),
        ({THREAD_PINNED_METADATA_KEY: "yes"}, False),
        # 空或非 bookkeeping key —— touch=True
        ({}, False),
        ({"display_name": "xxx"}, False),
        # 非 pin/archive 的单键 —— touch=True
        ({"custom_tag": True}, False),
    ],
)
def test_is_pin_metadata_patch_classifies_archive_and_pin(metadata: dict, expected: bool):
    assert _import_is_pin_patch()(metadata) is expected


# ── _is_thread_archived（router 层归档过滤助手）────────────────────────


def _import_is_thread_archived():
    from app.gateway.routers.threads import _is_thread_archived
    return _is_thread_archived


@pytest.mark.parametrize(
    "metadata,expected",
    [
        (None, False),
        ("not a dict", False),
        ([1, 2, 3], False),
        ({}, False),
        ({THREAD_ARCHIVED_METADATA_KEY: True}, True),
        ({THREAD_ARCHIVED_METADATA_KEY: False}, False),
        ({THREAD_ARCHIVED_METADATA_KEY: "true"}, False),  # 字符串不算
        ({THREAD_ARCHIVED_METADATA_KEY: None}, False),
        ({THREAD_PINNED_METADATA_KEY: True}, False),  # pin 不等于 archived
        ({THREAD_ARCHIVED_METADATA_KEY: True, "other": 1}, True),  # 其它 key 不影响
    ],
)
def test_is_thread_archived_handles_payload_variants(metadata: Any, expected: bool):
    assert _import_is_thread_archived()(metadata) is expected


# ── update_metadata touch 语义（MemoryThreadMetaStore）───────────────


def _make_memory_store() -> MemoryThreadMetaStore:
    """构造一个内存 thread store，不依赖 SQL 后端。"""
    from langgraph.store.memory import InMemoryStore
    return make_thread_store(session_factory=None, store=InMemoryStore())


def _run(coro):
    """同步执行异步 coroutine（pytest 同步用例友好）。

    ``asyncio.new_event_loop`` 比 ``get_event_loop`` 更可靠：后者在 3.12+
    无运行 loop 时已 DeprecationWarning，且会复用全局 loop 导致跨用例污染。
    """
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def test_update_metadata_with_archive_patch_does_not_bump_updated_at():
    """archive/unarchive PATCH 必须保留 updated_at（touch=False 路径）。"""
    store = _make_memory_store()
    user_id = "user-archive-1"

    created = _run(store.create("t1", user_id=user_id, display_name="before"))
    original_updated = created["updated_at"]

    # 模拟 router 行为：识别 archive 单键 patch → touch=False
    from app.gateway.routers.threads import _is_pin_metadata_patch
    archive_patch = {THREAD_ARCHIVED_METADATA_KEY: True}
    touch = not _is_pin_metadata_patch(archive_patch)
    assert touch is False, "archive patch 必须被识别为 touch=False"

    _run(store.update_metadata("t1", archive_patch, touch=touch, user_id=user_id))

    after = _run(store.get("t1", user_id=user_id))
    assert after is not None
    assert after["metadata"][THREAD_ARCHIVED_METADATA_KEY] is True
    assert after["updated_at"] == original_updated, "archive 不应 bump updated_at"


def test_update_metadata_with_unarchive_patch_does_not_bump_updated_at():
    """取消归档同样不应 bump updated_at。"""
    store = _make_memory_store()
    user_id = "user-archive-2"

    created = _run(store.create("t2", user_id=user_id, display_name="before"))
    original_updated = created["updated_at"]
    # 先标记为归档（touch=False）
    _run(store.update_metadata(
        "t2", {THREAD_ARCHIVED_METADATA_KEY: True}, touch=False, user_id=user_id
    ))

    # 取消归档
    unarchive_patch = {THREAD_ARCHIVED_METADATA_KEY: False}
    from app.gateway.routers.threads import _is_pin_metadata_patch
    touch = not _is_pin_metadata_patch(unarchive_patch)
    assert touch is False

    _run(store.update_metadata("t2", unarchive_patch, touch=touch, user_id=user_id))

    after = _run(store.get("t2", user_id=user_id))
    assert after is not None
    assert after["metadata"][THREAD_ARCHIVED_METADATA_KEY] is False
    assert after["updated_at"] == original_updated, "unarchive 不应 bump updated_at"


def test_update_metadata_with_other_patch_bumps_updated_at():
    """非 archive/pin 的 metadata patch 走默认 touch=True，应刷新 updated_at。"""
    store = _make_memory_store()
    user_id = "user-archive-3"

    created = _run(store.create("t3", user_id=user_id, display_name="before"))
    original_updated = created["updated_at"]

    # 等一点时间，避免精度问题导致新旧 updated_at 相等无法判定
    import time
    time.sleep(0.01)

    from app.gateway.routers.threads import _is_pin_metadata_patch
    other_patch = {"custom_tag": "highlight"}
    touch = not _is_pin_metadata_patch(other_patch)
    assert touch is True, "普通 metadata patch 必须走 touch=True"

    _run(store.update_metadata("t3", other_patch, touch=touch, user_id=user_id))

    after = _run(store.get("t3", user_id=user_id))
    assert after is not None
    assert after["metadata"]["custom_tag"] == "highlight"
    assert after["updated_at"] != original_updated, "普通 patch 应刷新 updated_at"


def test_search_returns_archived_threads_unfiltered_at_store_level():
    """store 层 search 不过滤归档（过滤在 router 层做），归档 thread 仍出现。

    这条约定让 SQL/memory 两套 store 行为统一——router 在拿到 store 结果后
    Python 端再过滤，避免每套 store 各自实现 key != value 的 JSON 谓词。
    """
    store = _make_memory_store()
    user_id = "user-archive-4"

    _run(store.create("t-active", user_id=user_id, display_name="active"))
    _run(store.create("t-archived", user_id=user_id, display_name="archived"))
    _run(store.update_metadata(
        "t-archived", {THREAD_ARCHIVED_METADATA_KEY: True}, touch=False, user_id=user_id
    ))

    rows = _run(store.search(user_id=user_id, limit=100))

    thread_ids = {r["thread_id"] for r in rows}
    assert "t-active" in thread_ids
    assert "t-archived" in thread_ids, (
        "store 层 search 不过滤归档；router 层的 include_archived=False 才会过滤掉"
    )

    # 归档标记确实写入了 metadata
    archived_row = next(r for r in rows if r["thread_id"] == "t-archived")
    assert archived_row["metadata"][THREAD_ARCHIVED_METADATA_KEY] is True
