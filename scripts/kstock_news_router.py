"""Public, cached market-news feed for the anonymous landing page."""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone

from fastapi import APIRouter

from scripts.kstock_tools.akshare_news_tool import fetch_market_news

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/api/v1/kstock/landing-news", tags=["kstock-news"])
_CACHE_TTL_SECONDS = 60.0
_cache: tuple[float, list[dict[str, str]]] = (0.0, [])
_cache_lock = asyncio.Lock()


@router.get("")
async def list_landing_news() -> dict[str, object]:
    """Return at most ten current finance headlines without requiring login."""
    global _cache
    now = time.monotonic()
    if now - _cache[0] < _CACHE_TTL_SECONDS and _cache[1]:
        return {"items": _cache[1], "updated_at": datetime.now(timezone.utc).isoformat()}

    async with _cache_lock:
        now = time.monotonic()
        if now - _cache[0] >= _CACHE_TTL_SECONDS or not _cache[1]:
            try:
                items = await asyncio.to_thread(fetch_market_news, 10)
            except Exception:
                # akshare 缺失 / 依赖未装 / 网络代理异常等都在这里暴露到 gateway.log，
                # 避免落地页空态无任何排障线索（Windows 开发机缺 akshare 时曾因此静默失败）。
                logger.warning("landing-news 拉取失败", exc_info=True)
                items = []
            if items:
                _cache = (time.monotonic(), items)

    return {"items": _cache[1], "updated_at": datetime.now(timezone.utc).isoformat()}
