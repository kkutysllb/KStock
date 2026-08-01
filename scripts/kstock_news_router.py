"""Public, cached market-news feed for the anonymous landing page."""

from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone

from fastapi import APIRouter

from scripts.kstock_tools.akshare_news_tool import fetch_market_news


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
                items = []
            if items:
                _cache = (time.monotonic(), items)

    return {"items": _cache[1], "updated_at": datetime.now(timezone.utc).isoformat()}
