# -*- coding: utf-8 -*-
"""引擎克隆契约校验：vendor/qilin 必须等价于 fork 分支的锁定提交。

背景
----
引擎不再以源码快照入库（见 docs/引擎分支工作流.md）。不 vendor 源码的
代价是「磁盘上这棵树到底是什么」不再自明，于是把这件事收敛成一组**可执行
断言**——本脚本即 KStock 侧的契约层（KCoder 形态里 dsh-contract.ts +
BASELINE 断言的等价物）：

1. 克隆存在且是 git 仓库；
2. HEAD == ``upstream.lock.json`` 的 ``engine.commit``（消费态可追溯到提交）；
3. 锁定基线 ``engine.base_commit``（= tag ``engine.base_tag``）是 HEAD 的祖先
   （升级必须显式换基线，不能在旧基线上悄悄叠加）；
4. ``base_commit..HEAD`` 的提交数 == ``len(engine.patches)``（集成分支不允许
   裸提交，与 upstream/FORK 工作流同源）；
5. 每个补丁：提交在 HEAD 历史内、且目标文件里的标记仍在——**上游重构吃掉
   本地定制 = 响亮失败**，绝不静默放行（补丁 14/15/21/22 历史上都丢过或差点
   丢掉）。

用法
----
    python3 scripts/verify_engine_contract.py
    python3 scripts/verify_engine_contract.py --strict-clean   # 工作树脏也算失败

环境变量
--------
    KSTOCK_ENGINE_DIR   覆盖引擎克隆目录（默认取 lock 的 engine.clone_dir）

退出码：0 = 通过；1 = 有失败项。
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
LOCK_PATH = REPO_ROOT / "upstream.lock.json"

OK, BAD, WARN = "✓", "✗", "!"


def git(engine_dir: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", "-C", str(engine_dir), *args],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )


def git_out(engine_dir: Path, *args: str) -> str | None:
    """成功返回 stdout.strip()，失败返回 None。"""
    proc = git(engine_dir, *args)
    if proc.returncode != 0:
        return None
    return proc.stdout.strip()


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    strict_clean = "--strict-clean" in sys.argv[1:]

    failures: list[str] = []
    warnings: list[str] = []

    def ok(msg: str) -> None:
        print(f"{OK} {msg}")

    def warn(msg: str) -> None:
        warnings.append(msg)
        print(f"{WARN} {msg}")

    def fail(msg: str) -> None:
        failures.append(msg)
        print(f"{BAD} {msg}", file=sys.stderr)

    lock = json.loads(LOCK_PATH.read_text(encoding="utf-8"))
    engine_lock = lock["engine"]
    engine_dir = Path(
        os.environ.get("KSTOCK_ENGINE_DIR") or (REPO_ROOT / engine_lock["clone_dir"])
    ).resolve()

    print(f"引擎克隆契约校验：{engine_dir}")

    if git_out(engine_dir, "rev-parse", "--git-dir") is None:
        fail(
            f"引擎克隆缺失或不是 git 仓库：{engine_dir}"
            "（先跑 scripts/engine-bootstrap.sh）"
        )
        print(f"\n{BAD} 引擎克隆契约校验未通过：{len(failures)} 项失败", file=sys.stderr)
        return 1

    head = git_out(engine_dir, "rev-parse", "HEAD")
    expected_commit = engine_lock["commit"]
    if head is None:
        fail("读不到 HEAD")
        head = ""
    elif head == expected_commit:
        ok(f"HEAD == lock.commit（{head[:12]}）")
    else:
        fail(
            f"HEAD {head[:12]} != lock.commit {expected_commit[:12]}"
            "（克隆被切走或被就地改过，先跑 scripts/engine-bootstrap.sh）"
        )

    branch = git_out(engine_dir, "rev-parse", "--abbrev-ref", "HEAD")
    expected_branch = engine_lock["branch"]
    if branch == expected_branch:
        ok(f"分支 == {branch}")
    elif branch == "HEAD":
        warn(
            f"处于 detached HEAD（lock 锁的是提交，可接受；"
            f"分支 {expected_branch} 仅作溯源）"
        )
    else:
        warn(f"当前分支 {branch} != lock.branch {expected_branch}")

    base_commit = engine_lock["base_commit"]
    base_tag = engine_lock["base_tag"]
    tag_commit = git_out(engine_dir, "rev-parse", f"{base_tag}^{{commit}}")
    if tag_commit is None:
        warn(f"本地无 {base_tag} 标签（单分支/浅克隆常见），跳过 tag↔commit 比对")
    elif tag_commit == base_commit:
        ok(f"{base_tag} → {base_commit[:12]}")
    else:
        fail(f"{base_tag} 指向 {tag_commit[:12]} != lock.base_commit {base_commit[:12]}")

    if git(engine_dir, "merge-base", "--is-ancestor", base_commit, "HEAD").returncode == 0:
        ok(f"基线 {base_commit[:12]} 是 HEAD 的祖先")
    else:
        fail(
            f"基线 {base_commit[:12]} 不是 HEAD 的祖先"
            "（换了基线？升级须显式改 upstream.lock.json 的 base_tag/base_commit）"
        )

    patches = engine_lock["patches"]
    expected_count = len(patches)
    declared_count = engine_lock.get("product_commits")
    if declared_count != expected_count:
        fail(
            f"lock 自相矛盾：product_commits={declared_count} 但 patches 列了 "
            f"{expected_count} 条"
        )
    count_raw = git_out(engine_dir, "rev-list", "--count", f"{base_commit}..HEAD")
    if count_raw is None:
        fail(f"数不了 {base_commit[:12]}..HEAD 的提交（基线不在本地历史里？）")
    elif int(count_raw) == expected_count:
        ok(f"产品提交数 == {expected_count}（集成分支无裸提交）")
    else:
        fail(
            f"产品提交数 {count_raw} != lock 的 {expected_count}"
            "（分支被追加或删除了提交；改了分支就要同步 lock）"
        )

    for patch in patches:
        pid, rel_path, marker = patch["id"], patch["file"], patch["marker"]
        commit = str(patch.get("commit", ""))
        target = engine_dir / rel_path
        if commit and git(engine_dir, "merge-base", "--is-ancestor", commit, "HEAD").returncode != 0:
            fail(f"{pid} 提交 {commit[:12]} 不在 HEAD 历史内（{rel_path}）")
            continue
        if not target.is_file():
            fail(f"{pid} 目标文件缺失：{rel_path}（上游改名/搬目录？）")
            continue
        if marker not in target.read_text(encoding="utf-8"):
            fail(
                f"{pid} 补丁标记丢失：{rel_path} 里找不到 {marker!r}"
                "（上游重构吃掉了本地定制，需要在新形态上重做该提交）"
            )
            continue
        ok(f"{pid} {rel_path} :: {marker}")

    dirty = git_out(engine_dir, "status", "--porcelain", "--untracked-files=no")
    if dirty:
        detail = "\n".join(f"    {line}" for line in dirty.splitlines())
        msg = (
            "引擎克隆有未提交的已跟踪改动（产品定制只能走分支提交，"
            f"构建产物被重写属预期，但请确认不是就地改源码）：\n{detail}"
        )
        if strict_clean:
            fail(msg)
        else:
            warn(msg)
    else:
        ok("工作树干净（无未提交的已跟踪改动）")

    print()
    if failures:
        print(
            f"{BAD} 引擎克隆契约校验未通过：{len(failures)} 项失败、"
            f"{len(warnings)} 项告警",
            file=sys.stderr,
        )
        return 1
    print(
        f"{OK} 引擎克隆契约校验通过（{expected_count + 6} 项断言、"
        f"{len(warnings)} 项告警）"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
