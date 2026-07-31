from pathlib import Path

from kstock_sidecar.config import SidecarConfig
from kstock_sidecar.protocol import Request
from kstock_sidecar.qilin_adapter import QiLinAdapter
from kstock_sidecar.server import dispatch_request


def test_health_dispatch_returns_ok(tmp_path: Path):
    adapter = QiLinAdapter(client_factory=lambda: object(), config=SidecarConfig(app_data_dir=tmp_path))
    response = dispatch_request(Request(id="1", method="health", params={}), adapter=adapter)
    assert response.ok is True
    assert response.result["status"] == "ok"
