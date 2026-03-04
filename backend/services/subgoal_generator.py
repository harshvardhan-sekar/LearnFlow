"""Generate scaffolded subgoals for a learning topic using GPT."""

from __future__ import annotations

from typing import Any

from services.llm_client import json_completion

SYSTEM_PROMPT = """\
You are an expert learning designer. Given a learning topic, generate 6-8 \
progressive subgoals that guide a learner from foundational understanding to \
advanced mastery.

Rules:
- Start with basic concepts and terminology
- Progress through intermediate application and analysis
- End with advanced synthesis or evaluation
- Each subgoal should be a concrete, achievable learning objective
- Write concise titles (max 80 chars) and short descriptions (1-2 sentences)

Respond with JSON: {"subgoals": [{"title": "...", "description": "..."}]}
"""


async def generate_subgoals(
    topic_title: str,
    topic_description: str | None = None,
) -> list[dict[str, str]]:
    """Call GPT to generate 6-8 scaffolded subgoals for the given topic.

    Returns a list of dicts with 'title' and 'description' keys.
    """
    user_content = f"Topic: {topic_title}"
    if topic_description:
        user_content += f"\nDescription: {topic_description}"

    result: dict[str, Any] = await json_completion(
        messages=[{"role": "user", "content": user_content}],
        system_prompt=SYSTEM_PROMPT,
        temperature=0.4,
    )

    parsed = result.get("parsed", {})
    subgoals: list[dict[str, str]] = parsed.get("subgoals", [])

    # Validate structure
    return [
        {"title": sg["title"], "description": sg.get("description", "")}
        for sg in subgoals
        if isinstance(sg, dict) and "title" in sg
    ]
