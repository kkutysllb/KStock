from pathlib import Path

from kstock_sidecar.config import SidecarConfig
from kstock_sidecar.qilin_adapter import QiLinAdapter


def test_health_reports_unavailable_when_engine_missing(tmp_path: Path):
    adapter = QiLinAdapter(client_factory=lambda: None, config=SidecarConfig(app_data_dir=tmp_path))
    result = adapter.health()
    assert result["status"] == "unavailable"
    assert result["engine"] == "qilin"


def test_health_reports_vendored_qilin_source_path(tmp_path: Path):
    adapter = QiLinAdapter(client_factory=lambda: object(), config=SidecarConfig(app_data_dir=tmp_path))
    result = adapter.health()
    assert result["status"] == "ok"
    assert result["engine"] == "qilin"
    assert result["source"].endswith("vendor/qilin")
    assert result["config"].endswith("config/qilin.runtime.yaml")


def test_health_preserves_status_when_qilin_client_raises(tmp_path: Path):
    adapter = QiLinAdapter(
        client_factory=lambda: (_ for _ in ()).throw(RuntimeError("缺少配置")),
        config=SidecarConfig(app_data_dir=tmp_path),
    )
    result = adapter.health()
    assert result["status"] == "unavailable"
    assert result["engine"] == "qilin"
    assert result["detail"] == "缺少配置"


def test_health_uses_runtime_data_space(tmp_path: Path):
    config = SidecarConfig(app_data_dir=tmp_path)
    adapter = QiLinAdapter(client_factory=lambda: object(), config=config)

    result = adapter.health()

    assert result["status"] == "ok"
    assert result["dataSpace"]["appDataDir"] == str(tmp_path.resolve())
    assert result["dataSpace"]["qilinHome"].endswith("runtime/qilin")
    assert result["dataSpace"]["runtimeConfigPath"].endswith("config/qilin.runtime.yaml")
    assert Path(result["dataSpace"]["runtimeConfigPath"]).is_file()
