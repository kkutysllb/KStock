"""KStock 模型配置写入层单元测试。

用 tmp_path 隔离运行时目录与 secrets.env，不触碰真实用户数据空间。
"""
import pytest

from scripts.kstock_models import env_name_for_model


def test_env_name_for_model_basic():
    """name 转大写、非字母数字转下划线，固定前后缀。"""
    assert env_name_for_model("deepseek-v4") == "KSTOCK_MODEL_DEEPSEEK_V4_KEY"
    assert env_name_for_model("glm.5.2") == "KSTOCK_MODEL_GLM_5_2_KEY"
    assert env_name_for_model("Qwen3-Coder") == "KSTOCK_MODEL_QWEN3_CODER_KEY"


def test_env_name_for_model_empty_raises():
    """纯符号/空字符串无法生成合法环境变量名时抛 ValueError。"""
    with pytest.raises(ValueError):
        env_name_for_model("")
    with pytest.raises(ValueError):
        env_name_for_model("---")
    with pytest.raises(ValueError):
        env_name_for_model("...")
