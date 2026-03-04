"""Unified LLM client wrapper using OpenRouter (OpenAI SDK compatible)."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

import openai

from utils.config import settings

_client: openai.AsyncOpenAI | None = None


def _get_client() -> openai.AsyncOpenAI:
    global _client
    if _client is None:
        if not settings.OPENROUTER_API_KEY:
            raise RuntimeError("OPENROUTER_API_KEY is not configured")
        _client = openai.AsyncOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=settings.OPENROUTER_API_KEY,
        )
    return _client


DEFAULT_MODEL = "openai/gpt-4o"


async def chat_completion(
    messages: list[dict[str, str]],
    system_prompt: str | None = None,
    model: str = DEFAULT_MODEL,
    temperature: float = 0.7,
) -> dict[str, Any]:
    """Non-streaming chat completion. Returns the full response message and usage."""
    full_messages = _build_messages(system_prompt, messages)
    client = _get_client()

    response = await client.chat.completions.create(
        model=model,
        messages=full_messages,
        temperature=temperature,
    )

    choice = response.choices[0]
    return {
        "content": choice.message.content or "",
        "tokens_used": response.usage.total_tokens if response.usage else None,
    }


async def stream_completion(
    messages: list[dict[str, str]],
    system_prompt: str | None = None,
    model: str = DEFAULT_MODEL,
    temperature: float = 0.7,
) -> AsyncIterator[str]:
    """Streaming chat completion. Yields content deltas as strings."""
    full_messages = _build_messages(system_prompt, messages)
    client = _get_client()

    stream = await client.chat.completions.create(
        model=model,
        messages=full_messages,
        temperature=temperature,
        stream=True,
        stream_options={"include_usage": True},
    )

    async for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content
        # Final chunk with usage stats
        if chunk.usage:
            yield f"\n__USAGE__{json.dumps({'total_tokens': chunk.usage.total_tokens})}"


async def json_completion(
    messages: list[dict[str, str]],
    system_prompt: str | None = None,
    model: str = DEFAULT_MODEL,
    temperature: float = 0.3,
) -> dict[str, Any]:
    """Chat completion with JSON response format for structured output."""
    full_messages = _build_messages(system_prompt, messages)
    client = _get_client()

    response = await client.chat.completions.create(
        model=model,
        messages=full_messages,
        temperature=temperature,
        response_format={"type": "json_object"},
    )

    choice = response.choices[0]
    content = choice.message.content or "{}"
    return {
        "parsed": json.loads(content),
        "tokens_used": response.usage.total_tokens if response.usage else None,
    }


def _build_messages(
    system_prompt: str | None, messages: list[dict[str, str]]
) -> list[dict[str, str]]:
    """Prepend system message if provided."""
    if system_prompt:
        return [{"role": "system", "content": system_prompt}, *messages]
    return list(messages)
