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


def test_gateway_runtime_env_supports_windows_venv_scripts_layout(tmp_path, monkeypatch):
    """Windows 打包态应优先使用 venv 标准 Scripts/python.exe 布局。"""
    import scripts.run_gateway as run_gateway

    runtime_dir = tmp_path / "python-runtime"
    python_exe = runtime_dir / "Scripts" / "python.exe"
    _make_executable(python_exe)
    dll_dir = runtime_dir / "Lib" / "site-packages" / "curl_cffi.libs"
    dll_dir.mkdir(parents=True)

    monkeypatch.setattr(sys, "frozen", True, raising=False)
    monkeypatch.setattr(sys, "_MEIPASS", str(tmp_path), raising=False)
    monkeypatch.setenv("PATH", "original-path")
    monkeypatch.delenv("KSTOCK_PYTHON", raising=False)
    monkeypatch.delenv("PYTHONHOME", raising=False)

    run_gateway._setup_bundled_python_env()

    assert os.environ["KSTOCK_PYTHON"] == str(python_exe)
    assert os.environ["PYTHONHOME"] == str(runtime_dir)
    path_parts = os.environ["PATH"].split(os.pathsep)
    assert path_parts[:3] == [str(python_exe.parent), str(runtime_dir), str(dll_dir)]


def test_build_gateway_bundle_uses_shared_python_runtime_locator():
    script = Path("scripts/build-gateway-bundle.sh").read_text(encoding="utf-8")

    assert "kstock_python_runtime.py" in script
    assert "uv python find --managed" not in script


def test_build_gateway_bundle_runs_pyinstaller_with_standalone_python():
    script = Path("scripts/build-gateway-bundle.sh").read_text(encoding="utf-8")

    locator_index = script.index("STANDALONE_PY=")
    pyinstaller_index = script.index("pyinstaller scripts/kstock-gateway.spec")
    assert locator_index < pyinstaller_index
    assert 'uv run --python "$STANDALONE_PY" pyinstaller scripts/kstock-gateway.spec' in script


def test_build_gateway_bundle_accepts_linux_versioned_libpython_name():
    script = Path("scripts/build-gateway-bundle.sh").read_text(encoding="utf-8")

    assert "lib/libpython3.12.so.1.0" in script


def test_build_gateway_bundle_preserves_windows_venv_scripts_layout():
    script = Path("scripts/build-gateway-bundle.sh").read_text(encoding="utf-8")

    assert 'RUNTIME_PY="$PYTHON_RUNTIME/Scripts/python.exe"' in script
    assert 'cp "$RUNTIME_PY" "$PYTHON_RUNTIME/Scripts/python3.exe"' in script
    assert "python3.dll" in script


def test_build_gateway_bundle_copies_python_standard_library():
    """发布包的 python-runtime 不能依赖 CI 构建机的 pyvenv.cfg home 路径。"""
    script = Path("scripts/build-gateway-bundle.sh").read_text(encoding="utf-8")

    assert 'STDLIB_SRC_REL="lib/python3.12"' in script
    assert 'STDLIB_SRC_REL="Lib"' in script
    assert 'STDLIB_SRC="$STANDALONE_ROOT/$STDLIB_SRC_REL"' in script
    assert 'STDLIB_DST="$PYTHON_RUNTIME/lib/python3.12"' in script
    assert 'STDLIB_DST="$PYTHON_RUNTIME/Lib"' in script
    assert "encodings" in script
    assert "lib-dynload" in script
    assert "! -name EXTERNALLY-MANAGED" in script


