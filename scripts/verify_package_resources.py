#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Verify KStock desktop packaging resources (2.0 engine bundle).

The source-only mode validates the contract between the engine bundle script,
the KStock plugin packages and electron-builder before a release tag is created.
The default product mode validates the built ``dist-exe/`` directory before
electron-builder packaging.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path

PLUGIN_PACKAGES = ("accounts", "client-brand", "web", "quant",
                   "quant-strategies", "quant-factors", "quant-selections", "quant-reports",
                   "news-ui", "chan-ui")


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
        root = self.repo_root

        # 引擎快照与构建工具链
        self.require_path(root / "vendor" / "qilin" / "apps" / "cli" / "src" / "bin.ts",
                          "source vendor/qilin engine CLI")
        self.require_path(root / "vendor" / "qilin" / "scripts" / "build-exe-for-python-sdk.ts",
                          "source upstream exe build script")
        self.require_path(root / "scripts" / "build-engine-bundle.sh", "source engine bundle script")
        self.require_path(root / "scripts" / "qilin-pnpm.sh", "source pinned pnpm wrapper")
        self.require_path(root / "vendor" / "skills", "source vendor/skills")

        # KStock 插件包：清单 + 宿主/客户端半端 + bundle patch
        # web 是纯宿主 bundle 包（无客户端半端）；quant 为纯数据宿主；
        # client-brand、四个量化库界面包（quant-*）与财经新闻面板（news-ui）
        # 为客户端插件。
        CLIENT_PACKAGES = ("client-brand", "quant-strategies", "quant-factors",
                           "quant-selections", "quant-reports", "news-ui", "chan-ui")
        self.require_path(root / "kstock" / "web" / "cordis.patch.yml", "source kstock/web bundle patch")
        for pkg in PLUGIN_PACKAGES:
            manifest = root / "kstock" / pkg / "package.json"
            if not self.require_path(manifest, f"source kstock/{pkg} manifest"):
                continue
            data = json.loads(manifest.read_text(encoding="utf-8"))
            exports = data.get("exports", {})
            if pkg in CLIENT_PACKAGES:
                if exports.get("./client"):
                    self.pass_(f"source kstock/{pkg} exports ./client")
                else:
                    self.fail(f"source kstock/{pkg} exports ./client", "missing ./client export")
                qilin_client = (data.get("qilin") or {}).get("client") or {}
                if qilin_client.get("platform") == "web":
                    self.pass_(f"source kstock/{pkg} qilin.client platform=web")
                else:
                    self.fail(f"source kstock/{pkg} qilin.client platform=web",
                              f"got {qilin_client.get('platform')!r}")

        # 宿主半端关键源文件（路由与存储契约的锚点）
        self.require_file_contains(
            root / "kstock" / "quant" / "src" / "index.ts",
            "source quant host routes",
            ["/kstock-api", "reports", "strategies", "factors", "selections", "dependencies"],
        )
        self.require_path(root / "kstock" / "quant" / "src" / "store.ts", "source quant library store")
        self.require_path(root / "kstock" / "quant" / "src" / "reports.ts", "source quant report store")
        self.require_path(root / "kstock" / "quant" / "src" / "deps.ts", "source quant dependencies probe")
        self.require_path(root / "kstock" / "web" / "public" / "kstock-landing.html",
                          "source kstock landing page")
        self.require_path(root / "kstock" / "web" / "public" / "kstock-auth.html",
                          "source kstock auth page")

        # 技能随 preset 分发（cordis 模式）：bundle patch 注册 KStock preset
        # root（KSTOCK_PRESETS_DIR），技能绑定在各 preset 的 skill-filesystem
        # 行（baseUrl 随行 skills/），宿主不挂技能行。
        self.require_file_contains(
            root / "kstock" / "web" / "cordis.patch.yml",
            "source skill dir wiring",
            ["agent-presets", "KSTOCK_PRESETS_DIR"],
        )
        self.require_path(root / "kstock" / "presets" / "skills.manifest.json",
                          "source preset skills manifest")
        for preset in ("standard", "market-analysis", "stock-analysis", "stock-screener",
                       "chan-theory-expert", "strategy-research", "factor-mining"):
            self.require_path(root / "kstock" / "presets" / preset / "agent.cordis.yml",
                              f"source preset {preset}")
        self.require_path(root / "kstock" / "presets-ui" / "lib" / "client.cjs",
                          "source kstock presets-ui client build")
        self.require_path(root / "kstock" / "datasources-ui" / "lib" / "client.cjs",
                          "source kstock datasources-ui client build")
        self.require_file_contains(
            root / "kstock" / "quant" / "src" / "index.ts",
            "source quant data-sources routes",
            ["data-sources", "saveDataSources"],
        )

        # 账户面挂载契约：禁用上游 accounts-local 行 + insert KStock fork 行
        # （1.x 账户迁移的挂载前提；组合器不允许替换行换包名）。
        self.require_file_contains(
            root / "kstock" / "web" / "cordis.patch.yml",
            "source kstock accounts mount",
            ["'@kstock/accounts-local'", "kstock-accounts"],
        )

        # Electron 壳（引擎托管形态）
        for rel in ("electron/main.ts", "electron/lib/engine.ts", "electron/lib/window.ts",
                    "electron/lib/menu.ts", "electron/lib/updater.ts", "electron/lib/deps.ts",
                    "electron/lib/chrome.ts"):
            self.require_path(root / "apps" / "desktop" / rel, f"source apps/desktop/{rel}")
        self.require_file_contains(
            root / "apps" / "desktop" / "electron" / "lib" / "engine.ts",
            "source engine host contract",
            ["--profile", "kstock", "KSTOCK_PRESETS_DIR"],
        )
        for legacy in ("electron/lib/gateway.ts", "electron/lib/protocol.ts",
                       "electron/lib/csrf-bridge.ts", "electron/lib/ipc-channels.ts"):
            if (root / "apps" / "desktop" / legacy).exists():
                self.fail("source legacy shell modules removed", f"Still present: {legacy}")
            else:
                self.pass_("source legacy shell modules removed")

        electron_builder = root / "apps" / "desktop" / "electron-builder.yml"
        if self.require_path(electron_builder, "source electron-builder config"):
            text = electron_builder.read_text(encoding="utf-8")
            if "from: ../../dist-exe" in text and "to: engine" in text:
                self.pass_("source electron-builder extraResources maps dist-exe to engine")
            else:
                self.fail("source electron-builder extraResources",
                          "Expected from: ../../dist-exe -> to: engine")

    def verify_product_bundle(self) -> None:
        bundle = self.repo_root / "dist-exe"

        self.require_path(bundle, "product dist-exe")
        suffix = ".exe" if os.name == "nt" else ""
        engine = bundle / f"kstock-engine{suffix}"
        self.require_executable(engine, "product engine executable")
        for companion in (f"-rg{suffix}", f"-spawn-helper{suffix}"):
            candidate = bundle / f"kstock-engine{companion}"
            if candidate.exists():
                self.pass_(f"product engine companion {companion}")
            else:
                self.fail(f"product engine companion {companion}", f"Missing: {candidate}")

        for pkg in PLUGIN_PACKAGES:
            pkg_dir = bundle / "plugins" / pkg
            manifest = pkg_dir / "package.json"
            if not self.require_path(manifest, f"product plugins/{pkg} manifest"):
                continue
            lib_dir = pkg_dir / "lib"
            if not lib_dir.is_dir():
                self.fail(f"product plugins/{pkg} lib", f"Missing: {lib_dir}")
                continue
            built = any(lib_dir.glob("index.js")) or any(lib_dir.glob("client.cjs"))
            if built:
                self.pass_(f"product plugins/{pkg} lib artifacts")
            else:
                self.fail(f"product plugins/{pkg} lib artifacts",
                          "No index.js / client.cjs in lib (run tsdown build first)")

        landing = bundle / "plugins" / "web" / "public" / "kstock-landing.html"
        self.require_path(landing, "product plugins/web public/kstock-landing.html")

        skills = bundle / "skills"
        if self.require_path(skills, "product skills directory"):
            if any(skills.glob("*/SKILL.md")) or any(skills.glob("*/*/SKILL.md")):
                self.pass_("product skills directory has SKILL.md entries")
            else:
                self.fail("product skills directory has SKILL.md entries",
                          f"No SKILL.md under {skills}")

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
            print("\nSource contract OK — full product verification runs after engine bundle build.")
        else:
            print("\nPackage resources OK — engine bundle is ready for electron-builder packaging.")
        return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="校验 KStock 桌面端打包资源。")
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--source-only", action="store_true")
    args = parser.parse_args(argv)
    return Verifier(args.repo_root, source_only=args.source_only).run()


if __name__ == "__main__":
    raise SystemExit(main())
