"""AI provider abstraction for the RAF AI layer.

The default ``StubAIProvider`` is deterministic and offline so the API and its
tests run without external calls. Set ``RAF_AI_PROVIDER=anthropic`` (plus
``RAF_ANTHROPIC_API_KEY``) to swap in a real Claude-backed implementation, or
``RAF_AI_PROVIDER=gemini`` (plus ``RAF_GEMINI_API_KEY``) for Google Gemini.

Both real providers accept several comma-separated keys
(``RAF_ANTHROPIC_API_KEYS`` / ``RAF_GEMINI_API_KEYS``) and switch between them
automatically when one is rate-limited, out of quota or revoked
(see ``app/services/key_pool.py``).

The router persists every generation to ``ai_job`` and chats to
``ai_chat_session`` / ``ai_chat_message``; providers here are pure transforms.
"""

from __future__ import annotations

import json
import re
import threading
from typing import Protocol

import httpx

from app.config import settings
from app.services.key_pool import KeyPool, ProviderHTTPError, parse_keys

_STOPWORDS = {"the", "a", "an", "and", "or", "of", "for", "with", "to", "in", "on", "new"}


def _keywords(*parts: str | None, limit: int = 8) -> list[str]:
    words: list[str] = []
    for part in parts:
        if not part:
            continue
        for w in re.findall(r"[A-Za-z0-9؀-ۿ]+", part.lower()):
            if len(w) > 2 and w not in _STOPWORDS and w not in words:
                words.append(w)
    return words[:limit]


_IMAGE_OPERATIONS = {"background_removal", "enhance", "optimize", "marketing"}


class AIProvider(Protocol):
    def generate_product_content(
        self, *, name_hint: str | None, category: str | None, details: str | None
    ) -> dict: ...

    def assistant_reply(self, history: list[dict], suggestions: list[dict]) -> str: ...

    def process_image(self, *, image_url: str, operation: str) -> dict: ...

    def generate_campaign(self, *, channel: str, topic: str) -> dict: ...


class StubAIProvider:
    """Deterministic, dependency-free provider for local dev and CI."""

    model = "stub-v1"

    def generate_product_content(
        self, *, name_hint: str | None, category: str | None, details: str | None
    ) -> dict:
        base_en = (name_hint or (f"{category} Product" if category else "New Product")).strip()
        title_en = base_en.title()
        title_ar = f"منتج {name_hint}" if name_hint else (f"منتج {category}" if category else "منتج جديد")
        desc_en = (
            f"{title_en} — {details or 'a high-quality product'}. "
            f"Available now on RAF Marketplace with fast delivery across the GCC."
        )
        desc_ar = (
            f"{title_ar} — {details or 'منتج عالي الجودة'}. "
            f"متوفر الآن على سوق RAF مع توصيل سريع في دول الخليج."
        )
        tags = _keywords(name_hint, category, details)
        return {
            "title_ar": title_ar,
            "title_en": title_en,
            "description_ar": desc_ar,
            "description_en": desc_en,
            "tags": tags,
            "seo_title": f"{title_en} | RAF Marketplace",
            "seo_description": desc_en[:160],
        }

    def process_image(self, *, image_url: str, operation: str) -> dict:
        if operation not in _IMAGE_OPERATIONS:
            raise ValueError(f"Unsupported operation: {operation}")
        sep = "&" if "?" in image_url else "?"
        return {
            "operation": operation,
            "processed_url": f"{image_url}{sep}ai={operation}",
            "width": 1024,
            "height": 1024,
        }

    def generate_campaign(self, *, channel: str, topic: str) -> dict:
        return {
            "name": f"{topic} — {channel}",
            "content_ar": f"🎉 {topic}! تسوّق الآن على سوق RAF — عروض حصرية عبر {channel}.",
            "content_en": f"🎉 {topic}! Shop now on RAF Marketplace — exclusive {channel} deals.",
        }

    def assistant_reply(self, history: list[dict], suggestions: list[dict]) -> str:
        last = next((m["content"] for m in reversed(history) if m["role"] == "user"), "")
        if suggestions:
            names = ", ".join(s["name_en"] for s in suggestions[:3])
            return (
                f"Based on “{last}”, here are some options you might like: {names}. "
                f"Tell me your budget or preferred brand and I can refine these."
            )
        return (
            f"I couldn't find a direct match for “{last}” yet. "
            f"Could you share a category or brand so I can suggest products?"
        )


