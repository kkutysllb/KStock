#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Verify KStock desktop packaging resources (2.0 engine bundle).

The source-only mode validates the contract between the runtime bundle script,
the KStock plugin packages and electron-builder before a release tag is created.
The default product mode validates the built ``staging/`` runtime closure before
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

ANIMATIONS_PACKAGE = "dsh-animations"
ANIMATIONS_REQUIRED_FILES = (
    "package.json", "cordis.patch.yml", "entry.js", "lib/client.js", "skills/manifest.json",
)
ANIMATIONS_SKILL_COUNT = 8


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

    def require_file_occurrences(self, path: Path, label: str, marker: str, expected: int) -> None:
        if not self.require_path(path, label):
            return
        found = path.read_text(encoding="utf-8").count(marker)
        if found != expected:
            self.fail(label, f"{marker!r} occurs {found} time(s), expected {expected}")
            return
        self.pass_(label)

    def verify_source_contract(self) -> None:
        root = self.repo_root

        # 引擎快照与构建工具链
        self.require_path(root / "vendor" / "qilin" / "apps" / "cli" / "src" / "bin.ts",
                          "source vendor/qilin engine CLI")
        self.require_path(root / "vendor" / "qilin" / "scripts" / "build-exe-for-python-sdk.ts",
                          "source upstream exe build script")
        # 旧 SEA 单文件引擎（dist-exe）已退役（A1 决策）：build-engine-bundle.sh
        # 退出必查清单，仅保留作新旧形态回归对比手动用（发布契约 §5 裁决）。
        self.require_path(root / "scripts" / "build-runtime-bundle.sh", "source runtime bundle script")
        self.require_path(root / "scripts" / "qilin-pnpm.sh", "source pinned pnpm wrapper")
        self.require_path(root / "vendor" / "skills", "source vendor/skills")

        # 文件工作台标签芯片单绘字形（上游 10ed0a5980 同步）：类型级 icon 已删，
        # 文件夹字形只由芯片标题组件绘一次——否则 chip 出现双文件夹图标。
        sidebar_files_definition = (
            root / "vendor" / "qilin" / "packages" / "client"
            / "ui-sidebar-files" / "src" / "client" / "definition.tsx"
        )
        self.require_file_contains(
            sidebar_files_definition,
            "source vendor sidebar-files chip glyph owner",
            ["The chip title owns the tab's folder glyph."],
        )
        self.require_file_occurrences(
            sidebar_files_definition,
            "source vendor sidebar-files single folder glyph",
            "icon: FolderSheetGlyph", 1,
        )

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
        # 落地页左上商标 = 上游 QiLin 印章（vendor/qilin packages/client/ui-brand
        # 的 Seal 几何与字形）：资产须在位，落地页须引用它而非旧项目图标。
        self.require_path(root / "kstock" / "web" / "public" / "qilin-seal.svg",
                          "source kstock landing seal asset")
        self.require_file_contains(
            root / "kstock" / "web" / "public" / "kstock-landing.html",
            "source kstock landing seal mark",
            ["/kstock/qilin-seal.svg"],
        )

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
            # 3.0.5 起打包走运行时闭包（staging 三件套），旧 SEA dist-exe 映射已废。
            staging_markers = (
                "from: ../../staging/kstock-runtime.tar.gz",
                "from: ../../staging/plugins",
                "from: ../../staging/presets",
            )
            if all(marker in text for marker in staging_markers):
                self.pass_("source electron-builder extraResources maps staging closure")
            else:
                self.fail("source electron-builder extraResources",
                          f"Expected staging extraResources: {', '.join(staging_markers)}")

    def verify_engine_client_faces(self) -> None:
        """引擎客户端面契约：KStock 插件运行时消费的引擎服务成员仍存在。

        客户端插件的 ctx 由引擎 runner 在运行时注入，tsc 覆盖不到这条
        缝（kstock 侧只声明最小结构面，不解析 @qilin 模块）。上游引擎
        改名/删除成员时（如 3.0.2 删除 sessions.open、SessionListState
        移除 current），唯一拦截点就是这里——对着引擎契约源码盯标记。
        """
        root = self.repo_root
        qilin = root / "vendor" / "qilin" / "packages"

        # sessions 面（task-target.tsx SessionsFace 消费 create/scope）
        self.require_file_contains(
            qilin / "api" / "session-controller" / "src" / "client" / "contract" / "sessions.ts",
            "engine sessions face",
            ["create(opts?:", "scope(id: SessionId)"],
        )

        # uiWorkspace 面（openSession=旧 sessions.open 替身；selection=旧
        # sessions.list.current 归属；connectWorkspace/pickDirectory 原有）
        self.require_file_contains(
            qilin / "client" / "ui-workspace" / "src" / "client" / "navigation.ts",
            "engine uiWorkspace face",
            ["openSession(target: SessionTarget)",
             "connectWorkspace(workspaceId: WorkspaceId)",
             "pickDirectory(): Promise<string | null>",
             "uiWorkspace: UiWorkspace"],
        )

        # workspaces / layout 面
        self.require_file_contains(
            qilin / "api" / "workspace-controller" / "src" / "client" / "service.ts",
            "engine workspaces face",
            ["create(input: { path: string })"],
        )
        self.require_file_contains(
            qilin / "client" / "ui-layout" / "src" / "client" / "service.ts",
            "engine layout face",
            ["selectPanel(panelId"],
        )

        # KStock 侧反向锚点：桥接必须消费新 API，不得回退旧成员
        task_target = root / "kstock" / "quant-ui" / "src" / "task-target.tsx"
        self.require_file_contains(
            task_target,
            "kstock task-target bridge members",
            ["uiWorkspace.openSession(id)", "selection.getSnapshot()"],
        )
        if task_target.exists():
            text = task_target.read_text(encoding="utf-8")
            stale = [marker for marker in ("sessions.open(", ".list.getSnapshot().current")
                     if marker in text]
            if stale:
                self.fail("kstock task-target stale engine members",
                          f"Removed engine APIs still referenced: {', '.join(stale)}")
            else:
                self.pass_("kstock task-target stale engine members")

    def verify_product_bundle(self) -> None:
        """闭包形态产物（3.0.5 起 staging 三件套；旧 SEA dist-exe 已废，A1 决策）。"""
        closure = self.repo_root / "staging" / "kstock-runtime"
        if not self.require_path(closure, "product runtime closure"):
            return
        self.require_path(closure / "runtime-bootstrap.mjs", "product closure runtime-bootstrap.mjs")
        version_file = closure / ".runtime-version"
        if self.require_path(version_file, "product closure .runtime-version"):
            try:
                version = json.loads(version_file.read_text(encoding="utf-8")).get("version")
            except (OSError, ValueError):
                version = None
            vendor_version = json.loads(
                (self.repo_root / "vendor" / "qilin" / "package.json").read_text(encoding="utf-8")
            ).get("version")
            if version and version == vendor_version:
                self.pass_(f"product closure engine version = {version}")
            else:
                self.fail("product closure engine version",
                          f".runtime-version={version!r} != vendor/qilin package.json {vendor_version!r}")

        for pkg in ("accounts", "automation", "chan-ui", "client-brand", "datasources-ui",
                    "news-ui", "presets-ui", "quant", "quant-factors", "quant-reports",
                    "quant-selections", "quant-strategies", "web"):
            pkg_dir = self.repo_root / "staging" / "plugins" / pkg
            manifest = pkg_dir / "package.json"
            if not self.require_path(manifest, f"product plugins/{pkg} manifest"):
                continue
            lib_dir = pkg_dir / "lib"
            if not lib_dir.is_dir():
                self.fail(f"product plugins/{pkg} lib", f"Missing: {lib_dir}")
                continue
            if any(lib_dir.glob("index.js")) or any(lib_dir.glob("client.cjs")):
                self.pass_(f"product plugins/{pkg} lib artifacts")
            else:
                self.fail(f"product plugins/{pkg} lib artifacts",
                          "No index.js / client.cjs in lib (run the plugin build first)")

        landing = self.repo_root / "staging" / "plugins" / "web" / "public" / "kstock-landing.html"
        self.require_path(landing, "product plugins/web public/kstock-landing.html")

        presets = self.repo_root / "staging" / "presets"
        if self.require_path(presets, "product presets directory"):
            self.require_path(presets / "skills.manifest.json", "product presets skills.manifest.json")
            preset_dirs = [d for d in presets.iterdir() if d.is_dir()]
            if any(any((d / "skills").glob("*/SKILL.md")) for d in preset_dirs):
                self.pass_("product presets carry skill directories")
            else:
                self.fail("product presets carry skill directories",
                          f"No SKILL.md under any preset in {presets}")

    def verify_animations_channel(self) -> None:
        """动效技能库通道契约（QiLin 3.0.5 起的产品层）。

        这层是**启动期硬依赖**：profile 的 bundles 声明了它而安装闭包缺包时，
        引擎的 resolveBundleDir 直接抛错 → 引擎起不来。而构建期上游两处都不拦
        （pkg 资产 glob 空匹配静默跳过；verify-runtime-closure 只遍历 workspace
        包，对非 workspace 依赖不可见），因此这道闸门必须做实。
        """
        root = self.repo_root
        # 1) 源码锚点：壳把它写进 profile bundles；patch 下架了引擎日程三件套
        self.require_file_contains(
            root / "apps" / "desktop" / "electron" / "lib" / "profile-bundles.ts",
            "source animations bundle layer",
            [ANIMATIONS_PACKAGE, "PROFILE_BUNDLES"],
        )
        self.require_file_contains(
            root / "kstock" / "web" / "cordis.patch.yml",
            "source engine schedule capability disabled",
            ["id: schedule", "id: ui-schedule", "disabled: true"],
        )
        if self.source_only:
            return
        # 2) 产物锚点：闭包（或 SEA 的 staging）里必须有该包全量
        candidates = (
            root / "staging" / "kstock-runtime" / "node_modules" / ANIMATIONS_PACKAGE,
            root / "vendor" / "qilin" / "python" / "sdk-runtime" / "src"
            / "deepseek_harness_runtime" / "runtime" / "node" / "node_modules" / ANIMATIONS_PACKAGE,
        )
        pkg_dir = next((c for c in candidates if c.is_dir()), None)
        if pkg_dir is None:
            self.fail("product animations package", f"Not found in any of: {[str(c) for c in candidates]}")
            return
        self.pass_(f"product animations package ({pkg_dir.relative_to(root)})")
        for name in ANIMATIONS_REQUIRED_FILES:
            self.require_path(pkg_dir / name, f"product animations {name}")
        manifest = pkg_dir / "skills" / "manifest.json"
        if manifest.is_file():
            count = len(json.loads(manifest.read_text(encoding="utf-8")).get("skills", []))
            if count == ANIMATIONS_SKILL_COUNT:
                self.pass_(f"product animations skill count = {count}")
            else:
                self.fail("product animations skill count", f"expected {ANIMATIONS_SKILL_COUNT}, got {count}")

    def run(self) -> int:
        self.verify_source_contract()
        self.verify_engine_client_faces()
        self.verify_animations_channel()
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
