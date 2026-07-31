from kstock_sidecar.protocol import Request
from kstock_sidecar.qilin_adapter import QiLinAdapter
from kstock_sidecar.server import dispatch_request


def test_health_dispatch_returns_ok():
    adapter = QiLinAdapter(client_factory=lambda: object())
    response = dispatch_request(Request(id="1", method="health", params={}), adapter=adapter)
    assert response.ok is True
    assert response.result["status"] == "ok"
