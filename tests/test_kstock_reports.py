from pathlib import Path

import pytest

from scripts.kstock_reports import ReportLibraryStore


def _write(path: Path, text: str) -> Path:
    path.write_text(text, encoding="utf-8")
    return path


def _thread_outputs(root: Path, thread_id: str) -> Path:
    outputs = root / thread_id / "user-data" / "outputs"
    outputs.mkdir(parents=True, exist_ok=True)
    return outputs


def _renderer_html(title: str) -> str:
    return f"<!doctype html><html><head><meta charset=\"utf-8\"><title>{title}</title></head><body>ok</body></html>"


def _meta(user_id: str, generated_at: str, **extra):
    return {
        "user_id": user_id,
        "title": "研究看板",
        "symbol": "600000",
        "report_type": "stock-research",
        "generated_at": generated_at,
        "period_start": "2026-01-01",
        "period_end": "2026-07-31",
        "risk_level": "中",
        "coverage_status": "complete",
        **extra,
    }


def test_archive_creates_user_scoped_dated_file_and_index(tmp_path: Path):
    store = ReportLibraryStore(tmp_path)
    source = _write(tmp_path / "thread.html", "<html>one</html>")
    row = store.archive(source, "report-1", "thread-1", _meta("alice", "2026-08-01T10:00:00+08:00"))
    assert (tmp_path / "reports/alice/2026/08/01/report-1.html").read_text() == "<html>one</html>"
    assert store.get_report("report-1", user_id="alice")["relative_path"] == row["relative_path"]
    assert store.list_reports(user_id="bob") == []


def test_cross_date_update_keeps_only_latest_report(tmp_path: Path):
    store = ReportLibraryStore(tmp_path)
    first = _write(tmp_path / "first.html", "first")
    second = _write(tmp_path / "second.html", "second")
    store.archive(first, "same", "thread", _meta("alice", "2026-08-01T10:00:00+08:00"))
    store.archive(second, "same", "thread", _meta("alice", "2026-08-02T10:00:00+08:00"))
    assert not (tmp_path / "reports/alice/2026/08/01/same.html").exists()
    assert (tmp_path / "reports/alice/2026/08/02/same.html").read_text() == "second"
    assert len(store.list_reports(user_id="alice")) == 1


def test_filters_and_delete_are_user_scoped(tmp_path: Path):
    store = ReportLibraryStore(tmp_path)
    source = _write(tmp_path / "r.html", "report")
    store.archive(source, "a", "t", _meta("alice", "2026-08-01T10:00:00+08:00", title="Alpha"))
    store.archive(source, "b", "t", _meta("alice", "2026-08-02T10:00:00+08:00", symbol="000001", title="Beta"))
    assert [r["report_id"] for r in store.list_reports(user_id="alice", date="2026-08-02")] == ["b"]
    assert [r["report_id"] for r in store.list_reports(user_id="alice", query="Alpha")] == ["a"]
    store.delete("a", user_id="alice")
    assert store.get_report("a", user_id="alice") is None
    assert store.get_report("b", user_id="alice") is not None


def test_scan_archives_dark_light_pair_once_and_is_idempotent(tmp_path: Path):
    store = ReportLibraryStore(tmp_path)
    outputs = _thread_outputs(tmp_path / "threads", "thread-a")
    _write(outputs / "2026-08-02_weekly-futures-analysis-dark.html", _renderer_html("周度分析"))
    _write(outputs / "2026-08-02_weekly-futures-analysis-light.html", _renderer_html("周度分析"))

    first = store.scan_threads_and_archive(tmp_path / "threads", "alice")
    assert len(first) == 1
    row = first[0]
    assert row["title"] == "周度分析"
    assert row["report_type"] == "weekly-futures-analysis"
    assert row["thread_id"] == "thread-a"
    assert row["generated_at"].startswith("2026-08-02")
    assert (tmp_path / "reports/alice").exists()

    # 幂等：再次扫描不新增
    assert store.scan_threads_and_archive(tmp_path / "threads", "alice") == []
    assert len(store.list_reports(user_id="alice")) == 1

    # 工具已归档过的同一文件（sha256 相同）不重复归档（bob 的线程目录独立）
    store2_source = _write(tmp_path / "dup.html", "<html>dup</html>")
    store.archive(store2_source, "tool-1", "thread-b", _meta("bob", "2026-08-01T10:00:00+08:00"))
    outputs_b = _thread_outputs(tmp_path / "threads-bob", "thread-b")
    _write(outputs_b / "dup.html", "<html>dup</html>")
    assert store.scan_threads_and_archive(tmp_path / "threads-bob", "bob") == []
    assert len(store.list_reports(user_id="bob")) == 1


