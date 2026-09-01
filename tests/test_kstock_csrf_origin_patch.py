"""KStock CSRF Origin 加固补丁测试。

覆盖 scripts/kstock_csrf_origin_patch.py 的核心安全语义：
直连模式下 auth 端点 Origin 校验不得被 Forwarded / X-Forwarded-* 头伪造绕过。
"""

from types import SimpleNamespace

from scripts.kstock_csrf_origin_patch import apply_csrf_origin_hardening

import pytest


def _request(url: str, headers: dict[str, str] | None = None):
    """构造最小 Request 替身（csrf_middleware 只依赖 url 与 headers）。"""
    from urllib.parse import urlsplit

    parts = urlsplit(url)
    fake_url = SimpleNamespace(scheme=parts.scheme, netloc=parts.netloc, path=parts.path)
    # Starlette Headers 大小写不敏感；替身统一小写键模拟该语义。
    lower_headers = {key.lower(): value for key, value in (headers or {}).items()}
    return SimpleNamespace(url=fake_url, headers=lower_headers)


@pytest.fixture(scope="module", autouse=True)
def _hardened():
    apply_csrf_origin_hardening()


def _middleware():
    from app.gateway import csrf_middleware

    return csrf_middleware


class TestDirectOrigin:
    def test_origin_ignores_forwarded_host(self):
        mw = _middleware()
        request = _request(
            "http://localhost:18001/api/v1/auth/login/local",
            {"Forwarded": 'host=evil.com;proto=http', "Host": "localhost:18001"},
        )
        assert mw._request_origin(request) == "http://localhost:18001"

    def test_origin_ignores_x_forwarded_host_and_port(self):
        mw = _middleware()
        request = _request(
            "http://localhost:18001/api/v1/auth/initialize",
            {"X-Forwarded-Host": "evil.com", "X-Forwarded-Port": "8080"},
        )
        assert mw._request_origin(request) == "http://localhost:18001"

    def test_scheme_ignores_forwarded_proto(self):
        mw = _middleware()
        request = _request(
            "http://localhost:18001/",
            {"X-Forwarded-Proto": "https", "Forwarded": "proto=https"},
        )
        assert mw._request_scheme(request) == "http"

    def test_is_secure_request_not_spoofable(self):
        mw = _middleware()
        request = _request("http://localhost:18001/", {"X-Forwarded-Proto": "https"})
        assert mw.is_secure_request(request) is False


class TestAuthOriginGate:
    """is_allowed_auth_origin：伪造 Forwarded 后 Origin 比对必须失败。"""

    def test_spoofed_forwarded_origin_rejected(self):
        mw = _middleware()
        request = _request(
            "http://localhost:18001/api/v1/auth/initialize",
            {
                "Origin": "http://evil.com",
                "Forwarded": "host=evil.com;proto=http",
                "Host": "localhost:18001",
            },
        )
        assert mw.is_allowed_auth_origin(request) is False

    def test_x_forwarded_host_spoof_rejected(self):
        mw = _middleware()
        request = _request(
            "http://localhost:18001/api/v1/auth/login/local",
            {"Origin": "http://evil.com", "X-Forwarded-Host": "evil.com"},
        )
        assert mw.is_allowed_auth_origin(request) is False

    def test_same_origin_allowed(self):
        mw = _middleware()
        request = _request(
            "http://localhost:18001/api/v1/auth/login/local",
            {"Origin": "http://localhost:18001", "Host": "localhost:18001"},
        )
        assert mw.is_allowed_auth_origin(request) is True

    def test_dev_frontend_origin_allowed_via_cors_env(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        mw = _middleware()
        monkeypatch.setenv("GATEWAY_CORS_ORIGINS", "http://localhost:1420")
        request = _request(
            "http://localhost:18001/api/v1/auth/login/local",
            {"Origin": "http://localhost:1420", "Host": "localhost:18001"},
        )
        assert mw.is_allowed_auth_origin(request) is True

    def test_no_origin_still_allowed_for_non_browser(self):
        """无 Origin 的非浏览器客户端放行（由「关闭注册」在产品层封堵滥用）。"""
        mw = _middleware()
        request = _request("http://localhost:18001/api/v1/auth/logout")
        assert mw.is_allowed_auth_origin(request) is True


def test_patch_is_idempotent() -> None:
    mw = _middleware()
    first = mw._request_origin
    apply_csrf_origin_hardening()
    assert mw._request_origin is first