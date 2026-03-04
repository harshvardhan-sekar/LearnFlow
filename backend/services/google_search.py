"""Google Custom Search service — wraps the JSON API via httpx."""

import logging
from typing import TypedDict

import httpx

from utils.config import settings

logger = logging.getLogger(__name__)

_BASE_URL = "https://www.googleapis.com/customsearch/v1"


class SearchResult(TypedDict):
    title: str
    link: str
    snippet: str
    position: int


async def search(query: str, num_results: int = 10) -> list[SearchResult]:
    """Call Google Custom Search JSON API and return structured results.

    Args:
        query: The search query string.
        num_results: Number of results to request (1-10, API max per page).

    Returns:
        List of search result dicts with title, link, snippet, position.

    Raises:
        httpx.HTTPStatusError: On 4xx/5xx responses from Google.
        ValueError: If API keys are not configured.
    """
    if not settings.GOOGLE_SEARCH_API_KEY or not settings.GOOGLE_SEARCH_CX:
        raise ValueError("Google Search API key or CX not configured")

    num_results = max(1, min(num_results, 10))

    params = {
        "key": settings.GOOGLE_SEARCH_API_KEY,
        "cx": settings.GOOGLE_SEARCH_CX,
        "q": query,
        "num": num_results,
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(_BASE_URL, params=params)

        if resp.status_code == 429:
            logger.warning("Google Search rate limit hit for query: %s", query)
            raise httpx.HTTPStatusError(
                "Rate limit exceeded", request=resp.request, response=resp
            )

        resp.raise_for_status()

    data = resp.json()
    items = data.get("items", [])

    results: list[SearchResult] = [
        {
            "title": item.get("title", ""),
            "link": item.get("link", ""),
            "snippet": item.get("snippet", ""),
            "position": idx + 1,
        }
        for idx, item in enumerate(items)
    ]

    return results
