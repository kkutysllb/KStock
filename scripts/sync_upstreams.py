from __future__ import annotations

import argparse
import json
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = REPO_ROOT / "vendor/skills/approved-skills.json"
DEFAULT_VENDOR_ROOT = REPO_ROOT / "vendor/skills"
DEFAULT_QILIN_ROOT = Path("/Users/libing/kk_Projects/QiLin")
DEFAULT_KSKILLS_ROOT = Path("/Users/libing/kk_Projects/KSkills")
DEFAULT_LOCK_PATH = REPO_ROOT / "upstream.lock.json"


@dataclass(frozen=True)
class SkillCopyItem:
    name: str
    source_dir: Path
    target_dir: Path
    source_repo: str


def load_skill_manifest(manifest_path: Path = DEFAULT_MANIFEST) -> dict[str, Any]:
    return json.loads(manifest_path.read_text(encoding="utf-8"))


def load_upstream_lock(lock_path: Path = DEFAULT_LOCK_PATH) -> dict[str, Any]:
    return json.loads(lock_path.read_text(encoding="utf-8"))


def build_skill_copy_plan(
    source_root: Path,
    vendor_root: Path,
    manifest_path: Path = DEFAULT_MANIFEST,
) -> list[SkillCopyItem]:
    manifest = load_skill_manifest(manifest_path)
    plan: list[SkillCopyItem] = []
    for entry in manifest["skills"]:
        source_dir = source_root / entry["source_path"]
        target_dir = vendor_root / entry["target_path"]
        plan.append(
            SkillCopyItem(
                name=entry["name"],
                source_dir=source_dir,
                target_dir=target_dir,
                source_repo=entry["source_repo"],
            )
        )
    return plan


def refresh_upstream_lock(
    lock_path: Path = DEFAULT_LOCK_PATH,
    qilin_root: Path = DEFAULT_QILIN_ROOT,
    kskills_root: Path = DEFAULT_KSKILLS_ROOT,
) -> dict[str, Any]:
    def _git_head(repo_root: Path) -> str:
        return subprocess.check_output(
            ["git", "-C", str(repo_root), "rev-parse", "HEAD"],
            text=True,
        ).strip()

    lock = {
        "generated_at": "2026-07-31",
        "repositories": {
            "QiLin": {
                "path": str(qilin_root),
                "branch": "main",
                "commit": _git_head(qilin_root),
            },
            "KSkills": {
                "path": str(kskills_root),
                "branch": "main",
                "commit": _git_head(kskills_root),
            },
        },
        "skills_manifest": "vendor/skills/approved-skills.json",
    }
    lock_path.write_text(
        json.dumps(lock, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return lock


def sync_skill_pack(
    source_root: Path = DEFAULT_KSKILLS_ROOT,
    vendor_root: Path = DEFAULT_VENDOR_ROOT,
    manifest_path: Path = DEFAULT_MANIFEST,
) -> list[SkillCopyItem]:
    plan = build_skill_copy_plan(source_root=source_root, vendor_root=vendor_root, manifest_path=manifest_path)
    for item in plan:
        if not item.source_dir.exists():
            raise FileNotFoundError(f"找不到技能源目录：{item.source_dir}")
        if item.target_dir.exists():
            shutil.rmtree(item.target_dir)
        item.target_dir.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(item.source_dir, item.target_dir)
    return plan


def main() -> None:
    parser = argparse.ArgumentParser(description="同步 QiLin / KSkills 到 KStock 本地镜像。")
    parser.add_argument("--refresh-lock", action="store_true", help="刷新上游锁文件。")
    parser.add_argument("--sync-skills", action="store_true", help="同步精选技能包。")
    parser.add_argument("--qilin-root", type=Path, default=DEFAULT_QILIN_ROOT)
    parser.add_argument("--kskills-root", type=Path, default=DEFAULT_KSKILLS_ROOT)
    parser.add_argument("--vendor-root", type=Path, default=DEFAULT_VENDOR_ROOT)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--lock-path", type=Path, default=DEFAULT_LOCK_PATH)
    args = parser.parse_args()

    if args.refresh_lock:
        refresh_upstream_lock(
            lock_path=args.lock_path,
            qilin_root=args.qilin_root,
            kskills_root=args.kskills_root,
        )
        print(f"已刷新锁文件：{args.lock_path}")

    if args.sync_skills:
        sync_skill_pack(
            source_root=args.kskills_root,
            vendor_root=args.vendor_root,
            manifest_path=args.manifest,
        )
        print(f"已同步技能包到：{args.vendor_root}")


if __name__ == "__main__":
    main()
