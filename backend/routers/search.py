"""Search router — web search and click tracking."""

import time

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db
from models.event import SearchClickEvent, SearchEvent
from models.user import User
from services import web_search
from utils.dependencies import get_current_user

router = APIRouter(prefix="/api/search", tags=["search"])


# ── Schemas ──────────────────────────────────────────────────────────────

class SearchRequest(BaseModel):
    query: str
    session_id: int


class SearchResultItem(BaseModel):
    title: str
    link: str
    snippet: str
    position: int


class SearchResponse(BaseModel):
    results: list[SearchResultItem]
    search_event_id: int
    results_count: int
    response_time_ms: int


class ClickRequest(BaseModel):
    search_event_id: int
    url: str
    title: str
    position: int


class ClickResponse(BaseModel):
    id: int
    search_event_id: int

    model_config = {"from_attributes": True}


# ── Routes ───────────────────────────────────────────────────────────────

@router.post("", response_model=SearchResponse)
async def search(
    body: SearchRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Execute a web search via Serper and log the event."""
    start = time.perf_counter()

    try:
        results = await web_search.search(body.query)
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 429:
            raise HTTPException(status_code=429, detail="Search rate limit exceeded")
        raise HTTPException(status_code=502, detail="Search API error")

    elapsed_ms = int((time.perf_counter() - start) * 1000)

    # Log to search_events
    event = SearchEvent(
        session_id=body.session_id,
        user_id=user.id,
        query=body.query,
        results_count=len(results),
        response_time_ms=elapsed_ms,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)

    return SearchResponse(
        results=results,
        search_event_id=event.id,
        results_count=len(results),
        response_time_ms=elapsed_ms,
    )


@router.post("/click", response_model=ClickResponse)
async def log_click(
    body: ClickRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Log a search result click event."""
    click = SearchClickEvent(
        search_event_id=body.search_event_id,
        user_id=user.id,
        result_url=body.url,
        result_title=body.title,
        result_position=body.position,
    )
    db.add(click)
    await db.commit()
    await db.refresh(click)

    return click
