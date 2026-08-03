# -*- mode: python ; coding: utf-8 -*-
"""KStock gateway PyInstaller spec（onedir）。

把 gateway（含全部 Python 依赖、内置技能包、配置模板）打包为自包含目录
``dist/kstock-gateway/``，作为 Tauri 桌面端的内置后端随安装包分发，
实现真正的开箱即用（无需用户安装 Python / 依赖）。

构建命令：
    uv run pyinstaller scripts/kstock-gateway.spec --noconfirm --clean

打包态资源布局（与 run_gateway.py 的 REPO_ROOT = sys._MEIPASS 对应）：
    kstock-gateway/
      kstock-gateway(.exe)      # 可执行文件（supervisor 模式）
      vendor/skills/            # 内置技能包（runtime.yaml 的 skills.path 指向这里）
      config/                   # qilin.config.yaml / lead_soul.md 模板
      _internal/                # Python 运行时 + 全部依赖
"""
from pathlib import Path
import os

from PyInstaller.utils.hooks import collect_data_files

repo_root = Path(SPECPATH).resolve().parent  # spec 位于 <仓库>/scripts/，仓库根是上一级
print(f"[kstock-gateway.spec] repo_root = {repo_root}")
codesign_identity = os.environ.get("APPLE_SIGNING_IDENTITY") or None
if codesign_identity:
    print("[kstock-gateway.spec] using APPLE_SIGNING_IDENTITY for PyInstaller macOS signing")

datas = [
    (str(repo_root / "vendor" / "skills"), "vendor/skills"),
    (str(repo_root / "config" / "qilin.config.yaml"), "config"),
    (str(repo_root / "config" / "lead_soul.md"), "config"),
    # qilin 包数据文件（alembic 迁移脚本、qilinmem 提示模板等）不在 import 链中 ，
    # 需整体复制；与 PYZ 内的编译源码重复但不冲突（文件系统访问用这份）。
    (str(repo_root / "vendor" / "qilin" / "qilin"), "qilin"),
    # akshare 包内数据文件（file_fold/calendar.json 交易日历等）：PyInstaller 默认
    # 只收集 .py，这些文件不进 import 链，缺失会令工具运行时抛
    # FileNotFoundError: .../akshare/file_fold/calendar.json（打包版工具暂不可用）。
    *collect_data_files("akshare"),
]

a = Analysis(
    [str(repo_root / "scripts" / "run_gateway.py")],
    pathex=[str(repo_root)],
    binaries=[],
    datas=datas,
    # 引擎按 runtime.yaml 的 tools 配置运行时动态 import 的工具模块：
    # 静态 import 链看不到它们，必须显式声明才能随包分发。runtime-config
    # 路由也会按字符串动态 import KStock 自定义配置模型（uploads）。
    # 否则打包版会在运行时接口访问时抛 ModuleNotFoundError。
    hiddenimports=[
        "scripts.kstock_uploads_config",
        "scripts.kstock_tools.akshare_data_tool",
        "scripts.kstock_tools.akshare_news_tool",
        "scripts.kstock_tools.report_dashboard_tool",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "pytest",
        "_pytest",
        "tkinter",
        "test",
    ],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="kstock-gateway",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,  # supervisor 模式打印启动日志，必须是控制台程序
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=codesign_identity,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="kstock-gateway",
)