def test_scan_covers_all_threads_and_updates_stable_report_id(tmp_path: Path):
    store = ReportLibraryStore(tmp_path)
    outputs_a = _thread_outputs(tmp_path / "threads", "thread-a")
    outputs_b = _thread_outputs(tmp_path / "threads", "thread-b")
    _write(outputs_a / "2026-08-02_weekly-futures-analysis-dark.html", _renderer_html("周度 v1"))
    _write(outputs_b / "daily-market.html", _renderer_html("日度"))

    rows = store.scan_threads_and_archive(tmp_path / "threads", "alice")
    assert {r["thread_id"] for r in rows} == {"thread-a", "thread-b"}

    # 同主题重跑（同 stem 内容更新）→ 稳定 report_id 覆盖更新，不新增条目
    _write(outputs_a / "2026-08-02_weekly-futures-analysis-dark.html", _renderer_html("周度 v2"))
    updated = store.scan_threads_and_archive(tmp_path / "threads", "alice")
    assert len(updated) == 1
    assert updated[0]["title"] == "周度 v2"
    assert len(store.list_reports(user_id="alice")) == 2


def test_archive_failure_preserves_existing_report(tmp_path: Path):
    store = ReportLibraryStore(tmp_path)
    old = _write(tmp_path / "old.html", "old")
    store.archive(old, "stable", "thread", _meta("alice", "2026-08-01T10:00:00+08:00"))
    with pytest.raises(ValueError):
        store.archive(tmp_path / "missing.html", "stable", "thread", _meta("alice", "2026-08-02T10:00:00+08:00"))
    assert (tmp_path / "reports/alice/2026/08/01/stable.html").read_text() == "old"
    assert store.get_report("stable", user_id="alice")["generated_at"].startswith("2026-08-01")


def test_delete_then_scan_does_not_resurrect_report(tmp_path: Path):
    """回归：删除后源文件仍在线程 outputs，再次扫描/列表不得让报告复活。"""
    store = ReportLibraryStore(tmp_path)
    outputs = _thread_outputs(tmp_path / "threads", "thread-a")
    _write(outputs / "2026-08-02_weekly-futures-analysis-dark.html", _renderer_html("周度分析"))
    rows = store.scan_threads_and_archive(tmp_path / "threads", "alice")
    assert len(rows) == 1
    report_id = rows[0]["report_id"]

    store.delete(report_id, user_id="alice")
    assert store.get_report(report_id, user_id="alice") is None
    # 源 HTML 保留在线程 outputs（历史任务交付物不受影响）
    assert list(outputs.glob("*.html"))
    # 回归：删除后再次扫描与列表均不重新归档
    assert store.scan_threads_and_archive(tmp_path / "threads", "alice") == []
    assert store.list_reports(user_id="alice") == []


def test_deleted_report_with_new_content_reenters_library(tmp_path: Path):
    """同主题重跑且内容更新（新 sha256）时，已删除报告可重新进库。"""
    store = ReportLibraryStore(tmp_path)
    outputs = _thread_outputs(tmp_path / "threads", "thread-a")
    _write(outputs / "2026-08-02_weekly-futures-analysis-dark.html", _renderer_html("周度 v1"))
    rows = store.scan_threads_and_archive(tmp_path / "threads", "alice")
    store.delete(rows[0]["report_id"], user_id="alice")

    _write(outputs / "2026-08-02_weekly-futures-analysis-dark.html", _renderer_html("周度 v2"))
    updated = store.scan_threads_and_archive(tmp_path / "threads", "alice")
    assert len(updated) == 1
    assert updated[0]["title"] == "周度 v2"


def test_delete_marker_is_user_scoped(tmp_path: Path):
    """删除标记按用户隔离：alice 删除不影响 bob 同内容报告的扫描归档。"""
    store = ReportLibraryStore(tmp_path)
    source = _write(tmp_path / "same.html", "<html>dup</html>")
    store.archive(source, "tool-1", "thread-b", _meta("bob", "2026-08-01T10:00:00+08:00"))
    store.delete("tool-1", user_id="bob")
    outputs = _thread_outputs(tmp_path / "threads", "thread-a")
    _write(outputs / "daily.html", "<html>dup</html>")
    # alice 无删除标记，同内容文件仍可归档
    rows = store.scan_threads_and_archive(tmp_path / "threads", "alice")
    assert len(rows) == 1
    assert len(store.list_reports(user_id="alice")) == 1


