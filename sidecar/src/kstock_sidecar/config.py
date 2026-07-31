from __future__ import annotations

from pathlib import Path

from pydantic import BaseModel, Field

REPO_ROOT = Path(__file__).resolve().parents[3]


class SidecarConfig(BaseModel):
    app_name: str = "KStock"
    skill_root: Path = Field(default_factory=lambda: REPO_ROOT / "vendor/skills")
    qilin_repo_path: Path = Field(default_factory=lambda: REPO_ROOT / "vendor/qilin")
    qilin_config_path: Path = Field(default_factory=lambda: REPO_ROOT / "config/qilin.config.yaml")
    qilin_home: Path = Field(default_factory=lambda: REPO_ROOT / ".kstock/qilin")
    log_level: str = "info"
