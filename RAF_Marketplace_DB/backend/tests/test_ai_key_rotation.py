"""Automatic API-key switching (KeyPool) and the Gemini provider."""

from __future__ import annotations

import json

import httpx
import pytest

from app.config import settings
from app.services import ai
from app.services.key_pool import (
    AllKeysExhaustedError, KeyPool, ProviderHTTPError, classify, parse_keys,
)


class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def test_parse_keys_merges_and_dedupes():
    assert parse_keys("a, b,,a", None, "c\nb") == ["a", "b", "c"]


def test_classify_by_status():
    assert classify(ProviderHTTPError(429, "slow down")) == "transient"
    assert classify(ProviderHTTPError(503, "down")) == "transient"
    assert classify(ProviderHTTPError(401, "bad key")) == "auth"
    assert classify(ProviderHTTPError(400, "bad request")) == "fatal"
    assert classify(TimeoutError()) == "transient"
    assert classify(ValueError("x")) == "fatal"


def test_round_robin_spreads_requests():
    pool = KeyPool(["k1", "k2", "k3"])
    used = [pool.call(lambda k: k) for _ in range(6)]
    assert used == ["k1", "k2", "k3", "k1", "k2", "k3"]


def test_rate_limited_key_switches_and_is_benched():
    clock = FakeClock()
    pool = KeyPool(["k1", "k2"], cooldown_seconds=60, clock=clock)
    calls: list[str] = []

    def fn(key: str) -> str:
        calls.append(key)
        if key == "k1":
            raise ProviderHTTPError(429, "rate limited")
        return f"ok:{key}"

    assert pool.call(fn) == "ok:k2"          # k1 failed → same request retried on k2
    assert calls == ["k1", "k2"]

    calls.clear()
    for _ in range(3):                         # k1 benched: only k2 is used
        assert pool.call(fn) == "ok:k2"
    assert calls == ["k2", "k2", "k2"]

    assert [s["healthy"] for s in pool.status()] == [False, True]

    clock.now += 61                            # cooldown over → k1 back in rotation
    calls.clear()
    pool.call(lambda k: calls.append(k) or k)
    pool.call(lambda k: calls.append(k) or k)
    assert sorted(calls) == ["k1", "k2"]


def test_auth_failure_benches_longer():
    clock = FakeClock()
    pool = KeyPool(["bad", "good"], cooldown_seconds=60, auth_cooldown_seconds=3600, clock=clock)

    def fn(key: str) -> str:
        if key == "bad":
            raise ProviderHTTPError(401, "invalid key")
        return key

    assert pool.call(fn) == "good"
    clock.now += 120                           # past the normal cooldown, not the auth one
    assert [pool.call(fn) for _ in range(3)] == ["good"] * 3


def test_fatal_error_is_not_retried_on_other_keys():
    pool = KeyPool(["k1", "k2"])
    calls: list[str] = []

    def fn(key: str) -> str:
        calls.append(key)
        raise ProviderHTTPError(400, "bad prompt")

    with pytest.raises(ProviderHTTPError):
        pool.call(fn)
    assert calls == ["k1"]


def test_all_keys_exhausted_raises_and_still_retries_later():
    clock = FakeClock()
    pool = KeyPool(["k1", "k2"], cooldown_seconds=60, clock=clock)

    def fail(key: str) -> str:
        raise ProviderHTTPError(429, "quota")

    with pytest.raises(AllKeysExhaustedError):
        pool.call(fail)
    # Everything benched: the pool still makes one attempt instead of none.
    assert pool.call(lambda k: k) in {"k1", "k2"}


# --- Gemini provider -------------------------------------------------------

def _gemini(monkeypatch, handler, keys="g1,g2"):
    monkeypatch.setattr(settings, "gemini_api_keys", keys)
    monkeypatch.setattr(settings, "gemini_api_key", None)
    return ai.GeminiAIProvider(http_client=httpx.Client(transport=httpx.MockTransport(handler)))


def _ok(text: str) -> httpx.Response:
    return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": text}]}}]})


def test_gemini_rotates_key_on_quota_error(monkeypatch):
    seen: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        key = request.headers["x-goog-api-key"]
        seen.append(key)
        if key == "g1":
            return httpx.Response(429, json={"error": {"status": "RESOURCE_EXHAUSTED"}})
        body = json.loads(request.content)
        assert body["generationConfig"]["responseMimeType"] == "application/json"
        return _ok('```json\n{"name": "Eid", "content_ar": "عيد", "content_en": "Eid"}\n```')

    provider = _gemini(monkeypatch, handler)
    result = provider.generate_campaign(channel="email", topic="Eid")
    assert result["name"] == "Eid"
    assert seen == ["g1", "g2"]
    assert [s["healthy"] for s in provider.key_status()] == [False, True]


def test_gemini_chat_maps_roles_and_system(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        assert [c["role"] for c in body["contents"]] == ["user", "model", "user"]
        assert "shopping assistant" in body["systemInstruction"]["parts"][0]["text"]
        return _ok("Try the Seed Product.")

    provider = _gemini(monkeypatch, handler, keys="only")
    history = [
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": "hello"},
        {"role": "user", "content": "headphones?"},
    ]
    assert provider.assistant_reply(history, [{"name_en": "Seed Product"}]) == "Try the Seed Product."


def test_gemini_requires_a_key(monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_keys", None)
    monkeypatch.setattr(settings, "gemini_api_key", None)
    with pytest.raises(RuntimeError):
        ai.GeminiAIProvider()


def test_provider_is_cached_so_key_health_persists(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "gemini")
    monkeypatch.setattr(settings, "gemini_api_keys", "g1,g2")
    ai.reset_ai_providers()
    try:
        assert ai.get_ai_provider() is ai.get_ai_provider()
    finally:
        ai.reset_ai_providers()


def test_key_status_endpoint_requires_admin(client):
    assert client.get("/ai/keys/status").status_code == 401
