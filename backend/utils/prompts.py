"""Dynamic system prompt builders for the chat AI."""

from __future__ import annotations

from typing import Any


def _format_mastery_block(mastery_states: list[dict[str, Any]]) -> str:
    """Format mastery states into a readable block for the system prompt."""
    if not mastery_states:
        return "  (no mastery data yet — treat all concepts as new)"

    lines = []
    for state in mastery_states:
        score = state.get("mastery", state.get("mastery_score", 0.0))
        name = state.get("concept_name", state.get("concept_key", "unknown"))
        if score < 0.3:
            level = "LOW"
        elif score < 0.7:
            level = "MEDIUM"
        else:
            level = "HIGH"
        lines.append(f"  - {name}: {score:.2f} [{level}]")

    return "\n".join(lines)


def build_chat_system_prompt(
    topic: str,
    subgoals: list[dict[str, Any]],
    mastery_states: list[dict[str, Any]] | None = None,
) -> str:
    """Build the chat system prompt with topic context, subgoal progress, and mastery.

    Args:
        topic: The learning topic title.
        subgoals: List of subgoal dicts with keys: title, is_completed, sort_order.
        mastery_states: Optional list of mastery dicts with keys: concept_name (or
            concept_key), mastery (or mastery_score). When provided, the prompt
            instructs the AI to adapt explanation depth per mastery level.
    """
    # Format subgoal list with completion status
    subgoal_lines = []
    for sg in sorted(subgoals, key=lambda s: s.get("sort_order", 0)):
        status = "COMPLETED" if sg.get("is_completed") else "in progress"
        subgoal_lines.append(f"  - [{status}] {sg['title']}")

    subgoal_block = "\n".join(subgoal_lines) if subgoal_lines else "  (no subgoals set)"

    mastery_block = _format_mastery_block(mastery_states or [])

    return f"""\
You are a Socratic learning tutor helping a student study: **{topic}**

## The student's learning subgoals:
{subgoal_block}

## Student's current concept mastery:
{mastery_block}

Use mastery levels to calibrate your explanations:
- **LOW mastery (<0.3):** Explain fundamentals, use simple language and concrete \
examples, avoid assumed prior knowledge.
- **MEDIUM mastery (0.3–0.7):** Challenge with deeper questions, introduce nuance \
and edge cases, ask the student to make connections between concepts.
- **HIGH mastery (>0.7):** Connect to advanced topics, explore exceptions and \
real-world complexity, encourage the student to explain things back to you.

## Your role:
- Guide the student toward understanding — never just give away the answer.
- Ask probing, clarifying questions that nudge the student to think deeper.
- When the student is stuck, provide scaffolded hints: start with a gentle nudge, \
then offer more detail if they remain stuck.
- Reference the student's subgoals when relevant: \
"This connects to your subgoal on …" to keep them oriented.
- If a question is better answered by authoritative sources (textbooks, documentation, \
primary research), suggest the student try a web search for that specific topic.
- Celebrate progress — when the student demonstrates understanding, acknowledge it.

## Tone:
- Encouraging but intellectually honest.
- Use clear, concise language — avoid walls of text.
- Match the student's vocabulary level: if they use technical terms correctly, \
respond in kind; if they seem unsure, simplify.

## Boundaries:
- Stay on-topic: redirect gently if the student drifts far from **{topic}**.
- Do not fabricate sources, citations, or data. If unsure, say so.\
"""
