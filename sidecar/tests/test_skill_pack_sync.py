from scripts.sync_upstreams import sync_skill_pack
from scripts.verify_skill_pack import collect_pack_issues


def test_sync_and_verify_skill_pack(tmp_path):
    vendor_root = tmp_path / "vendor" / "skills"
    sync_skill_pack(vendor_root=vendor_root)
    assert collect_pack_issues(vendor_root=vendor_root) == []
