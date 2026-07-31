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
