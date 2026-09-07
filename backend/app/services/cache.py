"""Tiny in-process TTL cache for database-derived payloads.

The backend talks to Supabase over WAN links where each query round-trip
costs ~100-300ms; heavy pages were re-loading the full graph per request.
This cache stores *serialized response payloads* (plain dicts/JSON-safe
values only) for a short TTL. Every cache entry is database-derived data -
nothing here fabricates content, and all write paths call invalidate_all()
so fresh writes show up immediately.
"""

import threading
import time

_TTL_DEFAULT = 120.0
_lock = threading.Lock()
_store = {}  # key -> (expires_at, value)


def get(key: str):
    now = time.time()
    with _lock:
        entry = _store.get(key)
        if not entry:
            return None
        expires_at, value = entry
        if now >= expires_at:
            _store.pop(key, None)
            return None
        return value


def set(key: str, value, ttl: float = _TTL_DEFAULT):
    with _lock:
        _store[key] = (time.time() + ttl, value)


def cached(key: str, ttl: float = _TTL_DEFAULT, producer=None):
    """Return cached value or compute+store it."""
    hit = get(key)
    if hit is not None:
        return hit
    value = producer()
    if value is not None:
        set(key, value, ttl)
    return value


def invalidate_all():
    with _lock:
        _store.clear()