def _parse_json(text: str) -> dict:
    """Parse model JSON output, tolerating Markdown code fences."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else ""
        cleaned = cleaned.rsplit("```", 1)[0]
    return json.loads(cleaned)


class _LLMProvider:
    """Shared prompts for real LLM providers; subclasses implement ``_complete``.

    Each subclass sends requests through a :class:`KeyPool`, so a rate-limited,
    out-of-quota or revoked key is skipped automatically.
    """

    model: str
    pool: KeyPool

    def _complete(
        self, *, messages: list[dict], system: str | None = None,
        max_tokens: int = 1024, json_mode: bool = False,
    ) -> str:
        raise NotImplementedError

    def key_status(self) -> list[dict]:
        return self.pool.status()

    def generate_product_content(self, *, name_hint, category, details) -> dict:
        prompt = (
            "You write e-commerce product copy for an Arabic-first GCC marketplace. "
            "Return STRICT JSON with keys: title_ar, title_en, description_ar, "
            "description_en, tags (array), seo_title, seo_description.\n"
            f"name_hint={name_hint!r} category={category!r} details={details!r}"
        )
        text = self._complete(messages=[{"role": "user", "content": prompt}], json_mode=True)
        return _parse_json(text)

    def assistant_reply(self, history, suggestions) -> str:
        system = (
            "You are RAF's bilingual (Arabic/English) shopping assistant. "
            "Be concise and helpful. Suggested products: "
            + ", ".join(s["name_en"] for s in suggestions)
        )
        return self._complete(
            messages=[{"role": m["role"], "content": m["content"]} for m in history],
            system=system, max_tokens=512,
        )

    def process_image(self, *, image_url, operation) -> dict:
        # A real implementation would call an image model / pipeline here.
        if operation not in _IMAGE_OPERATIONS:
            raise ValueError(f"Unsupported operation: {operation}")
        return {"operation": operation, "processed_url": image_url}

    def generate_campaign(self, *, channel, topic) -> dict:
        prompt = (
            "Write a short bilingual marketing campaign as STRICT JSON with keys "
            f"name, content_ar, content_en for channel={channel!r} topic={topic!r}."
        )
        text = self._complete(
            messages=[{"role": "user", "content": prompt}], max_tokens=512, json_mode=True,
        )
        return _parse_json(text)


def _make_pool(*key_settings: str | None, env_hint: str) -> KeyPool:
    keys = parse_keys(*key_settings)
    if not keys:
        raise RuntimeError(f"{env_hint} is required for this AI provider")
    return KeyPool(
        keys,
        cooldown_seconds=settings.ai_key_cooldown_seconds,
        auth_cooldown_seconds=settings.ai_key_auth_cooldown_seconds,
    )


class AnthropicAIProvider(_LLMProvider):
    """Claude-backed provider. Used when RAF_AI_PROVIDER=anthropic.

    Accepts one key (RAF_ANTHROPIC_API_KEY) or many (RAF_ANTHROPIC_API_KEYS,
    comma-separated) and rotates between them automatically.
    """

    def __init__(self) -> None:
        self.pool = _make_pool(
            settings.anthropic_api_keys, settings.anthropic_api_key,
            env_hint="RAF_ANTHROPIC_API_KEY(S)",
        )
        self.model = settings.ai_model
        # Imported lazily to avoid a hard dependency for stub deployments.
        from anthropic import Anthropic  # type: ignore

        # One client per key; max_retries=0 so a 429 rotates keys immediately
        # instead of the SDK sleeping and retrying on the same exhausted key.
        self._clients: dict[str, object] = {}
        self._client_cls = Anthropic

    def _client(self, key: str):
        client = self._clients.get(key)
        if client is None:
            client = self._client_cls(
                api_key=key, max_retries=0, timeout=settings.ai_request_timeout_seconds,
            )
            self._clients[key] = client
        return client

    def _complete(self, *, messages, system=None, max_tokens=1024, json_mode=False) -> str:
        kwargs = {"model": self.model, "max_tokens": max_tokens, "messages": messages}
        if system:
            kwargs["system"] = system

        def send(key: str) -> str:
            msg = self._client(key).messages.create(**kwargs)
            return msg.content[0].text

        return self.pool.call(send)


class GeminiAIProvider(_LLMProvider):
    """Google Gemini provider (REST via httpx). Used when RAF_AI_PROVIDER=gemini.

    Accepts one key (RAF_GEMINI_API_KEY) or many (RAF_GEMINI_API_KEYS,
    comma-separated) and rotates between them automatically.
    """

    base_url = "https://generativelanguage.googleapis.com/v1beta"

    def __init__(self, http_client: httpx.Client | None = None) -> None:
        self.pool = _make_pool(
            settings.gemini_api_keys, settings.gemini_api_key,
            env_hint="RAF_GEMINI_API_KEY(S)",
        )
        self.model = settings.gemini_model
        self._http = http_client or httpx.Client(timeout=settings.ai_request_timeout_seconds)

    def _complete(self, *, messages, system=None, max_tokens=1024, json_mode=False) -> str:
        body: dict = {
            "contents": [
                {
                    "role": "model" if m["role"] == "assistant" else "user",
                    "parts": [{"text": m["content"]}],
                }
                for m in messages
            ],
            "generationConfig": {"maxOutputTokens": max_tokens},
        }
        if system:
            body["systemInstruction"] = {"parts": [{"text": system}]}
        if json_mode:
            body["generationConfig"]["responseMimeType"] = "application/json"
        url = f"{self.base_url}/models/{self.model}:generateContent"

        def send(key: str) -> str:
            resp = self._http.post(url, json=body, headers={"x-goog-api-key": key})
            if resp.status_code >= 400:
                raise ProviderHTTPError(resp.status_code, resp.text[:300])
            data = resp.json()
            try:
                parts = data["candidates"][0]["content"]["parts"]
            except (KeyError, IndexError) as exc:
                raise RuntimeError(f"Gemini returned no content: {str(data)[:300]}") from exc
            return "".join(p.get("text", "") for p in parts)

        return self.pool.call(send)


_PROVIDERS: dict[str, type] = {
    "stub": StubAIProvider,
    "anthropic": AnthropicAIProvider,
    "gemini": GeminiAIProvider,
}
_instances: dict[str, AIProvider] = {}
_instances_lock = threading.Lock()


def get_ai_provider() -> AIProvider:
    """Return the configured provider.

    Real providers are cached process-wide so their key pools remember which
    keys are rate-limited across requests.
    """
    name = settings.ai_provider.lower()
    cls = _PROVIDERS.get(name, StubAIProvider)
    if cls is StubAIProvider:
        return StubAIProvider()
    with _instances_lock:
        if name not in _instances:
            _instances[name] = cls()
        return _instances[name]


def reset_ai_providers() -> None:
    """Drop cached providers (for tests or after changing settings)."""
    with _instances_lock:
        _instances.clear()
