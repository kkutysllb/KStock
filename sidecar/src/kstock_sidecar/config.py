from __future__ import annotations

import os
from pathlib import Path

from pydantic import BaseModel, Field

REPO_ROOT = Path(__file__).resolve().parents[3]


def default_app_data_dir() -> Path:
    env_dir = os.getenv("KSTOCK_APP_DATA_DIR")
    if env_dir:
        return Path(env_dir)
    return REPO_ROOT / ".kstock"


class SidecarConfig(BaseModel):
    app_name: str = "KStock"
    app_data_dir: Path = Field(default_factory=default_app_data_dir)
    skill_root: Path = Field(default_factory=lambda: REPO_ROOT / "vendor/skills")
    qilin_repo_path: Path = Field(default_factory=lambda: REPO_ROOT / "vendor/qilin")
    repo_root: Path = Field(default=REPO_ROOT)
    log_level: str = "info"

    @property
    def development_fallback(self) -> bool:
        return self.app_data_dir.resolve() == (REPO_ROOT / ".kstock").resolve()
