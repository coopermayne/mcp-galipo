"""
AI-powered intake analysis service.

Uses Claude to generate a summary and case quality rating for intake leads.
"""

import json
import logging
from anthropic import Anthropic
from config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an experienced civil rights plaintiff-side attorney. Your firm primarily focuses on excessive force and police misconduct cases, but you also take on other civil rights cases if they are particularly compelling or promising.

You are triaging intake leads. For each lead, provide:
1. A concise summary (1-2 sentences) of what happened
2. A rating from 1-5 stars on case quality
3. Brief reasoning for the rating (max 90 words)

Rating guide:
- 5: Exceptional — clear liability, serious damages, strong facts
- 4: Good — worth pursuing, favorable facts
- 3: Moderate — needs investigation, mixed signals
- 2: Weak — significant challenges, low damages or unclear liability
- 1: Pass — poor facts, no clear cause of action, or trivial matter

Respond with valid JSON only, no markdown:
{"summary": "...", "rating": N, "reasoning": "..."}"""


def analyze_intake(intake_data: dict) -> dict:
    """Analyze a single intake and return AI summary, rating, and reasoning.

    Args:
        intake_data: Dict with intake fields (name, case_type, incident_description, etc.)

    Returns:
        {"ai_summary": str, "ai_rating": int, "ai_rating_reasoning": str}
    """
    if not settings.anthropic_api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not configured")

    # Build the intake description for the AI
    parts = []
    if intake_data.get("name"):
        parts.append(f"Name: {intake_data['name']}")
    if intake_data.get("case_type"):
        parts.append(f"Case Type: {intake_data['case_type']}")
    if intake_data.get("incident_date"):
        parts.append(f"Incident Date: {intake_data['incident_date']}")
    if intake_data.get("location"):
        parts.append(f"Location: {intake_data['location']}")
    if intake_data.get("incident_description"):
        parts.append(f"Incident Description: {intake_data['incident_description']}")
    if intake_data.get("injury_description"):
        parts.append(f"Injury Description: {intake_data['injury_description']}")

    if not parts:
        return {
            "ai_summary": "Insufficient information to analyze.",
            "ai_rating": 1,
            "ai_rating_reasoning": "No case details provided in intake form.",
        }

    user_message = "\n".join(parts)

    client = Anthropic(api_key=settings.anthropic_api_key)
    response = client.messages.create(
        model=settings.chat_model_full,
        max_tokens=300,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    text = response.content[0].text.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

    parsed = json.loads(text)

    rating = max(1, min(5, int(parsed.get("rating", 1))))
    reasoning = parsed.get("reasoning", "")
    # Enforce 90 word limit
    words = reasoning.split()
    if len(words) > 90:
        reasoning = " ".join(words[:90]) + "..."

    return {
        "ai_summary": parsed.get("summary", ""),
        "ai_rating": rating,
        "ai_rating_reasoning": reasoning,
    }
