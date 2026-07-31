from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


def test_qilin_engine_is_vendored_for_release_packaging():
    vendor_root = REPO_ROOT / "vendor/qilin"
    assert (vendor_root / "pyproject.toml").exists()
    assert (vendor_root / "qilin/client.py").exists()
    assert not (vendor_root / ".git").exists()
