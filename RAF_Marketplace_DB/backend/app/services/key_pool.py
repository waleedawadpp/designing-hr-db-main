"""Automatic API-key rotation for AI providers.

A :class:`KeyPool` holds several API keys for one provider. Requests are spread
round-robin across the healthy keys; when a key fails with a rate-limit, quota
or auth error it is benched for a cooldown and the same request is retried on
the next key — the caller never sees the failure unless *every* key is down.

Error classification is provider-agnostic: anything exposing an HTTP
``status_code`` (Anthropic SDK errors, ``httpx`` responses wrapped in
:class:`ProviderHTTPError`) is classified by status.

- 429 / 529 / 5xx  → transient: bench for ``cooldown_seconds``.
- 401 / 403        → key is bad or revoked: bench for ``auth_cooldown_seconds``.
- anything else    → a request problem, not a key problem: raised immediately.
"""

from __future__ import annotations

import logging
import threading
import time
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from typing import TypeVar

log = logging.getLogger(__name__)

T = TypeVar("T")

_TRANSIENT_STATUSES = {408, 409, 429, 500, 502, 503, 504, 529}
_AUTH_STATUSES = {401, 403}


class ProviderHTTPError(Exception):
    """An HTTP error from a provider, carrying the status code for classification."""

    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(f"HTTP {status_code}: {message}")
        self.status_code = status_code


class AllKeysExhaustedError(RuntimeError):
    """Every key in the pool failed (or is cooling down) for this request."""


def parse_keys(*values: str | None) -> list[str]:
    """Merge comma/newline-separated key strings into a de-duplicated list."""
    keys: list[str] = []
    for value in values:
        if not value:
            continue
        for raw in value.replace("\n", ",").split(","):
            key = raw.strip()
            if key and key not in keys:
                keys.append(key)
    return keys


def mask(key: str) -> str:
    """Log-safe identifier for a key (never log the key itself)."""
    return f"…{key[-4:]}" if len(key) > 8 else "…"


def _status_of(exc: BaseException) -> int | None:
    status = getattr(exc, "status_code", None)
    if isinstance(status, int):
        return status
    response = getattr(exc, "response", None)
    status = getattr(response, "status_code", None)
    return status if isinstance(status, int) else None


def classify(exc: BaseException) -> str:
    """Return ``"transient"``, ``"auth"`` or ``"fatal"`` for an exception."""
    status = _status_of(exc)
    if status in _AUTH_STATUSES:
        return "auth"
    if status in _TRANSIENT_STATUSES:
        return "transient"
    if status is None and isinstance(exc, (TimeoutError, ConnectionError)):
        return "transient"
    name = type(exc).__name__
    if status is None and any(s in name for s in ("Timeout", "Connection", "RateLimit")):
        return "transient"
    return "fatal"


@dataclass
class _KeyState:
    key: str
    benched_until: float = 0.0
    failures: int = 0
    last_error: str | None = None


@dataclass
class KeyPool:
    """Thread-safe round-robin pool of API keys with automatic failover."""

    keys: Iterable[str]
    cooldown_seconds: float = 60.0
    auth_cooldown_seconds: float = 3600.0
    clock: Callable[[], float] = time.monotonic
    _states: list[_KeyState] = field(init=False, repr=False)
    _next: int = field(default=0, init=False, repr=False)
    _lock: threading.Lock = field(default_factory=threading.Lock, init=False, repr=False)

    def __post_init__(self) -> None:
        self._states = [_KeyState(k) for k in parse_keys(*self.keys)]
        if not self._states:
            raise ValueError("KeyPool needs at least one API key")

    def __len__(self) -> int:
        return len(self._states)

    def _order(self) -> list[_KeyState]:
        """Healthy keys in round-robin order, then benched keys soonest-first."""
        with self._lock:
            n = len(self._states)
            start = self._next
            self._next = (self._next + 1) % n
            now = self.clock()
            rotated = [self._states[(start + i) % n] for i in range(n)]
        healthy = [s for s in rotated if s.benched_until <= now]
        if healthy:
            return healthy
        # Everything is benched: still try the one that recovers first rather
        # than failing without a single attempt.
        return [min(rotated, key=lambda s: s.benched_until)]

    def _bench(self, state: _KeyState, seconds: float, exc: BaseException) -> None:
        with self._lock:
            state.benched_until = self.clock() + seconds
            state.failures += 1
            state.last_error = f"{type(exc).__name__}: {exc}"[:300]

    def _ok(self, state: _KeyState) -> None:
        with self._lock:
            state.benched_until = 0.0
            state.failures = 0
            state.last_error = None

    def call(self, fn: Callable[[str], T]) -> T:
        """Run ``fn(key)``, rotating to the next key on key-level failures."""
        errors: list[str] = []
        for state in self._order():
            try:
                result = fn(state.key)
            except Exception as exc:  # noqa: BLE001 — classified below
                kind = classify(exc)
                if kind == "fatal":
                    raise
                seconds = self.auth_cooldown_seconds if kind == "auth" else self.cooldown_seconds
                self._bench(state, seconds, exc)
                log.warning("AI key %s failed (%s): %s — switching key", mask(state.key), kind, exc)
                errors.append(f"{mask(state.key)}: {exc}")
                continue
            self._ok(state)
            return result
        raise AllKeysExhaustedError("All AI API keys failed: " + "; ".join(errors))

    def status(self) -> list[dict]:
        """Per-key health snapshot (keys masked) for diagnostics."""
        now = self.clock()
        with self._lock:
            return [
                {
                    "key": mask(s.key),
                    "healthy": s.benched_until <= now,
                    "retry_in_seconds": max(0, round(s.benched_until - now)),
                    "failures": s.failures,
                    "last_error": s.last_error,
                }
                for s in self._states
            ]
