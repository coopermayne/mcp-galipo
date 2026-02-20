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
1. A structured markdown summary with the sections below
2. A rating from 1-5 stars on case quality
3. Brief reasoning for the rating (2-3 sentences)

The summary MUST use this markdown format with these exact headings:

### Events at Issue
Brief description of what happened — the key facts and sequence of events.

### Injuries
Physical and/or emotional injuries described by the potential client.

### Potential Claims
A simple list of likely legal theories. Just name them — do NOT cite case law, statutes, or legal standards. Example: "Excessive force, wrongful death, battery" — not "§ 1983 excessive force (Whitley v. Albers standard)".

### Key Considerations
Notable strengths, weaknesses, red flags, or things that need investigation. Keep this practical.

Keep each section to 1-3 sentences. Be direct and factual — no filler. If information for a section is missing from the intake, write "Not provided" for that section.

Rating guide:
- 5: Exceptional — clear liability, serious damages, strong facts
- 4: Good — worth pursuing, favorable facts
- 3: Moderate — needs investigation, mixed signals
- 2: Weak — significant challenges, low damages or unclear liability
- 1: Pass — poor facts, no clear cause of action, or trivial matter

Respond with valid JSON only. The "summary" field must contain the markdown text with the headings above.
{"summary": "### Events at Issue\\n...", "rating": N, "reasoning": "..."}"""


def analyze_intake(intake_data: dict, notes: str = "", comments: list[dict] | None = None) -> dict:
    """Analyze a single intake and return AI summary, rating, and reasoning.

    Args:
        intake_data: Dict with intake fields (name, case_type, incident_description, etc.)
        notes: Internal staff notes about the intake
        comments: List of comment dicts with 'content', 'user_first_name', 'is_system' fields

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

    if notes:
        parts.append(f"\nStaff Notes: {notes}")

    if comments:
        non_system = [c for c in comments if not c.get("is_system")]
        if non_system:
            parts.append("\nTeam Discussion:")
            for c in non_system:
                author = c.get("user_first_name", "Unknown")
                parts.append(f"  {author}: {c['content']}")

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
        max_tokens=1000,
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

    return {
        "ai_summary": parsed.get("summary", ""),
        "ai_rating": rating,
        "ai_rating_reasoning": reasoning,
    }
