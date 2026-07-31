from pathlib import Path

from kstock_sidecar.config import SidecarConfig
from kstock_sidecar.product_store import ProductStore
from kstock_sidecar.protocol import Request
from kstock_sidecar.qilin_adapter import QiLinAdapter
from kstock_sidecar.server import dispatch_request


def test_workspace_init_returns_data_space(tmp_path: Path):
    adapter = QiLinAdapter(client_factory=lambda: object(), config=SidecarConfig(app_data_dir=tmp_path))

    response = dispatch_request(Request(id="1", method="workspace.init", params={}), adapter=adapter)

    assert response.ok is True
    assert response.result["activeUserId"].startswith("local-")
    assert response.result["qilinHome"].endswith("runtime/qilin")


def test_workspace_info_returns_same_user(tmp_path: Path):
    adapter = QiLinAdapter(client_factory=lambda: object(), config=SidecarConfig(app_data_dir=tmp_path))

    first = dispatch_request(Request(id="1", method="workspace.init", params={}), adapter=adapter)
    second = dispatch_request(Request(id="2", method="workspace.info", params={}), adapter=adapter)

    assert second.ok is True
    assert second.result["activeUserId"] == first.result["activeUserId"]


def test_thread_create_makes_qilin_thread_dirs(tmp_path: Path):
    adapter = QiLinAdapter(client_factory=lambda: object(), config=SidecarConfig(app_data_dir=tmp_path))

    response = dispatch_request(
        Request(id="1", method="thread.create", params={"title": "财报分析"}),
        adapter=adapter,
    )

    assert response.ok is True
    user_id = response.result["userId"]
    thread_id = response.result["threadId"]
    assert response.result["title"] == "财报分析"
    assert (tmp_path / "runtime/qilin/users" / user_id / "threads" / thread_id / "user-data/workspace").is_dir()
    assert (tmp_path / "runtime/qilin/users" / user_id / "threads" / thread_id / "user-data/uploads").is_dir()
    assert (tmp_path / "runtime/qilin/users" / user_id / "threads" / thread_id / "user-data/outputs").is_dir()


def test_artifact_list_indexes_outputs(tmp_path: Path):
    adapter = QiLinAdapter(client_factory=lambda: object(), config=SidecarConfig(app_data_dir=tmp_path))
    created = dispatch_request(Request(id="1", method="thread.create", params={}), adapter=adapter)
    thread_id = created.result["threadId"]
    user_id = created.result["userId"]
    output_dir = tmp_path / "runtime/qilin/users" / user_id / "threads" / thread_id / "user-data/outputs"
    (output_dir / "report.md").write_text("# 报告", encoding="utf-8")

    response = dispatch_request(Request(id="2", method="artifact.list", params={"threadId": thread_id}), adapter=adapter)

    assert response.ok is True
    assert response.result["count"] == 1
    assert response.result["artifacts"][0]["filename"] == "report.md"
    assert response.result["artifacts"][0]["virtualPath"] == "/mnt/user-data/outputs/report.md"

    store = ProductStore(tmp_path / "product/kstock.db")
    reports = store.list_report_assets(thread_id)
    assert reports[0]["filename"] == "report.md"
