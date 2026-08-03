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
