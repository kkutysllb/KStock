#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Verify KStock desktop packaging resources.

The source-only mode validates the contract between PyInstaller, electron-builder
and the gateway runtime before a release tag is created.  The default product mode
validates the built ``dist/kstock-gateway`` directory before electron-builder packaging.
"""

from __future__ import annotations

import argparse
import os
import sys
from dataclasses import dataclass
from pathlib import Path


@dataclass
class Check:
    label: str
    ok: bool
    detail: str = ""


class Verifier:
    def __init__(self, repo_root: Path, *, source_only: bool = False) -> None:
        self.repo_root = repo_root.resolve()
        self.source_only = source_only
        self.checks: list[Check] = []

    def pass_(self, label: str) -> None:
        self.checks.append(Check(label, True))

    def fail(self, label: str, detail: str) -> None:
        self.checks.append(Check(label, False, detail))

    def require_path(self, path: Path, label: str) -> bool:
        if not path.exists():
            self.fail(label, f"Missing: {path}")
            return False
        self.pass_(label)
        return True

    def require_executable(self, path: Path, label: str) -> bool:
        if not self.require_path(path, label):
            return False
        if os.name != "nt" and not os.access(path, os.X_OK):
            self.fail(f"{label} executable bit", f"Not executable: {path}")
            return False
        self.pass_(f"{label} is executable")
        return True

    def require_file_contains(self, path: Path, label: str, markers: list[str]) -> None:
        if not self.require_path(path, label):
            return
        text = path.read_text(encoding="utf-8")
        missing = [marker for marker in markers if marker not in text]
        if missing:
            self.fail(f"{label} required markers", f"Missing markers: {', '.join(missing)}")
            return
        self.pass_(f"{label} required markers")

    def verify_source_contract(self) -> None:
        spec = self.repo_root / "scripts" / "kstock-gateway.spec"
        electron_builder = self.repo_root / "apps" / "desktop" / "electron-builder.yml"
        run_gateway = self.repo_root / "scripts" / "run_gateway.py"

        self.require_file_contains(
            spec,
            "source PyInstaller spec",
            [
                "vendor/skills",
                "qilin.config.yaml",
                "lead_soul.md",
                "qilin",
                "scripts.kstock_uploads_config",
                "scripts.kstock_tools.akshare_data_tool",
                "scripts.kstock_tools.akshare_news_tool",
                "scripts.kstock_tools.report_dashboard_tool",
            ],
        )
        self.require_file_contains(
            run_gateway,
            "source gateway runtime setup",
            ["python-runtime", "KSTOCK_PYTHON"],
        )
        self.require_path(self.repo_root / "scripts" / "kstock_python_runtime.py", "source uv Python locator")
        self.require_path(self.repo_root / "vendor" / "skills", "source vendor/skills")
        self.require_path(self.repo_root / "vendor" / "qilin" / "qilin", "source vendor/qilin/qilin")
        self.require_path(self.repo_root / "config" / "qilin.config.yaml", "source config/qilin.config.yaml")
        self.require_path(self.repo_root / "config" / "lead_soul.md", "source config/lead_soul.md")

        if self.require_path(electron_builder, "source electron-builder config"):
            text = electron_builder.read_text(encoding="utf-8")
            # electron-builder extraResources 将 dist/kstock-gateway 映射到 resources/gateway。
            if "from: ../../dist/kstock-gateway" in text and "to: gateway" in text:
                self.pass_("source electron-builder extraResources maps dist/kstock-gateway to gateway")
            else:
                self.fail(
                    "source electron-builder extraResources",
                    "Expected from: ../../dist/kstock-gateway -> to: gateway",
                )

    def verify_product_bundle(self) -> None:
        gateway = self.repo_root / "dist" / "kstock-gateway"
        internal = gateway / "_internal"
        runtime = internal / "python-runtime"

        self.require_path(gateway, "product dist/kstock-gateway")
        executable = gateway / ("kstock-gateway.exe" if os.name == "nt" else "kstock-gateway")
        if not executable.exists():
            alternatives = list(gateway.glob("kstock-gateway*")) if gateway.exists() else []
            if alternatives:
                executable = alternatives[0]
        self.require_executable(executable, "product gateway executable")
        self.require_path(internal / "vendor" / "skills", "product _internal/vendor/skills")
        self.require_path(internal / "qilin", "product _internal/qilin")
        self.require_path(internal / "config" / "qilin.config.yaml", "product _internal/config/qilin.config.yaml")
        self.require_path(internal / "config" / "lead_soul.md", "product _internal/config/lead_soul.md")
        self.require_path(runtime, "product python-runtime")

        candidates = [
            runtime / "bin" / "python3",
            runtime / "bin" / "python3.12",
            runtime / "python.exe",
            runtime / "Scripts" / "python.exe",
        ]
        if any(candidate.exists() for candidate in candidates):
            self.pass_("product python-runtime interpreter")
        else:
            self.fail(
                "product python-runtime interpreter",
                "Missing one of: " + ", ".join(str(path) for path in candidates),
            )

        stdlib_roots = [
            runtime / "lib" / "python3.12",
            runtime / "Lib",
        ]
        stdlib_root = next((path for path in stdlib_roots if (path / "encodings").is_dir()), None)
        if stdlib_root is None:
            self.fail(
                "product python-runtime stdlib encodings",
                "Missing encodings under one of: " + ", ".join(str(path) for path in stdlib_roots),
            )
        else:
            self.pass_("product python-runtime stdlib encodings")
            if os.name != "nt":
                lib_dynload = stdlib_root / "lib-dynload"
                if lib_dynload.is_dir():
                    self.pass_("product python-runtime stdlib lib-dynload")
                else:
                    self.fail("product python-runtime stdlib lib-dynload", f"Missing: {lib_dynload}")

    def run(self) -> int:
        self.verify_source_contract()
        if not self.source_only:
            self.verify_product_bundle()

        failed = [check for check in self.checks if not check.ok]
        for check in self.checks:
            prefix = "[OK]" if check.ok else "[FAIL]"
            print(f"{prefix} {check.label}")
            if check.detail:
                print(f"       {check.detail}")

        if failed:
            print(f"\nPackage resource verification failed: {len(failed)} check(s) failed.", file=sys.stderr)
            return 1
        if self.source_only:
            print("\nSource contract OK — full product verification runs after gateway build.")
        else:
            print("\nPackage resources OK — gateway bundle is ready for electron-builder packaging.")
        return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="校验 KStock 桌面端打包资源。")
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--source-only", action="store_true")
    args = parser.parse_args(argv)
    return Verifier(args.repo_root, source_only=args.source_only).run()


if __name__ == "__main__":
    raise SystemExit(main())
