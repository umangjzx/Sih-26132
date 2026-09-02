"""Tiny in-process sliding-window rate limiter.

Deliberately not backed by Redis: the deployment runs a single Uvicorn worker
(the scheduler is in-process), so a module-level dict is sufficient and has zero
infrastructure. If this ever scales to multiple workers, swap the backing store.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

_lock = threading.Lock()
_hits: dict[str, deque[float]] = defaultdict(deque)


def check(key: str, *, limit: int, window_s: float) -> bool:
    """Record one hit for ``key`` and return True if it is still within
    ``limit`` hits per ``window_s`` seconds, False if the limit is exceeded."""
    now = time.monotonic()
    cutoff = now - window_s
    with _lock:
        q = _hits[key]
        while q and q[0] < cutoff:
            q.popleft()
        if len(q) >= limit:
            return False
        q.append(now)
        # opportunistic cleanup so idle keys don't accumulate forever
        if len(_hits) > 4096:
            for k in [k for k, v in _hits.items() if not v or v[-1] < cutoff]:
                _hits.pop(k, None)
        return True


def reset(key: str | None = None) -> None:
    """Clear one key (or everything). For tests."""
    with _lock:
        if key is None:
            _hits.clear()
        else:
            _hits.pop(key, None)
