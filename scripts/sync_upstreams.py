# -*- coding: utf-8 -*-
"""同步上游到 KStock 本地镜像（两个上游、两种形态）。

- **QiLin 引擎**：不再是入库源码快照，而是 fork 分支 ``kstock/<基线>`` 的
  git 克隆（KStock 对引擎的定制就是该分支上的提交，清单锚在
  ``upstream.lock.json`` 的 ``engine.patches``）。引导与契约校验交给
  ``scripts/engine-bootstrap.sh``——本脚本只负责刷新 lock 里的分支/提交口径，
  ``--sync-qilin`` 即该脚本的转发别名。
- **KSkills 技能包**：仍是「拷进 vendor/ + 补丁幂等重放」的快照形态
  （``vendor/skills``）。技能是数据而非代码：快照形态换来可离线、可审阅、
  按技能粒度增删，成本（体积、需重放补丁）可接受。

用法
----
    python3 scripts/sync_upstreams.py --refresh-lock    # 刷新 upstream.lock.json
    python3 scripts/sync_upstreams.py --sync-skills     # 同步技能包 + 重放补丁
    python3 scripts/sync_upstreams.py --sync-qilin      # 转发到 engine-bootstrap.sh
"""

from __future__ import annotations

import argparse
import datetime
import json
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = REPO_ROOT / "vendor/skills/approved-skills.json"
DEFAULT_VENDOR_ROOT = REPO_ROOT / "vendor/skills"
DEFAULT_ENGINE_DIR = REPO_ROOT / "vendor/qilin"
DEFAULT_KSKILLS_ROOT = Path("/Users/libing/kk_Projects/KSkills")
DEFAULT_LOCK_PATH = REPO_ROOT / "upstream.lock.json"
DEFAULT_PATCH_SERIES = ""


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


def _git(repo_root: Path, *args: str) -> str:
    return subprocess.check_output(
        ["git", "-C", str(repo_root), *args],
        text=True,
        encoding="utf-8",
    ).strip()


def refresh_upstream_lock(
    lock_path: Path = DEFAULT_LOCK_PATH,
    engine_dir: Path = DEFAULT_ENGINE_DIR,
    kskills_root: Path = DEFAULT_KSKILLS_ROOT,
) -> dict[str, Any]:
    """刷新 lock 的 branch/commit/version 口径，保留基线与补丁清单。

    基线（``base_tag``/``base_commit``）与补丁清单（``patches``/
    ``product_commits``）是人工维护的**契约事实**，刷新只更新「现在这个克隆
    停在哪」；两者不一致由 ``verify_engine_contract.py`` 响亮拦下，绝不由本
    函数静默改写。
    """
    lock: dict[str, Any] = {}
    if lock_path.exists():
        lock = json.loads(lock_path.read_text(encoding="utf-8"))

    engine: dict[str, Any] = dict(lock.get("engine") or {})
    engine.setdefault("name", "QiLin")
    engine.setdefault("repo", "https://github.com/kkutysllb/QiLin.git")
    engine.setdefault("clone_dir", str(DEFAULT_ENGINE_DIR.relative_to(REPO_ROOT)))

    branch = _git(engine_dir, "rev-parse", "--abbrev-ref", "HEAD")
    if branch == "HEAD":
        # detached HEAD：保留 lock 里记录的分支名（提交才是事实源）。
        branch = str(engine.get("branch", "HEAD"))
    engine["branch"] = branch
    engine["commit"] = _git(engine_dir, "rev-parse", "HEAD")
    engine_manifest = json.loads((engine_dir / "package.json").read_text(encoding="utf-8"))
    engine["version"] = engine_manifest.get("version", engine.get("version", "unknown"))

    skills: dict[str, Any] = dict(lock.get("skills") or {})
    skills.update(
        {
            "name": "KSkills",
            "path": str(kskills_root),
            "branch": "main",
            "commit": _git(kskills_root, "rev-parse", "HEAD"),
        }
    )

    new_lock = {
        "generated_at": datetime.date.today().isoformat(),
        "engine": engine,
        "patch_series": lock.get("patch_series", DEFAULT_PATCH_SERIES),
        "skills": skills,
        "skills_manifest": lock.get(
            "skills_manifest", "vendor/skills/approved-skills.json"
        ),
    }
    lock_path.write_text(
        json.dumps(new_lock, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return new_lock


def sync_skill_pack(
    source_root: Path = DEFAULT_KSKILLS_ROOT,
    vendor_root: Path = DEFAULT_VENDOR_ROOT,
    manifest_path: Path = DEFAULT_MANIFEST,
) -> list[SkillCopyItem]:
    plan = build_skill_copy_plan(
        source_root=source_root, vendor_root=vendor_root, manifest_path=manifest_path
    )
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
    if str(REPO_ROOT) not in sys.path:
        sys.path.insert(0, str(REPO_ROOT))
    from scripts.patch_vendor_skills import apply_skill_patches

    patched = apply_skill_patches(vendor_root=vendor_root)
    if patched:
        print(f"已重放技能补丁 {len(patched)} 个文件：")
        for rel_path in patched:
            print(f"  - {rel_path}")
    return plan


def sync_engine() -> int:
    """转发到 scripts/engine-bootstrap.sh（克隆/更新 + 契约校验）。"""
    bootstrap = REPO_ROOT / "scripts" / "engine-bootstrap.sh"
    if not bootstrap.exists():
        print(f"找不到 {bootstrap}", file=sys.stderr)
        return 1
    bash = shutil.which("bash")
    if bash is None:
        print(
            "未找到 bash——请直接用 Git Bash / WSL 执行 "
            "scripts/engine-bootstrap.sh",
            file=sys.stderr,
        )
        return 1
    return subprocess.run(
        [bash, str(bootstrap)], cwd=str(REPO_ROOT), check=False
    ).returncode


def main() -> None:
    parser = argparse.ArgumentParser(
        description="同步 QiLin 引擎锚点与 KSkills 技能包到 KStock。"
    )
    parser.add_argument("--refresh-lock", action="store_true", help="刷新上游锁文件。")
    parser.add_argument(
        "--sync-qilin",
        action="store_true",
        help="引导 QiLin 引擎克隆（转发 scripts/engine-bootstrap.sh）。",
    )
    parser.add_argument("--sync-skills", action="store_true", help="同步精选技能包。")
    parser.add_argument(
        "--engine-dir",
        type=Path,
        default=DEFAULT_ENGINE_DIR,
        help="引擎克隆目录（默认 vendor/qilin）。",
    )
    parser.add_argument("--kskills-root", type=Path, default=DEFAULT_KSKILLS_ROOT)
    parser.add_argument("--vendor-root", type=Path, default=DEFAULT_VENDOR_ROOT)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--lock-path", type=Path, default=DEFAULT_LOCK_PATH)
    args = parser.parse_args()

    if args.refresh_lock:
        refresh_upstream_lock(
            lock_path=args.lock_path,
            engine_dir=args.engine_dir,
            kskills_root=args.kskills_root,
        )
        print(f"已刷新锁文件：{args.lock_path}")

    if args.sync_qilin:
        rc = sync_engine()
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
