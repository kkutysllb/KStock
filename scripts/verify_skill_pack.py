from __future__ import annotations

import argparse
import sys
from pathlib import Path

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.sync_upstreams import DEFAULT_MANIFEST, DEFAULT_VENDOR_ROOT, load_skill_manifest


def _force_utf8_stdio() -> None:
    """Keep Windows CI from failing when stdout defaults to cp1252."""
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")


def collect_pack_issues(
    vendor_root: Path = DEFAULT_VENDOR_ROOT,
    manifest_path: Path = DEFAULT_MANIFEST,
) -> list[str]:
    manifest = load_skill_manifest(manifest_path)
    issues: list[str] = []
    for entry in manifest["skills"]:
        skill_root = vendor_root / entry["target_path"]
        skill_file = skill_root / "SKILL.md"
        if not skill_root.is_dir():
            issues.append(f"{entry['name']}：缺少技能目录 {skill_root}")
            continue
        if not skill_file.is_file():
            issues.append(f"{entry['name']}：缺少 SKILL.md")
            continue
        content = skill_file.read_text(encoding="utf-8", errors="ignore")
        if f"name: {entry['name']}" not in content:
            issues.append(f"{entry['name']}：SKILL.md 的 name 字段不匹配")
    return issues


def main() -> None:
    _force_utf8_stdio()
    parser = argparse.ArgumentParser(description="校验 KStock 精选技能包。")
    parser.add_argument("--vendor-root", type=Path, default=DEFAULT_VENDOR_ROOT)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    args = parser.parse_args()
    issues = collect_pack_issues(vendor_root=args.vendor_root, manifest_path=args.manifest)
    if issues:
        for issue in issues:
            print(issue)
        raise SystemExit(1)
    print("技能包校验通过")


if __name__ == "__main__":
    main()
