from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = REPO_ROOT / "vendor/skills/approved-skills.json"
DEFAULT_VENDOR_ROOT = REPO_ROOT / "vendor/skills"
DEFAULT_QILIN_VENDOR_ROOT = REPO_ROOT / "vendor/qilin"
DEFAULT_QILIN_ROOT = Path("/Users/libing/kk_Projects/QiLin")
DEFAULT_KSKILLS_ROOT = Path("/Users/libing/kk_Projects/KSkills")
DEFAULT_LOCK_PATH = REPO_ROOT / "upstream.lock.json"
# 任意深度排除：VCS/缓存/构建产物。3.x monorepo 中 lib/ 与 dist/ 均为
# tsdown/vite 构建输出（已核实无同名源码目录），vendor/qilin 落地后由
# `pnpm run build` 重新生成。
COPY_IGNORE_NAMES = {
    ".git",
    ".DS_Store",
    "__pycache__",
    ".pytest_cache",
    ".ruff_cache",
    ".mypy_cache",
    ".turbo",
    ".venv",
    "node_modules",
    "lib",
    "dist",
    "dist-exe",
    "build",
    "coverage",
}
# 仅顶层排除：3.x monorepo 中不参与引擎构建/运行的大体积或本地目录。
# 构建链（pnpm install → pnpm run build → qilin CLI）只需要
# packages/ apps/ scripts/ python/ native/ vendor/ + 根配置文件；
# 注意 website/ 与 snapshots/ 必须保留：scripts/ 的 TS 编译引用
# ../website/docs.ts 与 ../snapshots/*（git 内仅 ~100KB + 8.5MB，其本地
# node_modules/构建产物由 COPY_IGNORE_NAMES 排除）。
# .env / .qilin-internal-token 是上游本地密钥，严禁拷入快照。
TOP_LEVEL_EXCLUDES = {
    ".worktrees",
    ".agents",
    ".artifacts",
    ".claude",
    ".drops",
    ".dsh",
    ".env",
    ".pnpm-store",
    ".qilin",
    ".qilin-build",
    ".qilin-internal-token",
    ".upgrade-0.1.6",
    ".venv-fonttools",
    "benchmarks",
    "plans",
    # 上游本地 gitignored 遗留：旧 Python 引擎 config_version 残留，无任何消费者
    "config.yaml",
}


@dataclass(frozen=True)
class SkillCopyItem:
    name: str
    source_dir: Path
    target_dir: Path
    source_repo: str