def test_build_gateway_bundle_copies_platform_c_extensions():
    """PBS 把 C 扩展（Windows DLLs/、POSIX lib-dynload/）与 stdlib 分开放置，
    必须整目录复制，否则打包版 import ctypes 会踩 _ctypes.pyd 缺失。
    """
    script = Path("scripts/build-gateway-bundle.sh").read_text(encoding="utf-8")

    assert 'PLATFORM_LIBS_SRC_REL="DLLs"' in script
    assert 'PLATFORM_LIBS_SRC_REL="lib/python3.12/lib-dynload"' in script
    assert 'PLATFORM_LIBS_SRC="$STANDALONE_ROOT/$PLATFORM_LIBS_SRC_REL"' in script
    assert 'PLATFORM_LIBS_DST="$PYTHON_RUNTIME/DLLs"' in script
    assert 'PLATFORM_LIBS_DST="$PYTHON_RUNTIME/lib/python3.12/lib-dynload"' in script
    assert "cp -R \"$PLATFORM_LIBS_SRC/.\" \"$PLATFORM_LIBS_DST/\"" in script


def test_build_gateway_bundle_asserts_ctypes_sentinel_in_platform_libs():
    """复制平台扩展后必须断言 _ctypes.pyd / POSIX glob sentinel 实际存在,防止"目录复制
    成功但内部为空/sentinel 缺失"这类异常蒙混过关。"""
    script = Path("scripts/build-gateway-bundle.sh").read_text(encoding="utf-8")

    assert '_ctypes.pyd' in script
    # POSIX sentinel 布局无关：PBS（20260814 起）把 C 扩展 .so 放在 stdlib
    # 顶层与 .py 混放（_ctypes.cpython-312-darwin.so 等），lib-dynload/ 可能为
    # 空壳，绑死 lib-dynload 的 sentinel 会在 macOS/Linux CI 误报缺失。
    assert "find \"$STDLIB_DST\" -maxdepth 2 -name '_ctypes*.so'" in script
    # Windows 共享 DLL 也要断言存在(pandas / requests / curl_cffi 都依赖)。
    for shared in ("libffi-8.dll", "libssl-3-x64.dll", "libcrypto-3-x64.dll", "sqlite3.dll"):
        assert shared in script, f"Windows shared library sentinel missing: {shared}"


def test_build_gateway_bundle_smoke_imports_ctypes_directly():
    """Smoke 测试必须显式 ``import ctypes`` 而非依赖 pandas 的传递触发。
    否则 build 机 pyvenv.cfg home 仍指向原 PBS 时会从那里 fallback 找到 _ctypes,
    而打包到客户机 PYTHONHOME 切换后立刻失败——但 build 阶段绿灯。
    """
    script = Path("scripts/build-gateway-bundle.sh").read_text(encoding="utf-8")

    # 用 ``print('  python-runtime OK`` 锚点定位真正的 smoke 行（脚本里还有一处
    # ``import site`` 是 PATH bootstrap 用，两者都以 ``$RUNTIME_PY -c`` 开头）。
    smoke_marker = "print('  python-runtime OK"
    smoke_idx = script.index(smoke_marker)
    smoke_line = script[:smoke_idx].rstrip().splitlines()[-1]
    assert "import ctypes" in smoke_line, (
        f"smoke test must import ctypes directly so the build fails loudly when "
        f"_ctypes.pyd / _ctypes.so is missing from python-runtime; got: {smoke_line}"
    )
    # 防回归：``ctypes`` 模块没有 ``_ctypes`` 属性（内部是 ``from _ctypes import
    # ...``），v1.0.9 的 smoke 写了 ``ctypes._ctypes.__file__`` 导致 AttributeError
    # 三平台构建全挂。要拿加载路径必须显式 ``import _ctypes``。
    assert "ctypes._ctypes" not in smoke_line, (
        f"ctypes has no attribute '_ctypes' (this exact bug broke the v1.0.9 "
        f"release on all platforms); use 'import _ctypes' instead; got: {smoke_line}"
    )


def test_verify_package_resources_checks_posix_ctypes_glob():
    """verify_package_resources 的 POSIX 分支必须校验 _ctypes*.so 文件真实存在
    （stdlib 顶层或 lib-dynload），目录存在性会被 PBS 空壳 lib-dynload 绕过。"""
    source = Path("scripts/verify_package_resources.py").read_text(encoding="utf-8")

    assert 'glob("_ctypes*.so")' in source


