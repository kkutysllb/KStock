from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable


REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_MANIFEST = REPO_ROOT / "vendor/skills/approved-skills.json"
DEFAULT_LOCK = REPO_ROOT / "upstream.lock.json"


@dataclass(frozen=True)
class SkillCopyItem:
    name: str
    source_dir: Path
    target_dir: Path
    source_repo: str


def load_skill_manifest(manifest_path: Path = DEFAULT_MANIFEST) -> dict[str, Any]:
    return json.loads(manifest_path.read_text(encoding="utf-8"))


def load_approved_skill_names(manifest_path: Path = DEFAULT_MANIFEST) -> set[str]:
    manifest = load_skill_manifest(manifest_path)
    return {entry["name"] for entry in manifest["skills"]}


def filter_approved_skills(
    skills: Iterable[dict[str, Any]],
    approved_names: set[str] | None = None,
    manifest_path: Path = DEFAULT_MANIFEST,
) -> list[dict[str, Any]]:
    approved_names = approved_names or load_approved_skill_names(manifest_path)
    return [skill for skill in skills if skill.get("name") in approved_names]


def build_skill_copy_plan(
    source_root: Path,
    vendor_root: Path,
    manifest_path: Path = DEFAULT_MANIFEST,
) -> list[SkillCopyItem]:
    manifest = load_skill_manifest(manifest_path)
    plan: list[SkillCopyItem] = []
    for entry in manifest["skills"]:
        plan.append(
            SkillCopyItem(
                name=entry["name"],
                source_dir=source_root / entry["source_path"],
                target_dir=vendor_root / entry["target_path"],
                source_repo=entry["source_repo"],
            )
        )
    return plan


def load_upstream_lock(lock_path: Path = DEFAULT_LOCK) -> dict[str, Any]:
    return json.loads(lock_path.read_text(encoding="utf-8"))
