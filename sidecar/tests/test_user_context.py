from kstock_sidecar.user_context import kstock_user_context


def test_kstock_user_context_sets_qilin_current_user():
    with kstock_user_context("local-test-user"):
        from qilin.runtime.user_context import get_effective_user_id

        assert get_effective_user_id() == "local-test-user"
