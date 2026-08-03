from __future__ import annotations

import json
import os
import stat
import subprocess
import sys
from pathlib import Path


def _make_executable(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("#!/bin/sh\n", encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IXUSR)


def test_verify_skill_pack_succeeds_under_windows_cp1252_stdout(tmp_path):
    """Windows Git Bash 默认 cp1252 stdout 时，中文成功信息不能让 CI 崩溃。"""
    vendor_root = tmp_path / "vendor" / "skills"
    skill_root = vendor_root / "public" / "demo-skill"
    skill_root.mkdir(parents=True)
    (skill_root / "SKILL.md").write_text("---\nname: demo-skill\n---\n", encoding="utf-8")
    manifest = tmp_path / "approved-skills.json"
    manifest.write_text(
        json.dumps(
            {
                "schema_version": 1,
                "skills": [
                    {
                        "name": "demo-skill",
                        "target_path": "public/demo-skill",
                    }
                ],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    env = {**os.environ, "PYTHONIOENCODING": "cp1252"}
    result = subprocess.run(
        [
            sys.executable,
            "scripts/verify_skill_pack.py",
            "--vendor-root",
            str(vendor_root),
            "--manifest",
            str(manifest),
        ],
        cwd=Path(__file__).resolve().parents[1],
        env=env,
        text=True,
        capture_output=True,
    )

    assert result.returncode == 0, result.stderr


def test_standalone_python_locator_uses_uv_python_dir(tmp_path):
    """CI 上 setup-uv 会把 Python 安装在 uv 自己的目录，不能猜 HOME/.local。"""
    from scripts.kstock_python_runtime import find_interpreter_in_uv_dir

    uv_dir = tmp_path / "setup-uv-cache" / "python"
    expected = uv_dir / "cpython-3.12.13-linux-x86_64-gnu" / "bin" / "python3.12"
    _make_executable(expected)

    assert find_interpreter_in_uv_dir(uv_dir, "3.12") == expected


def test_standalone_python_locator_supports_windows_layout(tmp_path):
    from scripts.kstock_python_runtime import find_interpreter_in_uv_dir

    uv_dir = tmp_path / "uv" / "python"
    expected = uv_dir / "cpython-3.12.10-windows-x86_64-none" / "python.exe"
    _make_executable(expected)

    assert find_interpreter_in_uv_dir(uv_dir, "3.12") == expected


def test_python_runtime_locator_cli_keeps_stdout_path_only_when_install_logs(tmp_path):
    """build-gateway-bundle.sh 用 $(...) 捕获 stdout，安装日志不能混进路径。"""
    uv_dir = tmp_path / "uv-python"
    expected = uv_dir / "cpython-3.12.13-linux-x86_64-gnu" / "bin" / "python3.12"
    fake_uv_py = tmp_path / "fake_uv.py"
    fake_uv_py.write_text(
        f"""from __future__ import annotations

import os
import stat
import sys
from pathlib import Path

uv_dir = Path({str(uv_dir)!r})
expected = Path({str(expected)!r})

if sys.argv[1:] == ["python", "dir"]:
    print(uv_dir)
elif sys.argv[1:] == ["python", "install", "3.12"]:
    print("Installed Python 3.12")
    expected.parent.mkdir(parents=True, exist_ok=True)
    expected.write_text("#!/bin/sh\\n", encoding="utf-8")
    expected.chmod(expected.stat().st_mode | stat.S_IXUSR)
else:
    print(f"unexpected args: {{sys.argv[1:]}}", file=sys.stderr)
    raise SystemExit(2)
""",
        encoding="utf-8",
    )
    if os.name == "nt":
        fake_uv = tmp_path / "uv.cmd"
        fake_uv.write_text(f'@echo off\r\n"{sys.executable}" "{fake_uv_py}" %*\r\n', encoding="utf-8")
    else:
        fake_uv = tmp_path / "uv"
        fake_uv.write_text(f'#!/usr/bin/env sh\nexec "{sys.executable}" "{fake_uv_py}" "$@"\n', encoding="utf-8")
        fake_uv.chmod(fake_uv.stat().st_mode | stat.S_IXUSR)

    result = subprocess.run(
        [
            sys.executable,
            "scripts/kstock_python_runtime.py",
            "--version",
            "3.12",
            "--uv",
            str(fake_uv),
            "--install-if-missing",
        ],
        cwd=Path(__file__).resolve().parents[1],
        text=True,
        capture_output=True,
    )

    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == str(expected)
    assert "Installed Python 3.12" in result.stderr


def test_gateway_runtime_env_supports_windows_python_exe_layout(tmp_path, monkeypatch):
    """Windows 打包态 python-runtime/python.exe 也必须接入 KSTOCK_PYTHON/PATH。"""
    import scripts.run_gateway as run_gateway

    runtime_dir = tmp_path / "python-runtime"
    python_exe = runtime_dir / "python.exe"
    _make_executable(python_exe)

    monkeypatch.setattr(sys, "frozen", True, raising=False)
    monkeypatch.setattr(sys, "_MEIPASS", str(tmp_path), raising=False)
    monkeypatch.setenv("PATH", "original-path")
    monkeypatch.delenv("KSTOCK_PYTHON", raising=False)

    run_gateway._setup_bundled_python_env()

    assert os.environ["KSTOCK_PYTHON"] == str(python_exe)
    assert os.environ["PATH"].split(os.pathsep, 1)[0] == str(runtime_dir)


def test_build_gateway_bundle_uses_shared_python_runtime_locator():
    script = Path("scripts/build-gateway-bundle.sh").read_text(encoding="utf-8")

    assert "kstock_python_runtime.py" in script
    assert "uv python find --managed" not in script


def test_build_gateway_bundle_accepts_linux_versioned_libpython_name():
    script = Path("scripts/build-gateway-bundle.sh").read_text(encoding="utf-8")

    assert "lib/libpython3.12.so.1.0" in script


def test_build_gateway_bundle_verifies_product_package_resources():
    script = Path("scripts/build-gateway-bundle.sh").read_text(encoding="utf-8")

    assert "verify_package_resources.py" in script
    assert "--source-only" not in script


def test_check_ci_verifies_source_package_contract():
    script = Path("scripts/check-ci.sh").read_text(encoding="utf-8")

    assert "verify_package_resources.py --source-only" in script
