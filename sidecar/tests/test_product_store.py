from __future__ import annotations

from pathlib import Path

from kstock_sidecar.product_store import ProductStore


def test_product_store_creates_project_and_thread_link(tmp_path: Path):
    store = ProductStore(tmp_path / "kstock.db")
    store.ensure_schema()

    project = store.create_project("新能源行业跟踪")
    store.link_thread(project["id"], "thread_001", title="宁德时代财报分析")

    projects = store.list_projects()
    threads = store.list_project_threads(project["id"])

    assert projects[0]["name"] == "新能源行业跟踪"
    assert threads[0]["thread_id"] == "thread_001"
    assert threads[0]["title"] == "宁德时代财报分析"


def test_product_store_upserts_report_asset(tmp_path: Path):
    store = ProductStore(tmp_path / "kstock.db")
    store.ensure_schema()

    report = store.upsert_report_asset(
        thread_id="thread_001",
        filename="report.md",
        virtual_path="/mnt/user-data/outputs/report.md",
        host_path=str(tmp_path / "report.md"),
        mime_type="text/markdown",
        title="研究报告",
    )

    reports = store.list_report_assets("thread_001")

    assert report["filename"] == "report.md"
    assert reports[0]["virtual_path"] == "/mnt/user-data/outputs/report.md"
