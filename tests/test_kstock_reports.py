from pathlib import Path

import pytest

from scripts.kstock_reports import ReportLibraryStore


def _write(path: Path, text: str) -> Path:
    path.write_text(text, encoding="utf-8")
    return path


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


def test_archive_failure_preserves_existing_report(tmp_path: Path):
    store = ReportLibraryStore(tmp_path)
    old = _write(tmp_path / "old.html", "old")
    store.archive(old, "stable", "thread", _meta("alice", "2026-08-01T10:00:00+08:00"))
    with pytest.raises(ValueError):
        store.archive(tmp_path / "missing.html", "stable", "thread", _meta("alice", "2026-08-02T10:00:00+08:00"))
    assert (tmp_path / "reports/alice/2026/08/01/stable.html").read_text() == "old"
    assert store.get_report("stable", user_id="alice")["generated_at"].startswith("2026-08-01")