def test_verify_package_resources_checks_windows_dlls():
    """verify_package_resources 必须在 Windows 路径上同时校验 DLLs/ 与
    _ctypes.pyd,否则无法捕捉 build 脚本漏复制 DLLs 的回归。"""
    source = Path("scripts/verify_package_resources.py").read_text(encoding="utf-8")

    assert "DLLs" in source
    assert "_ctypes.pyd" in source
    # 共享 DLL sentinel 与 build 脚本对齐
    for shared in ("libffi-8.dll", "libssl-3-x64.dll", "libcrypto-3-x64.dll", "sqlite3.dll"):
        assert shared in source, f"verify script missing Windows sentinel: {shared}"


def test_build_gateway_bundle_adds_windows_site_package_dll_dirs_before_import_check():
    script = Path("scripts/build-gateway-bundle.sh").read_text(encoding="utf-8")

    assert "RUNTIME_SITE_PACKAGES" in script
    assert "cygpath -u \"$RUNTIME_SITE_PACKAGES\"" in script
    assert "-name \"*.libs\"" in script
    assert "export PATH" in script


def test_build_gateway_bundle_installs_windows_sitecustomize_for_dll_loading():
    script = Path("scripts/build-gateway-bundle.sh").read_text(encoding="utf-8")

    assert "sitecustomize.py" in script
    assert "add_dll_directory" in script
    assert "*.libs" in script


def test_build_gateway_bundle_signs_macos_gateway_resources_before_desktop_bundle():
    script = Path("scripts/build-gateway-bundle.sh").read_text(encoding="utf-8")

    assert "APPLE_SIGNING_IDENTITY" in script
    assert "codesign" in script
    assert "--options runtime" in script
    assert "--timestamp" in script
    assert "dist/kstock-gateway/kstock-gateway" in script


def test_build_gateway_bundle_rejects_macos_python_framework_from_pyinstaller():
    script = Path("scripts/build-gateway-bundle.sh").read_text(encoding="utf-8")

    assert "macOS gateway 不应包含 Python.framework" in script
    assert 'dist/kstock-gateway/_internal/Python.framework' in script


def test_pyinstaller_spec_uses_macos_developer_id_signing_identity():
    spec = Path("scripts/kstock-gateway.spec").read_text(encoding="utf-8")

    assert "APPLE_SIGNING_IDENTITY" in spec
    assert "codesign_identity=codesign_identity" in spec
    assert "codesign_identity=None" not in spec


def test_pyinstaller_spec_includes_runtime_config_dynamic_imports():
    spec = Path("scripts/kstock-gateway.spec").read_text(encoding="utf-8")

    assert "scripts.kstock_uploads_config" in spec


def test_build_gateway_bundle_does_not_resign_pyinstaller_framework_contents():
    script = Path("scripts/build-gateway-bundle.sh").read_text(encoding="utf-8")

    assert "*.framework/*" in script
    assert "不能后置裸扫逐个重签内部" in script


def test_build_gateway_bundle_does_not_strict_verify_python_framework_symlink():
    script = Path("scripts/build-gateway-bundle.sh").read_text(encoding="utf-8")

    assert 'codesign --verify --strict --verbose=2 "dist/kstock-gateway/_internal/Python"' not in script
    assert 'codesign --verify --deep --strict --verbose=2 "dist/kstock-gateway/_internal/Python.framework"' not in script
    assert 'codesign --verify --strict --verbose=2 "dist/kstock-gateway/_internal/Python.framework/Versions' not in script


def test_build_gateway_bundle_removes_incompatible_speech_recognition_flac_binary():
    script = Path("scripts/build-gateway-bundle.sh").read_text(encoding="utf-8")

    assert "speech_recognition/flac-mac" in script


def test_build_gateway_bundle_verifies_product_package_resources():
    script = Path("scripts/build-gateway-bundle.sh").read_text(encoding="utf-8")

    assert "verify_package_resources.py" in script
    assert "--source-only" not in script


def test_check_ci_verifies_source_package_contract():
    script = Path("scripts/check-ci.sh").read_text(encoding="utf-8")

    assert "verify_package_resources.py --source-only" in script


