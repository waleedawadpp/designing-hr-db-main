"""AI provider abstraction for the RAF AI layer.

The default ``StubAIProvider`` is deterministic and offline so the API and its
tests run without external calls. Set ``RAF_AI_PROVIDER=anthropic`` (plus
``RAF_ANTHROPIC_API_KEY``) to swap in a real Claude-backed implementation.

The router persists every generation to ``ai_job`` and chats to
``ai_chat_session`` / ``ai_chat_message``; providers here are pure transforms.
"""

from __future__ import annotations

import re
from typing import Protocol

from app.config import settings

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


class AnthropicAIProvider:
    """Claude-backed provider. Used only when RAF_AI_PROVIDER=anthropic.

    Kept thin and lazy so the dependency/key are required only if selected.
    """

    def __init__(self) -> None:
        if not settings.anthropic_api_key:
            raise RuntimeError("RAF_ANTHROPIC_API_KEY is required for the anthropic provider")
        self.model = settings.ai_model
        # Imported lazily to avoid a hard dependency for stub deployments.
        from anthropic import Anthropic  # type: ignore

        self._client = Anthropic(api_key=settings.anthropic_api_key)

    def generate_product_content(self, *, name_hint, category, details) -> dict:  # pragma: no cover
        import json

        prompt = (
            "You write e-commerce product copy for an Arabic-first GCC marketplace. "
            "Return STRICT JSON with keys: title_ar, title_en, description_ar, "
            "description_en, tags (array), seo_title, seo_description.\n"
            f"name_hint={name_hint!r} category={category!r} details={details!r}"
        )
        msg = self._client.messages.create(
            model=self.model, max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        return json.loads(msg.content[0].text)

    def assistant_reply(self, history, suggestions) -> str:  # pragma: no cover
        sys = (
            "You are RAF's bilingual (Arabic/English) shopping assistant. "
            "Be concise and helpful. Suggested products: "
            + ", ".join(s["name_en"] for s in suggestions)
        )
        msg = self._client.messages.create(
            model=self.model, max_tokens=512, system=sys,
            messages=[{"role": m["role"], "content": m["content"]} for m in history],
        )
        return msg.content[0].text

    def process_image(self, *, image_url, operation) -> dict:  # pragma: no cover
        # A real implementation would call an image model / pipeline here.
        if operation not in _IMAGE_OPERATIONS:
            raise ValueError(f"Unsupported operation: {operation}")
        return {"operation": operation, "processed_url": image_url}


def get_ai_provider() -> AIProvider:
    if settings.ai_provider == "anthropic":
        return AnthropicAIProvider()
    return StubAIProvider()
