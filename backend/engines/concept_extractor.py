"""Concept graph extraction engine.

Decomposes a learning topic into a structured concept graph using GPT.
Generates 8-15 concept nodes with keys, descriptions, difficulty levels,
prerequisites, and sort ordering.
"""

from __future__ import annotations

import logging
from collections import defaultdict, deque
from typing import Any

from pydantic import BaseModel

from services.llm_client import json_completion

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are a curriculum designer. Given a learning topic, decompose it into \
a concept graph with 8-15 concept nodes. Each node should have:
- key: dot-notation path (e.g., "topic.subtopic.skill")
- name: human-readable name
- description: 1-2 sentence explanation
- difficulty: easy/medium/hard
- prerequisites: array of concept keys this concept depends on
- sort_order: suggested learning order (0 = first)

Rules:
- Start with foundational definitions (easy, no prerequisites)
- Build up through intermediate concepts that depend on earlier ones
- End with advanced synthesis topics
- Prerequisites must only reference keys defined in the same graph
- Use clear, hierarchical dot-notation keys

Respond with valid JSON: {"topic": "...", "nodes": [...]}
"""


class ConceptNodeData(BaseModel):
    """Pydantic model for a single concept node from GPT output."""

    key: str
    name: str
    description: str
    difficulty: str = "medium"
    prerequisites: list[str] = []
    sort_order: int = 0


class ConceptGraphData(BaseModel):
    """Pydantic model for the full concept graph from GPT output."""

    topic: str
    nodes: list[ConceptNodeData]


def _break_cycles(nodes: list[ConceptNodeData]) -> None:
    """Detect and break cycles in the prerequisite graph using Kahn's algorithm.

    If a cycle is detected, the back-edge prerequisite is removed from the node
    with the higher sort_order. Mutates nodes in place.
    """
    node_by_key = {n.key: n for n in nodes}
    keys = set(node_by_key.keys())

    # Build adjacency list: edge from prereq → dependent (prereq must come first)
    in_degree: dict[str, int] = defaultdict(int)
    dependents: dict[str, list[str]] = defaultdict(list)
    for key in keys:
        in_degree.setdefault(key, 0)
    for node in nodes:
        for prereq in node.prerequisites:
            dependents[prereq].append(node.key)
            in_degree[node.key] += 1

    # Kahn's algorithm — iteratively remove nodes with in_degree 0
    queue: deque[str] = deque(k for k, d in in_degree.items() if d == 0)
    visited: set[str] = set()

    while queue:
        key = queue.popleft()
        visited.add(key)
        for dep in dependents[key]:
            in_degree[dep] -= 1
            if in_degree[dep] == 0:
                queue.append(dep)

    # Any nodes not visited are part of a cycle
    cycle_keys = keys - visited
    if not cycle_keys:
        return

    logger.warning(
        "Cycle detected in concept graph among nodes: %s — breaking back-edges",
        cycle_keys,
    )

    # Break cycles: for each node in a cycle, remove prerequisite edges that point
    # to other cycle members, preferring to remove from the node with higher sort_order
    cycle_nodes = sorted(
        [node_by_key[k] for k in cycle_keys],
        key=lambda n: n.sort_order,
        reverse=True,  # start removing from highest sort_order
    )
    for node in cycle_nodes:
        cycle_prereqs = [p for p in node.prerequisites if p in cycle_keys]
        if cycle_prereqs:
            for p in cycle_prereqs:
                node.prerequisites.remove(p)
                logger.warning(
                    "Removed back-edge: %s -> %s", p, node.key
                )
            # Re-check if cycle is resolved
            cycle_keys_remaining = _find_cycle_keys(
                [node_by_key[k] for k in cycle_keys]
            )
            if not cycle_keys_remaining:
                return


def _find_cycle_keys(nodes: list[ConceptNodeData]) -> set[str]:
    """Return the set of keys involved in cycles (via Kahn's)."""
    keys = {n.key for n in nodes}
    in_degree: dict[str, int] = {k: 0 for k in keys}
    dependents: dict[str, list[str]] = defaultdict(list)
    for node in nodes:
        for prereq in node.prerequisites:
            if prereq in keys:
                dependents[prereq].append(node.key)
                in_degree[node.key] += 1

    queue: deque[str] = deque(k for k, d in in_degree.items() if d == 0)
    visited: set[str] = set()
    while queue:
        key = queue.popleft()
        visited.add(key)
        for dep in dependents[key]:
            in_degree[dep] -= 1
            if in_degree[dep] == 0:
                queue.append(dep)

    return keys - visited


async def extract_concept_graph(
    topic_title: str,
    topic_description: str | None = None,
) -> ConceptGraphData:
    """Call GPT to decompose a topic into a concept graph with 8-15 nodes.

    Args:
        topic_title: The learning topic title (e.g., "Binary Trees").
        topic_description: Optional description for more context.

    Returns:
        ConceptGraphData with topic name and list of ConceptNodeData nodes.

    Raises:
        ValueError: If GPT returns an unparseable or empty response.
    """
    user_content = f"Topic: {topic_title}"
    if topic_description:
        user_content += f"\nDescription: {topic_description}"

    result: dict[str, Any] = await json_completion(
        messages=[{"role": "user", "content": user_content}],
        system_prompt=SYSTEM_PROMPT,
        temperature=0.3,
        max_tokens=3000,
    )

    parsed = result.get("parsed", {})

    # Validate with Pydantic
    nodes_raw: list[dict[str, Any]] = parsed.get("nodes", [])
    if not nodes_raw:
        raise ValueError("GPT returned no concept nodes")

    # Normalise each node and collect valid ones
    valid_nodes: list[ConceptNodeData] = []
    for node in nodes_raw:
        if not isinstance(node, dict) or "key" not in node or "name" not in node:
            continue
        # Clamp difficulty to allowed values
        difficulty = node.get("difficulty", "medium")
        if difficulty not in ("easy", "medium", "hard"):
            difficulty = "medium"
        valid_nodes.append(
            ConceptNodeData(
                key=node["key"],
                name=node["name"],
                description=node.get("description", ""),
                difficulty=difficulty,
                prerequisites=node.get("prerequisites", []),
                sort_order=node.get("sort_order", 0),
            )
        )

    if not valid_nodes:
        raise ValueError("GPT returned no valid concept nodes")

    # Validate prerequisite references — strip any that reference unknown keys
    known_keys = {n.key for n in valid_nodes}
    for node in valid_nodes:
        node.prerequisites = [p for p in node.prerequisites if p in known_keys]

    # DAG cycle detection — break cycles so downstream engines can assume a valid DAG
    _break_cycles(valid_nodes)

    return ConceptGraphData(
        topic=parsed.get("topic", topic_title),
        nodes=valid_nodes,
    )
