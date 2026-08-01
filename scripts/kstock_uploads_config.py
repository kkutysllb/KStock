"""KStock 附件上传用户配置段（uploads）。

引擎没有独立的 UploadsConfig pydantic 类——`app_config.uploads` 以 dict 形式
被 `routers/uploads.py` 的 `_get_uploads_config_value` 读取（同时支持 dict 和
attribute 访问）。本模块提供一个 pydantic 模型让 KStock 设置页可编辑这三个
限制字段，写回 runtime.yaml 的 ``uploads`` 段后由引擎增量合并加载。

字段名严格对齐引擎读取的 key（见 vendor/qilin/app/gateway/routers/uploads.py
``_get_upload_limit`` 的 ``key`` 参数与 ``DEFAULT_*`` 常量）：

==================  ====================  ==========================
字段                引擎 key              引擎默认值
==================  ====================  ==========================
max_files           ``max_files``         ``DEFAULT_MAX_FILES = 10``
max_file_size       ``max_file_size``     ``50 * 1024 * 1024`` (50MB)
max_total_size      ``max_total_size``    ``100 * 1024 * 1024`` (100MB)
==================  ====================  ==========================

写回 yaml 后需重启 gateway 生效（uploads 段在启动时读入 app_config）。
"""
from __future__ import annotations

from pydantic import BaseModel, Field

# 与 vendor/qilin/app/gateway/routers/uploads.py 的 DEFAULT_* 常量保持一致。
_DEFAULT_MAX_FILES = 10
_DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024
_DEFAULT_MAX_TOTAL_SIZE = 100 * 1024 * 1024


class UploadsUserConfig(BaseModel):
    """附件上传限制（写入 runtime.yaml 的 ``uploads`` 段）。

    所有 size 字段以字节为单位（前端展示时除以 1024 / 1024 转 MB）。
    """

    max_files: int = Field(
        default=_DEFAULT_MAX_FILES,
        ge=1,
        le=100,
        description="单个 thread 允许的最大附件数量",
    )
    max_file_size: int = Field(
        default=_DEFAULT_MAX_FILE_SIZE,
        ge=1,
        description="单个附件的最大字节数",
    )
    max_total_size: int = Field(
        default=_DEFAULT_MAX_TOTAL_SIZE,
        ge=1,
        description="单个 thread 所有附件的总量上限（字节数）",
    )
