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

SYSTEM_PROMPT_WITH_CONCEPTS = """\
You are an expert learning designer. Given a learning topic and its concept \
graph, generate 6-8 progressive subgoals that guide a learner from \
foundational understanding to advanced mastery.

Rules:
- Start with basic concepts and terminology
- Progress through intermediate application and analysis
- End with advanced synthesis or evaluation
- Each subgoal should be a concrete, achievable learning objective
- Write concise titles (max 80 chars) and short descriptions (1-2 sentences)
- Each subgoal should map to one concept node from the graph via concept_node_key
- Not every concept node needs a subgoal, but each subgoal must reference one

Respond with JSON: {"subgoals": [{"title": "...", "description": "...", "concept_node_key": "..."}]}
"""


async def generate_subgoals(
    topic_title: str,
    topic_description: str | None = None,
    concept_nodes: list[dict[str, Any]] | None = None,
) -> list[dict[str, str]]:
    """Call GPT to generate 6-8 scaffolded subgoals for the given topic.

    Args:
        topic_title: The learning topic title.
        topic_description: Optional topic description.
        concept_nodes: Optional list of concept node dicts (key, name, description,
            difficulty) from an existing concept graph. When provided, generated
            subgoals will include concept_node_key references.

    Returns:
        List of dicts with 'title', 'description', and optionally 'concept_node_key'.
    """
    user_content = f"Topic: {topic_title}"
    if topic_description:
        user_content += f"\nDescription: {topic_description}"

    if concept_nodes:
        system = SYSTEM_PROMPT_WITH_CONCEPTS
        nodes_summary = "\n".join(
            f"- {n['key']}: {n['name']} ({n.get('difficulty', 'medium')}) — {n.get('description', '')}"
            for n in concept_nodes
        )
        user_content += f"\n\nConcept graph nodes:\n{nodes_summary}"
    else:
        system = SYSTEM_PROMPT

    result: dict[str, Any] = await json_completion(
        messages=[{"role": "user", "content": user_content}],
        system_prompt=system,
        temperature=0.4,
    )

    parsed = result.get("parsed", {})
    subgoals: list[dict[str, str]] = parsed.get("subgoals", [])

    # Validate structure
    validated: list[dict[str, str]] = []
    known_keys = {n["key"] for n in concept_nodes} if concept_nodes else set()

    for sg in subgoals:
        if not isinstance(sg, dict) or "title" not in sg:
            continue
        entry: dict[str, str] = {
            "title": sg["title"],
            "description": sg.get("description", ""),
        }
        # Include concept_node_key only if it references a valid node
        cnk = sg.get("concept_node_key")
        if cnk and cnk in known_keys:
            entry["concept_node_key"] = cnk
        validated.append(entry)

    return validated