def test_electron_builder_targets_nsis_on_windows():
    """Windows 发布用 NSIS 安装器（避免 WiX light.exe 对大包脆弱）。"""
    config = Path("apps/desktop/electron-builder.yml").read_text(encoding="utf-8")

    assert "nsis" in config
    assert "msi" not in config.lower()


def test_electron_builder_nsis_artifact_name_aligns_with_updater_metadata():
    """NSIS artifactName 必须使用连字符且无空格。

    electron-builder 默认 ``${productName} Setup ${version}.${ext}`` 带空格,
    GitHub Release 资源名不允许空格,内部会替换成连字符写入 latest.yml.url;
    但实际生成/上传的 .exe 资源名仍可能用点分隔符 (KStock.Setup.1.0.8.exe),
    导致 electron-updater 按 latest.yml.url 拼接下载 URL 时 404 (历史回归 v1.0.8)。

    显式固定 artifactName 让"实际文件 + latest.yml.url + GitHub 资源名"三处对齐。
    """
    import re

    config = Path("apps/desktop/electron-builder.yml").read_text(encoding="utf-8")

    # 提取 nsis 段(顶层 nsis: 块,排除 mac/linux/win 内部出现的 "nsis" 字串)
    nsis_section_match = re.search(r"^nsis:\n((?:  .*\n)+)", config, re.MULTILINE)
    assert nsis_section_match, "未找到顶层 nsis: 配置块"
    nsis_section = nsis_section_match.group(1)

    artifact_match = re.search(r"^\s*artifactName:\s*(.+?)\s*$", nsis_section, re.MULTILINE)
    assert artifact_match, "nsis 配置块必须显式设置 artifactName (避免 electron-builder 默认带空格导致 GitHub 资源名 vs latest.yml.url 不一致)"
    artifact_pattern = artifact_match.group(1)

    # artifactName 内禁止空格(GitHub 资源名不允许)且不带 `${arch}`(NSIS 没有 arch 维度)
    assert " " not in artifact_pattern, f"nsis.artifactName 含空格会被 GitHub 拒绝: {artifact_pattern!r}"
    assert "${arch}" not in artifact_pattern, f"nsis.artifactName 不应包含 ${{arch}} 宏: {artifact_pattern!r}"
    # 必须含 ${productName} 与 ${version} 才能保证与 macOS/Linux 资源在 latest.yml 的字段一致
    assert "${productName}" in artifact_pattern, f"nsis.artifactName 缺少 ${{productName}}: {artifact_pattern!r}"
    assert "${version}" in artifact_pattern, f"nsis.artifactName 缺少 ${{version}}: {artifact_pattern!r}"


def test_build_release_sh_verifies_updater_metadata_against_actual_assets():
    """build-release.sh 的 verify_release_assets 必须交叉比对 latest.yml 里 url/path
    是否能在 GitHub 资源列表中找到,捕获"实际文件名 ≠ 元数据 URL"的回归。
    """
    script = Path("build-release.sh").read_text(encoding="utf-8")

    assert "verify_release_assets" in script
    # 必须解析 latest.yml / latest-mac.yml / latest-linux.yml 三份元数据
    for f in ("latest.yml", "latest-mac.yml", "latest-linux.yml"):
        assert f in script, f"verify_release_assets 必须解析 {f} 的 url/path 字段"
    # 必须从 release 拉 yml 内容并 grep url/path
    assert "url:" in script and "path:" in script, (
        "verify_release_assets 必须解析 yml 里的 url/path 行,与 GitHub 资源名比对"
    )
    # 必须有失败退出逻辑(否则只是打印就漏检)
    assert "exit 1" in script, "verify_release_assets 检测到不匹配必须以非零状态退出"


def test_electron_builder_skips_linux_appimage():
    """Linux 发布只保留 deb，避免 AppImage linuxdeploy 成为发布阻断点。"""
    config = Path("apps/desktop/electron-builder.yml").read_text(encoding="utf-8")
    linux_section = config.split("linux:", 1)[1]

    assert "deb" in linux_section
    assert "appimage" not in linux_section.lower()


