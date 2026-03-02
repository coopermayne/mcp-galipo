"""
AI-powered intake analysis service.

Uses Claude to generate a summary and case quality rating for intake leads.
"""

import json
import logging
from datetime import date

from anthropic import Anthropic

from config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT_TEMPLATE = """Today's date is {today}.

You are an experienced civil rights plaintiff-side attorney. Your firm primarily focuses on excessive force and police misconduct cases, but you also take on other civil rights cases if they are particularly compelling or promising.

You are triaging intake leads. For each lead, provide:
1. A structured markdown summary with the sections below
2. A rating from 1-5 stars on case quality
3. A separate injury severity rating from 1-5
4. Brief reasoning for the rating (2-3 sentences)

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

Rating guide — your rating should reflect how good a fit this case is FOR THIS FIRM specifically:
- 5: Exceptional — clear liability, serious damages, strong facts, and squarely within our wheelhouse (police misconduct, excessive force, civil rights)
- 4: Good — worth pursuing, favorable facts, fits our practice area well
- 3: Moderate — needs investigation, mixed signals, or a civil rights case that's outside our core focus but could be compelling
- 2: Weak — significant challenges, low damages, unclear liability, or largely outside our practice area
- 1: Pass — poor facts, no clear cause of action, trivial matter, or not a civil rights case at all

Cases that are clearly outside civil rights (slip-and-fall, car accidents, contract disputes, family law, etc.) should generally rate 1-2 regardless of the underlying facts, unless there is a civil rights angle.

Credibility and coherence: Pay attention to the tone and coherence of the intake content. If the narrative is disjointed, nonsensical, internally contradictory, or shows signs that the person may not be a reliable narrator, factor that into a lower rating. You don't need to diagnose anything — just note it as a practical concern in Key Considerations and let it weigh on the rating.

Staff notes: If staff notes or team discussion are included, treat those opinions with significant weight. The staff are experienced attorneys and paralegals who have spoken with the potential client directly. If staff express skepticism, flag concerns, or recommend passing, defer to their judgment in your rating. If they're enthusiastic, let that pull the rating up. Their firsthand impressions matter more than what you can glean from text alone.

Injury severity rating (separate from case quality — this is purely about proven, concrete physical injuries):
- 1: None / dignitary only — no physical or emotional injury claimed, just the rights violation itself
- 2: Psychological / emotional / minor medical — PTSD, anxiety, sleep issues, ER visits without lasting physical injury, denied medication, hypertensive episodes that resolved. Anything primarily psychological lands here regardless of how severe the emotional distress is
- 3: Moderate physical — real but recoverable physical injuries: taser burns, pepper spray effects, bruises, scrapes, sprains, minor lacerations, soft tissue injuries
- 4: Serious physical — significant bodily harm: broken bones, strikes to the head, concussion, gunshot wounds, dog bites requiring surgery, deep lacerations, significant scarring
- 5: Catastrophic / death — permanent disability, paralysis, loss of limb or organ function, traumatic brain injury with lasting impairment, or death

This rating is about the physical body. Psychological trauma, ER visits, and medical scares do NOT push the rating above 2 unless there are concrete physical injuries alongside them. A case with four ambulance calls but no broken bones or lasting physical damage is a 2-3, not a 4-5.

Rate based on what's described in the intake. If injuries aren't mentioned, default to 1.

Respond with valid JSON only. The "summary" field must contain the markdown text with the headings above.
{"summary": "### Events at Issue\\n...", "rating": N, "injury_rating": N, "reasoning": "...", "location_short": "City, ST or null"}"""


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

    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(today=date.today().strftime("%B %d, %Y"))

    client = Anthropic(api_key=settings.anthropic_api_key)
    response = client.messages.create(
        model=settings.chat_model_full,
        max_tokens=1000,
        system=system_prompt,
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
    injury_rating = max(1, min(5, int(parsed.get("injury_rating", 1))))
    reasoning = parsed.get("reasoning", "")

    return {
        "ai_summary": parsed.get("summary", ""),
        "ai_rating": rating,
        "ai_injury_rating": injury_rating,
        "ai_rating_reasoning": reasoning,
        "ai_location_short": parsed.get("location_short"),
    }


def run_background_analysis(intake_id: int) -> None:
    """Run the full AI analysis pipeline for a single intake.

    Designed to run in a background thread. Handles the complete lifecycle:
    set_ai_analyzing(True) -> broadcast "analyzing" -> analyze -> save ->
    log comment -> broadcast "analyzed". On failure: reset flag + broadcast "updated".
    """
    import db
    from routes.sse import broadcast

    try:
        db.set_ai_analyzing(intake_id, True)
        broadcast({
            "entity": "intake", "action": "analyzing",
            "id": intake_id, "intake_id": intake_id,
        })

        intake_data = db.get_intake_by_id(intake_id)
        if not intake_data:
            logger.warning("Intake %d not found for analysis", intake_id)
            return

        comments = db.get_intake_comments(intake_id)
        result = analyze_intake(
            intake_data,
            notes=intake_data.get("notes", ""),
            comments=comments,
        )

        db.save_ai_analysis(
            intake_id,
            result["ai_summary"],
            result["ai_rating"],
            result["ai_rating_reasoning"],
            result.get("ai_location_short"),
            result.get("ai_injury_rating"),
        )

        is_regen = intake_data.get("ai_summary") is not None
        rating = result["ai_rating"]
        label = "regenerated" if is_regen else "completed"
        db.add_intake_comment(
            intake_id, None,
            f"AI analysis {label} \u2014 rated {rating}/5",
            True,
            {"type": "ai_analysis", "rating": rating, "reasoning": result["ai_rating_reasoning"], "is_regeneration": is_regen},
        )

        broadcast({
            "entity": "intake", "action": "analyzed",
            "id": intake_id, "intake_id": intake_id,
        })
    except Exception:
        logger.exception("Background AI analysis failed for intake %d", intake_id)
        try:
            db.set_ai_analyzing(intake_id, False)
            broadcast({
                "entity": "intake", "action": "updated",
                "id": intake_id, "intake_id": intake_id,
            })
        except Exception:
            logger.exception("Failed to reset ai_analyzing for intake %d", intake_id)
