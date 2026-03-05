"""Hint engine — progressive 3-level hints delivered via SSE streaming."""

from __future__ import annotations

from collections.abc import AsyncIterator

from services.llm_client import stream_completion

HINT_LEVELS = {
    1: "nudge",    # Direction without answer
    2: "concept",  # Relevant concept explained
    3: "steps",    # Full step-by-step solution
}

# ── Prompts ───────────────────────────────────────────────────────────────

_LEVEL1_SYSTEM = """\
You are a supportive tutor. A student is stuck on a question.
Give a subtle NUDGE — point them in the right direction WITHOUT revealing the answer.
Keep it to 1-2 sentences. Be encouraging and Socratic.
Think of it like a thought bubble floating above a comic book character.
"""

_LEVEL1_USER_TMPL = """\
The student is stuck on this question. Give a subtle NUDGE — point them
in the right direction without revealing the answer. Keep it to 1-2 sentences.
Think of it like a thought bubble floating above a comic book character.

Question: {question_text}
Concept: {concept_name}
"""

_LEVEL2_SYSTEM = """\
You are a helpful tutor. A student needs more guidance on a question.
Explain the relevant CONCEPT clearly but do NOT solve the question directly.
Give them the knowledge they need to figure it out themselves.
Be clear, educational, and concise (3-5 sentences).
"""

_LEVEL2_USER_TMPL = """\
The student needs more help. Explain the relevant CONCEPT clearly but don't
solve the question directly. Give them the knowledge they need to figure it out.

Question: {question_text}
Concept: {concept_name}
Concept Description: {concept_description}
"""

_LEVEL3_SYSTEM = """\
You are a thorough tutor. The student has requested full help.
Walk through the SOLUTION step-by-step. Be thorough and educational —
explain WHY each step works. Do not hold back — give the complete answer.
"""

_LEVEL3_USER_TMPL = """\
The student has requested full help. Walk through the SOLUTION step-by-step.
Be thorough and educational — explain WHY each step works.

Question: {question_text}
Concept: {concept_name}
Ideal Answer: {ideal_answer}
"""


# ── generate_hint ─────────────────────────────────────────────────────────


async def generate_hint(
    question_text: str,
    concept_name: str,
    concept_description: str,
    ideal_answer: str,
    level: int,
) -> AsyncIterator[str]:
    """Stream a hint for a question at the given level.

    Args:
        question_text: The question the student is stuck on.
        concept_name: Name of the concept being tested.
        concept_description: Description of the concept (used in level 2).
        ideal_answer: The ideal answer (used in level 3).
        level: Hint level — 1 (nudge), 2 (concept), 3 (full walkthrough).

    Yields:
        String deltas from the LLM stream.

    Raises:
        ValueError: If the level is not 1, 2, or 3.
    """
    if level == 1:
        system = _LEVEL1_SYSTEM
        user_msg = _LEVEL1_USER_TMPL.format(
            question_text=question_text,
            concept_name=concept_name,
        )
    elif level == 2:
        system = _LEVEL2_SYSTEM
        user_msg = _LEVEL2_USER_TMPL.format(
            question_text=question_text,
            concept_name=concept_name,
            concept_description=concept_description or concept_name,
        )
    elif level == 3:
        system = _LEVEL3_SYSTEM
        user_msg = _LEVEL3_USER_TMPL.format(
            question_text=question_text,
            concept_name=concept_name,
            ideal_answer=ideal_answer or "(see concept description)",
        )
    else:
        raise ValueError(f"Invalid hint level: {level}. Must be 1, 2, or 3.")

    async for delta in stream_completion(
        messages=[{"role": "user", "content": user_msg}],
        system_prompt=system,
        temperature=0.7,
        max_tokens=512,
    ):
        yield delta