def test_build_desktop_invokes_electron_build():
    """build-desktop.sh 调用 electron:build，不再有 tauri 平台分支。"""
    script = Path("scripts/build-desktop.sh").read_text(encoding="utf-8")

    assert "electron:build" in script
    assert "tauri" not in script.lower()
    assert "--bundles" not in script


def test_desktop_vitest_limits_file_parallelism_for_ci_stability():
    config = Path("apps/desktop/vite.config.ts").read_text(encoding="utf-8")

    assert "fileParallelism: false" in config
    assert "maxWorkers: 1" in config


def test_electron_gateway_startup_preserves_gateway_stderr_in_user_logs():
    source = Path("apps/desktop/electron/lib/gateway.ts").read_text(encoding="utf-8")

    assert "desktop-gateway.log" in source
    # stdout/stderr 统一写入 gateway log fd（对齐 Rust .stdout/.stderr(Stdio::from(...))）。
    assert 'stdio: ["ignore", logFd, logFd]' in source


def test_nsis_installer_hook_stops_gateway_before_copy():
    """NSIS 安装器复制文件前终止 gateway，避免 DLL 占用导致复制失败。"""
    config = Path("apps/desktop/electron-builder.yml").read_text(encoding="utf-8")
    hook = Path("apps/desktop/build/installer.nsh").read_text(encoding="utf-8")

    assert "installer.nsh" in config
    assert "NSIS_HOOK_PREINSTALL" in hook
    assert "kstock-gateway.exe" in hook
    assert "/F /T" in hook


def test_electron_starts_gateway_directly_in_serve_mode_without_stdin():
    source = Path("apps/desktop/electron/lib/gateway.ts").read_text(encoding="utf-8")

    assert '["--serve"]' in source
    # stdin 设为 ignore（对齐 Rust Stdio::null()）。
    assert '"ignore"' in source
    # Windows 避免 cmd 黑窗（对齐 Rust CREATE_NO_WINDOW）。
    assert "windowsHide: true" in source


def test_electron_passes_the_single_gateway_endpoint_to_the_child_process():
    source = Path("apps/desktop/electron/lib/gateway.ts").read_text(encoding="utf-8")

    assert 'GATEWAY_HOST: "localhost"' in source
    assert "GATEWAY_PORT: String(GATEWAY_PORT)" in source


def test_gateway_bundle_removes_stale_product_output_before_pyinstaller():
    script = Path("scripts/build-gateway-bundle.sh").read_text(encoding="utf-8")

    build_index = script.index("pyinstaller scripts/kstock-gateway.spec")
    cleanup_index = script.index('rm -rf "dist/kstock-gateway"')
    assert cleanup_index < build_index


def test_gateway_server_exports_endpoint_before_lazy_app_creation():
    source = Path("scripts/run_gateway.py").read_text(encoding="utf-8")

    port_index = source.index('port = int(os.environ.get("GATEWAY_PORT", "18001"))')
    app_index = source.index("app = sys.modules[__name__].app", port_index)
    assert 'os.environ.setdefault("GATEWAY_HOST", host)' in source
    assert 'os.environ.setdefault("GATEWAY_PORT", str(port))' in source
    assert source.index('os.environ.setdefault("GATEWAY_HOST", host)', port_index) < app_index
    assert source.index('os.environ.setdefault("GATEWAY_PORT", str(port))', port_index) < app_index
    assert "KStock gateway mode: single-process uvicorn" in source


def test_electron_registers_gateway_restart_command():
    gateway = Path("apps/desktop/electron/lib/gateway.ts").read_text(encoding="utf-8")
    main = Path("apps/desktop/electron/main.ts").read_text(encoding="utf-8")

    assert "async restart()" in gateway
    assert "gatewayRestart" in main
    assert "gateway.restart()" in main


def test_packaged_gateway_has_no_python_supervisor_layer():
    source = Path("scripts/run_gateway.py").read_text(encoding="utf-8")

    assert "def _run_supervisor" not in source
    assert "KSTOCK_SUPERVISOR_PID" not in source
    assert "kstock_gateway_control" not in source
