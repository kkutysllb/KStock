from kstock_sidecar.qilin_adapter import QiLinAdapter


def test_health_reports_unavailable_when_engine_missing():
    adapter = QiLinAdapter(client_factory=lambda: None)
    result = adapter.health()
    assert result["status"] == "unavailable"
    assert result["engine"] == "qilin"


def test_health_reports_vendored_qilin_source_path():
    adapter = QiLinAdapter(client_factory=lambda: object())
    result = adapter.health()
    assert result["status"] == "ok"
    assert result["engine"] == "qilin"
    assert result["source"].endswith("vendor/qilin")
    assert result["config"].endswith("config/qilin.config.yaml")


def test_health_preserves_status_when_qilin_client_raises():
    adapter = QiLinAdapter(client_factory=lambda: (_ for _ in ()).throw(RuntimeError("缺少配置")))
    result = adapter.health()
    assert result["status"] == "unavailable"
    assert result["engine"] == "qilin"
    assert result["detail"] == "缺少配置"
