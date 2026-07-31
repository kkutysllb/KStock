from kstock_sidecar.skills import load_upstream_lock


def test_upstream_lock_tracks_local_mirrors():
    lock = load_upstream_lock()
    assert lock["repositories"]["QiLin"]["commit"] == "012a0758b6f818e15070f07f5417aa2cc9818160"
    assert lock["repositories"]["KSkills"]["commit"] == "e48e5326bcf6c8f6f0c191837a31182fedfa142b"
