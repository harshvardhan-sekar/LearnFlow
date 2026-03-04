"""Web search service using Serper API (serper.dev)."""

from __future__ import annotations

from typing import TypedDict

import httpx

from utils.config import settings

SERPER_URL = "https://google.serper.dev/search"


class SearchResult(TypedDict):
    title: str
    link: str
    snippet: str
    position: int


async def search(query: str, num_results: int = 10) -> list[SearchResult]:
    """Call the Serper search API and return normalised results.

    Args:
        query: The search query string.
        num_results: Number of results to request.

    Returns:
        List of search result dicts with title, link, snippet, position.

    Raises:
        ValueError: If SERPER_API_KEY is not configured.
        httpx.HTTPStatusError: On 4xx/5xx responses (including 429 rate limit).
    """
    if not settings.SERPER_API_KEY:
        raise ValueError("SERPER_API_KEY is not configured")

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            SERPER_URL,
            headers={"X-API-KEY": settings.SERPER_API_KEY},
            json={"q": query, "num": num_results},
        )
        resp.raise_for_status()

    data = resp.json()
    organic = data.get("organic", [])

    return [
        {
            "title": item.get("title", ""),
            "link": item.get("link", ""),
            "snippet": item.get("snippet", ""),
            "position": item.get("position", idx + 1),
        }
        for idx, item in enumerate(organic)
    ]
