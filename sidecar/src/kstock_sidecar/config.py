from __future__ import annotations

from pathlib import Path

from pydantic import BaseModel, Field


class SidecarConfig(BaseModel):
    app_name: str = "KStock"
    skill_root: Path = Field(default_factory=lambda: Path("vendor/skills"))
    qilin_repo_path: Path | None = None
    log_level: str = "info"
