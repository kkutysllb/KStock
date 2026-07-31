from pathlib import Path

from kstock_sidecar.skills import build_skill_copy_plan, filter_approved_skills, load_approved_skill_names


def test_approved_skill_names_are_curated():
    names = load_approved_skill_names()
    assert "analysis-report" in names
    assert "kk-strategy-research" not in names
    assert len(names) == 12


def test_filter_approved_skills_removes_unapproved_entries():
    skills = [
        {"name": "analysis-report"},
        {"name": "kk-strategy-research"},
        {"name": "kk-common"},
    ]
    kept = filter_approved_skills(skills)
    assert [skill["name"] for skill in kept] == ["analysis-report", "kk-common"]


def test_build_skill_copy_plan_uses_vendor_root():
    source_root = Path("/Users/libing/kk_Projects/KSkills")
    vendor_root = Path("/tmp/kstock-vendor")
    plan = build_skill_copy_plan(source_root=source_root, vendor_root=vendor_root)
    assert len(plan) == 12
    assert plan[0].source_dir.as_posix().endswith("common/analysis-report")
    assert plan[0].target_dir.as_posix().endswith("common/analysis-report")
