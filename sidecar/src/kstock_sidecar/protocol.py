from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class Request(BaseModel):
    id: str
    method: str
    params: dict[str, Any] = Field(default_factory=dict)


class Response(BaseModel):
    id: str
    ok: bool = True
    result: Any | None = None
    error: str | None = None
