from __future__ import annotations

import os
import stat
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
VERIFIER = REPO_ROOT / "scripts" / "verify_package_resources.py"


def _make_executable(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("#!/bin/sh\n", encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IXUSR)


def _run_verifier(*args: str, repo_root: Path = REPO_ROOT) -> subprocess.CompletedProcess[str]:
    env = {key: value for key, value in os.environ.items() if key != "PYTHONHOME"}
    return subprocess.run(
        [sys.executable, str(VERIFIER), "--repo-root", str(repo_root), *args],
        text=True,
        capture_output=True,
        env=env,
    )


def _write_minimal_source_contract(root: Path) -> None:
    (root / "scripts").mkdir(parents=True)
    (root / "scripts" / "kstock-gateway.spec").write_text(
        """
datas = [
  ("vendor/skills", "vendor/skills"),
  ("config/qilin.config.yaml", "config"),
  ("config/lead_soul.md", "config"),
  ("vendor/qilin/qilin", "qilin"),
]
hiddenimports = [
  "scripts.kstock_uploads_config",
  "scripts.kstock_tools.akshare_data_tool",
  "scripts.kstock_tools.akshare_news_tool",
  "scripts.kstock_tools.report_dashboard_tool",
]
""",
        encoding="utf-8",
    )
    (root / "apps" / "desktop").mkdir(parents=True)
    (root / "apps" / "desktop" / "electron-builder.yml").write_text(
        "extraResources:\n"
        '  - from: ../../dist/kstock-gateway\n'
        '    to: gateway\n',
        encoding="utf-8",
    )
    (root / "scripts" / "run_gateway.py").write_text(
        "def _setup_bundled_python_env():\n    return 'KSTOCK_PYTHON python-runtime'\n",
        encoding="utf-8",
    )
    (root / "scripts" / "kstock_python_runtime.py").write_text("# locator\n", encoding="utf-8")
    (root / "vendor" / "skills").mkdir(parents=True)
    (root / "vendor" / "qilin" / "qilin").mkdir(parents=True)
    (root / "config").mkdir(parents=True)
    (root / "config" / "qilin.config.yaml").write_text("models: []\n", encoding="utf-8")
    (root / "config" / "lead_soul.md").write_text("lead soul\n", encoding="utf-8")


def test_package_resource_verifier_source_only_accepts_required_contract(tmp_path):
    _write_minimal_source_contract(tmp_path)

    result = _run_verifier("--source-only", repo_root=tmp_path)

    assert result.returncode == 0, result.stdout + result.stderr
    assert "Source contract OK" in result.stdout


def test_package_resource_verifier_product_mode_requires_bundled_python(tmp_path):
    _write_minimal_source_contract(tmp_path)
    gateway = tmp_path / "dist" / "kstock-gateway"
    gateway.mkdir(parents=True)
    exe = gateway / ("kstock-gateway.exe" if os.name == "nt" else "kstock-gateway")
    _make_executable(exe)

    result = _run_verifier(repo_root=tmp_path)

    assert result.returncode != 0
    assert "python-runtime" in result.stdout + result.stderr


def test_package_resource_verifier_product_mode_requires_python_stdlib(tmp_path):
    """解释器文件存在但缺 encodings 标准库时，发布校验必须失败。"""
    _write_minimal_source_contract(tmp_path)
    gateway = tmp_path / "dist" / "kstock-gateway"
    internal = gateway / "_internal"
    runtime = internal / "python-runtime"
    (internal / "vendor" / "skills").mkdir(parents=True)
    (internal / "qilin").mkdir(parents=True)
    (internal / "config").mkdir(parents=True)
    (internal / "config" / "qilin.config.yaml").write_text("models: []\n", encoding="utf-8")
    (internal / "config" / "lead_soul.md").write_text("lead soul\n", encoding="utf-8")
    exe = gateway / ("kstock-gateway.exe" if os.name == "nt" else "kstock-gateway")
    _make_executable(exe)
    python_exe = runtime / ("Scripts/python.exe" if os.name == "nt" else "bin/python3")
    _make_executable(python_exe)

    result = _run_verifier(repo_root=tmp_path)

    assert result.returncode != 0
    assert "product python-runtime stdlib encodings" in result.stdout + result.stderr
