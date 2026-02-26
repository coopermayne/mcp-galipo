"""
Interaction summarization service.

Uses Claude to generate brief summaries of logged emails and phone calls,
focused on what's NEW and any action items.
"""

import os
from typing import Optional

from anthropic import Anthropic


SYSTEM_PROMPT = """You are a legal assistant summarizing a logged interaction for a personal injury intake.

Write a 1-2 sentence summary focused on:
1. What's GENUINELY NEW — information not already known from the case context below
2. Any action items or next steps

Be extremely concise. Use past tense. Do not repeat the interaction type or direction — that context is already shown in the UI. Do not repeat information that's already captured in the case context."""

SYSTEM_PROMPT_NO_CONTEXT = """You are a legal assistant summarizing a logged interaction for a personal injury intake.

Write a 1-2 sentence summary focused on:
1. What's NEW (new information, updates, decisions)
2. Any action items or next steps

Be concise and professional. Use past tense. Do not repeat the interaction type or direction — that context is already shown in the UI."""


def summarize_interaction(
    content: str,
    interaction_type: str,
    direction: Optional[str] = None,
    intake_context: Optional[dict] = None,
) -> str:
    """
    Generate a brief AI summary of a logged interaction.

    Args:
        content: The full text of the email or phone call notes.
        interaction_type: "email" or "phone"
        direction: "inbound" or "outbound", or None
        intake_context: Dict of intake fields for context (case_type, incident_description, etc.)

    Returns:
        A 1-2 sentence summary string.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY environment variable is required")

    from config import settings

    client = Anthropic(api_key=api_key)

    # Build context block if we have intake data
    context_block = ""
    if intake_context:
        parts = []
        for key in ("case_type", "incident_description", "injury_description", "ai_summary", "notes"):
            val = intake_context.get(key)
            if val and str(val).strip():
                label = key.replace("_", " ").title()
                parts.append(f"- {label}: {val.strip()}")
        if parts:
            context_block = "What's already known about this case:\n" + "\n".join(parts) + "\n\n"

    system = SYSTEM_PROMPT if context_block else SYSTEM_PROMPT_NO_CONTEXT

    direction_label = f" ({direction})" if direction else ""
    user_msg = f"{context_block}Summarize this {interaction_type}{direction_label}:\n\n{content}"

    message = client.messages.create(
        model=settings.extraction_model,
        max_tokens=256,
        system=system,
        messages=[{"role": "user", "content": user_msg}],
    )

    return message.content[0].text.strip()
