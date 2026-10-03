#!/usr/bin/env python3
"""脚本可移植性门禁：拦「只在某个 runner 的 shell / locale 下才炸」的写法。

背景（2026-10-03 v2.0.0-rc.3 首次下发事故）：release.yml 的 macOS 作业在
「引擎克隆引导」步 0.76 秒即失败——

    scripts/engine-bootstrap.sh: line 123: REPO?: unbound variable

根因既不是网络也不是分支未推送，而是 **bash 3.2**（macOS runner 的
`/bin/bash`）在 **UTF-8 locale** 下把紧跟变量引用之后的多字节字符
（「（」= EF BC 88）并进标识符：`$REPO（` 被解析成变量名 `REPO（`，
`set -u` 当场致命。同一份脚本在本机永远绿，因为本机 `LC_CTYPE=C`：

    $ env -i PATH=/usr/bin:/bin LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 \\
        /bin/bash -c 'REPO=x; echo "$REPO（"'
    ...: REPO?: unbound variable

本脚本两道检查：

1. **静态扫描**（跨平台、与 locale 无关）：`$VAR` 之后紧跟非 ASCII 字符的
   写法一律拒绝，修法是写 `${VAR}`（花括号显式界定变量名）。
2. **3.2 语法扫描**：当 `/bin/bash` 是 3.x（macOS）时，在 UTF-8 locale 下对
   每个脚本跑 `bash -n`，把 3.2 专属的语法/展开错误也挡在提交前。
   Linux/Windows runner 的 bash 是 5.x，解析口径与 ubuntu 车道一致，跳过。

退出码：0 = 通过，1 = 有违例（逐条打印 file:line 与修法）。
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# $VAR 紧跟非 ASCII 字符 —— bash 3.2 + UTF-8 locale 下会被并进变量名。
NON_ASCII_AFTER_VAR = re.compile(r"\$([A-Za-z_][A-Za-z0-9_]*)(?=[^\x00-\x7F])")

# 引擎克隆（vendor/qilin）与构建产物不是本仓脚本，且 clone 会被 --prune 掉。
SKIP_PREFIXES = (
    "vendor/",
    "staging/",
    "dist-exe/",
    "dist/",
    "node_modules/",
)

# macOS runner 的 shell：bash 3.2，默认 locale 为 UTF-8。
RUNNER_BASH = "/bin/bash"
HOSTILE_LOCALE = {"LANG": "en_US.UTF-8", "LC_ALL": "en_US.UTF-8"}


def tracked_files() -> list[str]:
    result = subprocess.run(
        ["git", "ls-files", "-z"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    return [
        name
        for name in result.stdout.split("\0")
        if name and not name.startswith(SKIP_PREFIXES)
    ]


def is_shell_script(name: str, text: str) -> bool:
    if name.endswith((".sh", ".bash")):
        return True
    first = text.splitlines()[0] if text.splitlines() else ""
    return first.startswith("#!") and ("bash" in first or "/sh" in first)


def is_comment_only(line: str) -> bool:
    """整行注释：不参与执行，允许出现 `$VAR（` 这类示例（本门禁脚本自身、
    check-ci.sh 的事故说明里都要写它）。行尾注释不在此列——一行里只要 `#`
    之前还有代码，就照常扫描。"""
    return line.lstrip().startswith("#")


def bash_major_of(path: str) -> int | None:
    """取某个 bash 的主版本号；取不到返回 None。"""
    if not Path(path).exists():
        return None
    try:
        out = subprocess.run(
            [path, "--version"], capture_output=True, text=True, check=True
        ).stdout
    except (OSError, subprocess.CalledProcessError):
        return None
    match = re.search(r"version (\d+)\.", out)
    return int(match.group(1)) if match else None


def scan_static() -> tuple[list[str], list[tuple[str, Path]]]:
    """返回 (违例说明, shell 脚本清单)。"""
    violations: list[str] = []
    shells: list[tuple[str, Path]] = []
    for name in tracked_files():
        path = REPO_ROOT / name
        if not path.is_file():
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        if not is_shell_script(name, text):
            continue
        shells.append((name, path))
        for lineno, line in enumerate(text.splitlines(), 1):
            if is_comment_only(line):
                continue
            for match in NON_ASCII_AFTER_VAR.finditer(line):
                var = match.group(1)
                violations.append(
                    f"{name}:{lineno}: ${{{var}}} → 必须写 ${{{var}}}（当前 `$"
                    f"{var}` 紧跟非 ASCII 字符，bash 3.2 + UTF-8 locale 下会被"
                    f"并进变量名）\n      {line.strip()[:100]}"
                )
    return violations, shells


def scan_bash32_syntax(shells: list[tuple[str, Path]]) -> list[str]:
    """macOS（bash 3.2）上再跑一遍 UTF-8 locale 的 bash -n。"""
    major = bash_major_of(RUNNER_BASH)
    if major is None:
        return [f"（跳过 3.2 语法扫描：未找到 {RUNNER_BASH}）"]
    if major >= 4:
        return [
            f"（跳过 3.2 语法扫描：{RUNNER_BASH} 是 bash {major}.x；"
            f"5.x 解析口径与 ubuntu 车道一致）"
        ]
    env = dict(os.environ)
    env.update(HOSTILE_LOCALE)
    failures: list[str] = []
    for name, path in shells:
        result = subprocess.run(
            [RUNNER_BASH, "-n", str(path)], capture_output=True, text=True, env=env
        )
        if result.returncode != 0:
            detail = (result.stderr or result.stdout).strip().splitlines()
            failures.append(
                f"{name}: bash 3.2（UTF-8 locale）语法校验失败 → {detail[0] if detail else '?'}"
            )
    return failures


def main() -> int:
    violations, shells = scan_static()
    syntax = scan_bash32_syntax(shells)

    for note in [n for n in syntax if n.startswith("（")]:
        print(f"scripts/verify_shell_portability: {note}")

    hard_failures = [n for n in syntax if not n.startswith("（")]
    if not violations and not hard_failures:
        print(
            f"✓ 脚本可移植性门禁通过（{len(shells)} 个脚本："
            f"$VAR 紧邻非 ASCII 0 处；bash 3.2 语法 0 处）"
        )
        return 0

    print("✗ 脚本可移植性门禁未通过：", file=sys.stderr)
    for item in violations:
        print(f"  - {item}", file=sys.stderr)
    for item in hard_failures:
        print(f"  - {item}", file=sys.stderr)
    print(
        "\n修法：变量引用一律写 ${VAR}（花括号显式界定变量名）；"
        "如需在 macOS 本地复现，用\n"
        "  env -i PATH=/usr/bin:/bin LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 "
        "/bin/bash -n <脚本>",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
