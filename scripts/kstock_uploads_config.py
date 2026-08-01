"""KStock 附件上传用户配置段（uploads）。

引擎没有独立的 UploadsConfig pydantic 类——`app_config.uploads` 以 dict 形式
被 `routers/uploads.py` 的 `_get_uploads_config_value` 读取（同时支持 dict 和
attribute 访问）。本模块提供一个 pydantic 模型让 KStock 设置页可编辑限制
字段与文档自动转换开关，写回 runtime.yaml 的 ``uploads`` 段后由引擎增量
合并加载。

字段名严格对齐引擎读取的 key（见 vendor/qilin/app/gateway/routers/uploads.py
``_get_upload_limit`` 的 ``key`` 参数、``DEFAULT_*`` 常量，以及
``_auto_convert_documents_enabled`` 读取的 ``auto_convert_documents``）：

=========================  ===========================  ===========================
字段                       引擎 key                     引擎默认值
=========================  ===========================  ===========================
max_files                  ``max_files``                ``DEFAULT_MAX_FILES = 10``
max_file_size              ``max_file_size``            ``50 * 1024 * 1024`` (50MB)
max_total_size             ``max_total_size``           ``100 * 1024 * 1024`` (100MB)
auto_convert_documents     ``auto_convert_documents``   ``False``（安全默认）
=========================  ===========================  ===========================

注意：KStock 桌面端场景下 ``auto_convert_documents`` 默认开启——用户上传
PDF/docx 等文档后期望 agent 能直接读取，LocalSandboxProvider 下 bash 无法
访问 ``/mnt/user-data/uploads/`` 挂载点，开启自动转换后引擎在上传时把
文档转成 markdown，agent 用 read_file 读文本 md 即可（sandbox tools 路径
映射正常）。

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
    auto_convert_documents 控制上传时是否自动把 PDF/docx 等文档转成 markdown
    （CONVERTIBLE_EXTENSIONS），让 agent 能直接读取文本内容。
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
    auto_convert_documents: bool = Field(
        default=True,
        description=(
            "上传时自动把 PDF/docx/pptx/xlsx 等文档转成 markdown（生成同名 .md）。"
            "开启后 agent 可用 read_file 直接读取文本内容；"
            "关闭则 agent 只能拿到二进制原文件（LocalSandbox 下 bash 无法访问挂载点）。"
        ),
    )