def load_skill_manifest(manifest_path: Path = DEFAULT_MANIFEST) -> dict[str, Any]:
    return json.loads(manifest_path.read_text(encoding="utf-8"))


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
    import datetime

    def _git_head(repo_root: Path) -> str:
        return subprocess.check_output(
            ["git", "-C", str(repo_root), "rev-parse", "HEAD"],
            text=True,
        ).strip()

    qilin_manifest = json.loads((qilin_root / "package.json").read_text(encoding="utf-8"))
    lock = {
        "generated_at": datetime.date.today().isoformat(),
        "repositories": {
            "QiLin": {
                "path": str(qilin_root),
                "branch": "main",
                "commit": _git_head(qilin_root),
                "version": qilin_manifest.get("version", "unknown"),
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
    # 上游复制完成后重放 KStock 本地技能补丁（vendor 会被整体覆盖，
    # 本地修复集中在 patch_vendor_skills.py 幂等重放）。
    # 直接以 python scripts/sync_upstreams.py 运行时项目根不在 sys.path，
    # 需显式注入以保证 scripts 包可导入（python -m 方式则无需）。
    import sys as _sys

    if str(REPO_ROOT) not in _sys.path:
        _sys.path.insert(0, str(REPO_ROOT))
    from scripts.patch_vendor_skills import apply_skill_patches

    patched = apply_skill_patches(vendor_root=vendor_root)
    if patched:
        print(f"已重放技能补丁 {len(patched)} 个文件：")
        for rel_path in patched:
            print(f"  - {rel_path}")
    return plan


def _make_ignore(source_root: Path):
    def _ignore(dirpath: str, names: list[str]) -> set[str]:
        ignored = {name for name in names if name in COPY_IGNORE_NAMES}
        ignored.update(name for name in names if name.endswith(".egg-info"))
        ignored.update(name for name in names if name.endswith(".pyc"))
        ignored.update(name for name in names if name.endswith(".tsbuildinfo"))
        if Path(dirpath) == source_root:
            ignored.update(name for name in names if name in TOP_LEVEL_EXCLUDES)
        return ignored

    return _ignore


def sync_qilin_engine(
    source_root: Path = DEFAULT_QILIN_ROOT,
    vendor_root: Path = DEFAULT_QILIN_VENDOR_ROOT,
) -> None:
    if not source_root.exists():
        raise FileNotFoundError(f"找不到 QiLin 源目录：{source_root}")
    if vendor_root.exists():
        shutil.rmtree(vendor_root)

    vendor_root.parent.mkdir(parents=True, exist_ok=True)
    # symlinks=True：上游根部的 CLAUDE.md 等为相对符号链接，按链接原样保留，
    # 不解引用（避免内容重复，也避免悬空链接导致复制失败）。
    shutil.copytree(source_root, vendor_root, ignore=_make_ignore(source_root), symlinks=True)


def estimate_qilin_snapshot(
    source_root: Path = DEFAULT_QILIN_ROOT,
) -> tuple[int, int]:
    """按 sync_qilin_engine 相同的排除规则估算快照体积（字节）与文件数。"""
    total_bytes = 0
    total_files = 0
    for dirpath, dirnames, filenames in os.walk(source_root):
        at_top = Path(dirpath) == source_root
        dirnames[:] = [
            name
            for name in dirnames
            if name not in COPY_IGNORE_NAMES
            and not (at_top and name in TOP_LEVEL_EXCLUDES)
            and not name.endswith(".egg-info")
        ]
        for filename in filenames:
            if filename.endswith(".pyc"):
                continue
            candidate = Path(dirpath) / filename
            if candidate.is_symlink():
                continue
            total_bytes += candidate.stat().st_size
            total_files += 1
    return total_bytes, total_files


def main() -> None:
    parser = argparse.ArgumentParser(description="同步 QiLin / KSkills 到 KStock 本地镜像。")
    parser.add_argument("--refresh-lock", action="store_true", help="刷新上游锁文件。")
    parser.add_argument("--sync-qilin", action="store_true", help="同步 QiLin 引擎源码快照。")
    parser.add_argument("--sync-skills", action="store_true", help="同步精选技能包。")
    parser.add_argument(
        "--estimate",
        action="store_true",
        help="仅估算 QiLin 快照体积（按同步排除规则），不执行复制。",
    )
    parser.add_argument("--qilin-root", type=Path, default=DEFAULT_QILIN_ROOT)
    parser.add_argument("--kskills-root", type=Path, default=DEFAULT_KSKILLS_ROOT)
    parser.add_argument("--vendor-root", type=Path, default=DEFAULT_VENDOR_ROOT)
    parser.add_argument("--qilin-vendor-root", type=Path, default=DEFAULT_QILIN_VENDOR_ROOT)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--lock-path", type=Path, default=DEFAULT_LOCK_PATH)
    args = parser.parse_args()

    if args.estimate:
        total_bytes, total_files = estimate_qilin_snapshot(source_root=args.qilin_root)
        print(
            f"QiLin 快照估算：{total_files} 个文件，"
            f"{total_bytes / 1024 / 1024:.1f} MB（排除规则与 --sync-qilin 一致）"
        )
        return

    if args.refresh_lock:
        refresh_upstream_lock(
            lock_path=args.lock_path,
            qilin_root=args.qilin_root,
            kskills_root=args.kskills_root,
        )
        print(f"已刷新锁文件：{args.lock_path}")

    if args.sync_qilin:
        sync_qilin_engine(
            source_root=args.qilin_root,
            vendor_root=args.qilin_vendor_root,
        )
        print(f"已同步 QiLin 引擎到：{args.qilin_vendor_root}")
        # 快照整树重建会冲掉引擎源码上的本地定制，这里立即幂等重放
        # （引擎束构建 build-engine-bundle.sh 步骤 0 也会再兜底一次）。
        rc = subprocess.run(
            [sys.executable, str(REPO_ROOT / "scripts" / "patch_vendor_engine.py")],
            check=False,
        ).returncode
        if rc != 0:
            raise SystemExit(rc)

    if args.sync_skills:
        sync_skill_pack(
            source_root=args.kskills_root,
            vendor_root=args.vendor_root,
            manifest_path=args.manifest,
        )
        print(f"已同步技能包到：{args.vendor_root}")


if __name__ == "__main__":
    main()
