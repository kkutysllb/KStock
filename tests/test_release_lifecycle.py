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
    # electron-builder 自动生成 latest-mac.yml / latest.yml / latest-linux.yml
    assert "latest-mac.yml" in script
    assert "latest.yml" in script
    assert ".dmg" in script
    assert ".exe" in script
    assert ".deb" in script


def test_release_script_uses_strict_semver_tags_for_previous_release():
    script = (REPO_ROOT / "build-release.sh").read_text(encoding="utf-8")

    assert "previous_release_tag" in script
    assert "v[0-9]*.[0-9]*.[0-9]*" in script


def test_release_script_stages_lock_files():
    """release 提交必须包含 lock 文件（pnpm-lock.yaml + uv.lock），
    确保跨平台可复现构建。Tauri 的 Cargo.lock 已随迁移删除。"""
    script = (REPO_ROOT / "build-release.sh").read_text(encoding="utf-8")

    assert '"pnpm-lock.yaml"' in script
    assert '"uv.lock"' in script
    assert 'Cargo.lock' not in script
    assert 'tauri.conf.json' not in script


def test_release_workflow_macos_signing_uses_electron_builder_env():
    """electron-builder 原生支持 CSC_LINK / APPLE_* 环境变量进行签名与公证，
    无需手动操作 macOS keychain。"""
    workflow = (REPO_ROOT / ".github" / "workflows" / "release.yml").read_text(encoding="utf-8")

    assert "CSC_LINK" in workflow
    assert "CSC_KEY_PASSWORD" in workflow
    assert "APPLE_ID" in workflow
    assert "APPLE_APP_SPECIFIC_PASSWORD" in workflow
    assert "APPLE_TEAM_ID" in workflow
    assert "security list-keychains" not in workflow
    assert "security set-key-partition-list" not in workflow


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


def test_release_workflow_collects_only_electron_artifacts():
    """收集安装包必须按 KStock* 前缀精确匹配，防止误收 gateway 资源目录
    里的内部可执行文件（如 speech_recognition/flac-win32.exe）。"""
    workflow = (REPO_ROOT / ".github" / "workflows" / "release.yml").read_text(encoding="utf-8")

    assert "-name 'KStock*'" in workflow
    assert "-name '*.exe'" not in workflow
    assert "-name '*.sig'" not in workflow


def test_release_workflow_collects_updater_metadata():
    """electron-builder 自动生成 latest*.yml updater 元数据，release.yml
    只需 find + cp 收集，无需手动构造 latest.json。"""
    workflow = (REPO_ROOT / ".github" / "workflows" / "release.yml").read_text(encoding="utf-8")

    assert "latest*.yml" in workflow
    assert "glob.glob" not in workflow
    assert "latest.json" not in workflow
