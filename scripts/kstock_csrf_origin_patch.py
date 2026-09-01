r"""KStock CSRF Origin 加固补丁（vendor 只读原则下的运行时注入）。

背景
----
KStock 的 gateway 永远以直连方式绑定 localhost（``scripts/run_gateway.py``
注入 ``GATEWAY_HOST=localhost``），前面没有任何反向代理。上游
``app/gateway/csrf_middleware.py`` 的 ``_request_origin`` /
``_request_scheme`` 会优先信任 ``Forwarded`` / ``X-Forwarded-Host`` /
``X-Forwarded-Proto`` / ``X-Forwarded-Port`` 等客户端可伪造头来还原
"浏览器实际访问的 origin"，用于 auth 端点（login / register / initialize /
logout，它们免 double-submit CSRF token，仅靠 Origin 同源比对防护）：

    is_allowed_auth_origin(request):
        request_origin = _request_origin(request)   # ← 可被 Forwarded 伪造
        return origin in cors or origin == request_origin

恶意网页对 ``http://localhost:18001`` 发 POST 时自带 ``Origin:
http://evil.com`` 与 ``Forwarded: host=evil.com;proto=http``，两者相等
即绕过校验——可实现登录 CSRF，并在全新安装时经公开的
``GET /api/v1/auth/setup-status`` 探测 ``needs_setup=true`` 后抢注
管理员（``POST /api/v1/auth/initialize``）。

补丁内容
--------
直连模式下"请求 URL 即真实 URL"：把 ``_request_scheme`` /
``_request_origin`` 替换为仅依据 ``request.url``（真实 scheme + Host）
的实现，完全忽略 Forwarded / X-Forwarded-* 头。这同时修复
``is_secure_request``（cookie secure 标志）对 X-Forwarded-Proto 的信任
（它内部调用 ``_request_scheme``，替换后者即一并生效）。

打包态 ``app://`` 代理行为不受影响：代理把 Origin 改写为 gateway 自身
origin（http://localhost:18001）并携带真实 Host 头，与补丁后的还原值
天然一致。上游未来若提供"可信代理"配置化方案，可改走上游路径并移除
本补丁。
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

_PATCHED_FLAG = "_kstock_csrf_origin_hardened"


def apply_csrf_origin_hardening() -> None:
    """以直连模式替换 csrf_middleware 的 origin/scheme 还原逻辑（幂等）。"""
    try:
        from app.gateway import csrf_middleware
    except ImportError:  # pragma: no cover - gateway 依赖缺失时静默跳过
        return

    if getattr(csrf_middleware, _PATCHED_FLAG, False):
        return

    original_origin = csrf_middleware._request_origin

    def _direct_scheme(request):
        """直连模式：请求 scheme 即真实 scheme，忽略 Forwarded/X-Forwarded-Proto。""";
        return request.url.scheme.lower()

    def _direct_request_origin(request):
        """直连模式：仅依据真实 request.url 计算 origin，忽略可伪造转发头。"""
        normalized = csrf_middleware._normalize_origin(
            request.url.scheme.lower() + "://" + request.url.netloc
        )
        if normalized is None:
            # 极端场景（非法 Host 头导致无法归一化）：退回上游实现兜底。
            return original_origin(request)
        return normalized

    csrf_middleware._request_scheme = _direct_scheme
    csrf_middleware._request_origin = _direct_request_origin
    setattr(csrf_middleware, _PATCHED_FLAG, True)
    logger.info("kstock csrf origin hardening applied (direct-bind mode)")