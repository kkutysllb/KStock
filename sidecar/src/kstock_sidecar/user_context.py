from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass
from typing import Iterator


@dataclass(frozen=True)
class KStockCurrentUser:
    id: str


@contextmanager
def kstock_user_context(user_id: str) -> Iterator[None]:
    from qilin.runtime.user_context import reset_current_user, set_current_user

    token = set_current_user(KStockCurrentUser(id=user_id))
    try:
        yield
    finally:
        reset_current_user(token)
