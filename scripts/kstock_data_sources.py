"""KStock 项目技能使用的数据源凭证配置。

凭证与模型 API key 采用相同的保存方式：明文只写入当前用户数据空间的
``config/secrets.env``，接口只返回配置状态，绝不把密钥回传给桌面端。
"""

from __future__ import annotations

import os
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field, field_validator

from scripts.kstock_models import upsert_secret


router = APIRouter(prefix="/api/v1/kstock", tags=["kstock-data-sources"])


class DataSourceItem(BaseModel):
    id: str
    label: str
    env_name: str
    configured: bool


class DataSourcesResponse(BaseModel):
    sources: list[DataSourceItem]


class DataSourcesWritePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tushare_token: str | None = Field(default=None, max_length=512)
    iwencai_api_key: str | None = Field(default=None, max_length=512)

    @field_validator("tushare_token", "iwencai_api_key", mode="before")
    @classmethod
    def _blank_to_none(cls, value: Any) -> str | None:
        if value is None:
            return None
        value = str(value).strip()
        return value or None


_DATA_SOURCES = (
    ("tushare", "Tushare Pro", "TUSHARE_TOKEN"),
    ("iwencai", "同花顺问财", "IWENCAI_API_KEY"),
)


def _response() -> DataSourcesResponse:
    return DataSourcesResponse(
        sources=[
            DataSourceItem(
                id=source_id,
                label=label,
                env_name=env_name,
                configured=bool(os.environ.get(env_name)),
            )
            for source_id, label, env_name in _DATA_SOURCES
        ]
    )


@router.get("/data-sources", response_model=DataSourcesResponse)
def list_data_sources() -> DataSourcesResponse:
    """Return data-source labels and configured flags, never secret values."""
    return _response()


@router.get("/data-source-status", response_model=DataSourcesResponse)
def list_data_source_status() -> DataSourcesResponse:
    """Return the public, secret-free connection status used by the shell chrome."""
    return _response()


@router.put("/data-sources", response_model=DataSourcesResponse)
def update_data_sources(payload: DataSourcesWritePayload) -> DataSourcesResponse:
    """Save any supplied credentials; omitted/blank values preserve existing keys."""
    if payload.tushare_token:
        upsert_secret("TUSHARE_TOKEN", payload.tushare_token)
    if payload.iwencai_api_key:
        upsert_secret("IWENCAI_API_KEY", payload.iwencai_api_key)
    return _response()
