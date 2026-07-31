from kstock_sidecar.qilin_adapter import QiLinAdapter


def test_health_reports_unavailable_when_engine_missing():
    adapter = QiLinAdapter(client_factory=lambda: None)
    result = adapter.health()
    assert result["status"] == "unavailable"
    assert result["engine"] == "qilin"
