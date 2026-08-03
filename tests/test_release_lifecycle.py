from __future__ import annotations

import re
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]


def test_release_script_uses_atomic_push_for_branch_and_tag():
    script = (REPO_ROOT / "build-release.sh").read_text(encoding="utf-8")

    assert "git push --atomic" in script
    assert 'git push origin main\n' not in script
    assert 'git push origin "$VERSION"' not in script


def test_release_script_can_resume_and_saves_failed_run_logs():
    script = (REPO_ROOT / "build-release.sh").read_text(encoding="utf-8")

    assert "--resume" in script
    assert ".release-logs" in script
    assert "save_failure_logs" in script
    assert re.search(r"gh run list.+--workflow", script, re.S)
    assert re.search(r"headBranch.+TAG", script, re.S)


def test_release_script_verifies_release_assets_after_watch():
    script = (REPO_ROOT / "build-release.sh").read_text(encoding="utf-8")

    assert "verify_release_assets" in script
    assert "gh release view" in script
    assert "latest.json" in script
    assert ".dmg" in script
    assert ".msi" in script or ".exe" in script
    assert ".deb" in script or ".AppImage" in script


def test_release_script_uses_strict_semver_tags_for_previous_release():
    script = (REPO_ROOT / "build-release.sh").read_text(encoding="utf-8")

    assert "previous_release_tag" in script
    assert "v[0-9]*.[0-9]*.[0-9]*" in script


def test_release_script_stages_tauri_cargo_lock():
    script = (REPO_ROOT / "build-release.sh").read_text(encoding="utf-8")

    assert '"apps/desktop/src-tauri/Cargo.lock"' in script


def test_release_workflow_macos_keychain_is_non_interactive():
    workflow = (REPO_ROOT / ".github" / "workflows" / "release.yml").read_text(encoding="utf-8")

    assert 'security list-keychains -d user -s "$keychain"' in workflow
    assert 'security set-keychain-settings -lut 21600 "$keychain"' in workflow
    assert "security set-key-partition-list" in workflow


def test_release_workflow_build_step_has_timeout():
    workflow = (REPO_ROOT / ".github" / "workflows" / "release.yml").read_text(encoding="utf-8")

    assert "timeout-minutes: 60" in workflow


def test_release_workflow_uses_stable_linux_builder():
    """Linux 安装包应在稳定旧 Linux 基线上构建，避免 ubuntu-latest 漂移。"""
    workflow = (REPO_ROOT / ".github" / "workflows" / "release.yml").read_text(encoding="utf-8")

    assert "ubuntu-22.04" in workflow
    assert "ubuntu-latest, macos-latest, windows-latest" not in workflow


def test_ci_workflow_uses_stable_linux_builder():
    workflow = (REPO_ROOT / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")

    assert "ubuntu-22.04" in workflow
    assert "ubuntu-latest, macos-latest, windows-latest" not in workflow


def test_release_workflow_collects_only_tauri_artifacts():
    """收集安装包必须按 KStock* 前缀精确匹配，防止误收 gateway 资源目录
    里的内部可执行文件（如 speech_recognition/flac-win32.exe）。"""
    workflow = (REPO_ROOT / ".github" / "workflows" / "release.yml").read_text(encoding="utf-8")

    assert "-name 'KStock*'" in workflow
    assert "-name '*.exe'" not in workflow
    assert "-name '*.sig'" not in workflow


def test_release_workflow_matches_windows_installer_precisely():
    """latest.json 生成脚本对 Windows 产物必须按 KStock* 前缀匹配，
    否则 flac-win32.exe 会被当成安装包并因缺 .sig 而失败。"""
    workflow = (REPO_ROOT / ".github" / "workflows" / "release.yml").read_text(encoding="utf-8")

    assert 'glob.glob("dist-release/KStock*.exe")' in workflow
    assert 'glob.glob("dist-release/KStock*.msi")' in workflow
    assert 'glob.glob("dist-release/KStock*.app.tar.gz")' in workflow
    assert 'glob.glob("dist-release/KStock*.deb")' in workflow
    assert 'glob.glob("dist-release/*.exe")' not in workflow
