"""pytest 全局配置。

仓库根未被作为 Python 包安装（pyproject package=false），这里把仓库根
加入 sys.path，让测试可以用 ``from scripts.kstock_models import ...``
直接导入 scripts 目录下的模块。
"""
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

# qilin 以 editable 方式安装指向上游仓库（QiLin），而 KStock 运行时（run_gateway
# 注入）实际加载的是 vendor/qilin 副本（含 KStock 定制：recursion_limit 提升、
# max_turn_extensions/max_budget_extensions 续跑机制等）。测试必须与运行时同源，
# 否则会验证到上游旧行为（如 token 预算超限永远硬停）。
_VENDOR_QILIN = _REPO_ROOT / "vendor" / "qilin"
if _VENDOR_QILIN.is_dir() and str(_VENDOR_QILIN) not in sys.path:
    sys.path.insert(0, str(_VENDOR_QILIN))
