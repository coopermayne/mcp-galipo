"""
Chat mode configurations.

Defines tool allowlists and system prompt additions for each chat mode,
enabling focused interactions that are faster, cheaper, and more accurate.
"""

from typing import Any

# Mode configurations
# - tools: list of allowed tool names (empty list = all tools)
# - system_prompt_addition: extra context for the mode
CHAT_MODES: dict[str, dict[str, Any]] = {
    "tasks": {
        "tools": [
            "search",
            "get_details",
            "manage_task",
        ],
        "system_prompt_addition": """You are in TASKS mode - help the user add and manage tasks.

When the user wants to add tasks:
1. If they give you enough info (description, and optionally due date/priority), create the task(s) immediately
2. If info is missing, ask brief clarifying questions (e.g., "When is this due?" or "What priority - low, medium, high, or urgent?")
3. After creating, briefly confirm what was added

IMPORTANT: If the user provides MULTIPLE tasks in a single message, create ALL of them by calling manage_task for EACH one in a SINGLE response (parallel tool calls). Do not ask for confirmation - just create them all at once.

Common task patterns:
- "Follow up with client" → ask about due date
- "File MSJ by Friday" → create with due date this Friday
- "Urgent: respond to discovery" → create with urgent priority

Keep responses brief and action-oriented.""",
    },
    "events": {
        "tools": [
            "search",
            "get_details",
            "manage_event",
        ],
        "system_prompt_addition": """You are in EVENTS mode - help the user add and manage calendar events.

When the user wants to add events:
1. If they give you enough info (description and date), create the event(s) immediately
2. If info is missing, ask brief clarifying questions (e.g., "What date?" or "What time?")
3. After creating, briefly confirm what was added

IMPORTANT: If the user provides MULTIPLE events in a single message, create ALL of them by calling manage_event for EACH one in a SINGLE response (parallel tool calls). Do not ask for confirmation - just create them all at once.

Common event patterns:
- "MSJ on Friday" → Motion for Summary Judgment hearing this Friday
- "Depo next Tuesday at 10am" → Deposition on Tuesday at 10:00 AM
- "Mediation March 15" → Mediation on March 15

Keep responses brief and action-oriented.""",
    },
    "tasks_events": {
        "tools": [
            "search",
            "get_details",
            "manage_task",
            "manage_event",
        ],
        "system_prompt_addition": """You are in TASKS & EVENTS mode - help the user add and manage both tasks and calendar events.

Use this heuristic to decide which to create:
- EVENTS have a specific date/time (hearings, depositions, mediations, deadlines with a calendar date)
- TASKS are action items without a fixed calendar slot (follow ups, filings to prepare, calls to make)
- When in doubt, ask the user

When the user wants to add items:
1. If they give you enough info, create immediately using the right tool (manage_task or manage_event)
2. If info is missing, ask brief clarifying questions
3. After creating, briefly confirm what was added

IMPORTANT: If the user provides MULTIPLE items in a single message, create ALL of them by calling the appropriate tool for EACH one in a SINGLE response (parallel tool calls). Do not ask for confirmation - just create them all at once.

Keep responses brief and action-oriented.""",
    },
    "people": {
        "tools": [
            "search",
            "get_details",
            "manage_person",
            "manage_case_role",
        ],
        "system_prompt_addition": """You are in PEOPLE mode - help the user add and manage case participants.

When the user wants to add a person to a case, use manage_person with case_id and role to create AND assign in ONE call. Do NOT call manage_case_role separately.

Example: manage_person(action="create", name="Dr. Smith", case_id=14, role="plaintiff_expert")

Available roles (use snake_case names):
- Client side: plaintiff, contact, guardian_ad_litem, decedent
- Counsel: co_counsel, referring_attorney, opposing_counsel, criminal_defense_attorney, prosecutor, public_defender
- Defendants: individual_defendant, municipality_defendant
- Experts: plaintiff_expert, defense_expert
- Other: mediator, lien_holder, witness, claims_adjuster, special_needs_consultant

IMPORTANT: If the user provides MULTIPLE people, create ALL of them with parallel manage_person calls in a SINGLE response.

If the user mentions enough info (name + role), create immediately. Only ask clarifying questions if the role is truly ambiguous.

Keep responses brief and action-oriented.""",
    },
    "overview": {
        "tools": [
            "search",
            "get_details",
        ],
        "system_prompt_addition": """You are in OVERVIEW mode. Provide high-level insights and summaries:
- Case status and progress
- Upcoming deadlines and priorities
- Recent activity summaries
- Cross-case analytics

This is a read-only mode - do not create, update, or delete data.""",
    },
    "proceedings": {
        "tools": [
            "search",
            "get_details",
            "manage_proceeding",
            "list_jurisdictions",
        ],
        "system_prompt_addition": """You are in PROCEEDINGS mode - help the user manage court proceedings and assign judges.

IMPORTANT: Do NOT create new judges or jurisdictions. Only match to existing records.

When the user wants to add a proceeding:
1. Use list_jurisdictions to find the right jurisdiction_id. If no match, tell the user the jurisdiction needs to be added manually and create the proceeding without one.
2. Create the proceeding with manage_proceeding(action="create").
3. Search for the judge: search(entity="judges", query="judge name")
4. If found → manage_proceeding(action="add_judge", proceeding_id=X, judge_id=Y)
5. If NOT found → tell the user the judge wasn't found in the system and needs to be added manually. Suggest close matches if the search returned similar names (the user may have misspelled it).

When the user mentions a judge:
1. Search: search(entity="judges", query="name")
2. If found → assign to the proceeding
3. If NOT found → inform the user. Do NOT create a new judge. Suggest they add the judge manually through the UI.

Keep responses brief and action-oriented.""",
    },
    "intakes": {
        "tools": [
            "manage_intake",
        ],
        "system_prompt_addition": """You are in INTAKES mode - help the user create new intakes from unstructured text.

The user will paste raw text like voicemail transcripts, emails, or handwritten notes. Your job:
1. Parse the text and extract any available fields: name, phone, email, case type, incident date/time, location, incident description, injury description
2. Identify THREE distinct roles that may appear in the text:

   a) INJURED PERSON — the person who was hurt. Their name goes in `name` (this becomes the case title).
   b) DIRECT CONTACT — the person we can call/email. Often the injured person themselves, but sometimes a family member or friend reaching out on their behalf.
      - `email` and `phone` = the direct contact's info (whoever we can actually reach)
      - `contact_relationship` = their relationship to the injured person (e.g. "brother", "mother", "spouse"). Omit if the contact IS the injured person.
   c) REFERRAL SOURCE — a professional (attorney, doctor) who referred the case to our firm.
      - `referral_name`, `referral_org`, `referral_email`, `referral_phone`

   These are separate! A referral attorney is NOT the direct contact. If a brother calls in about his sister's injury after being referred by an attorney:
   - name = sister (injured person)
   - email/phone = brother's contact info (NOT the attorney's)
   - contact_relationship = "brother"
   - referral_name/org/email/phone = the referring attorney's info

   CRITICAL — DO NOT MIX UP CONTACT INFO BETWEEN ROLES:
   - `phone` and `email` are ONLY for the direct contact (the person we'd call to discuss the case — the injured person or their family/friend).
   - `referral_phone` and `referral_email` are ONLY for the referring professional.
   - NEVER copy a referral attorney's phone/email into the `phone`/`email` fields or vice versa.
   - If the direct contact's phone/email is not in the text, leave `phone`/`email` BLANK — do NOT fill them with someone else's info.
   - If the referral source's phone/email is not in the text, leave `referral_phone`/`referral_email` BLANK.
   - It is MUCH better to leave a field blank than to put the wrong person's info in it.

3. Make sure we have SOME contact info — either the injured person's, a family contact's, or the referral source's. If absolutely none, ask.
4. If CRITICAL fields are missing (name of injured person), ask the user before creating
5. Once you have enough info, call manage_intake(action="create", ...) with the extracted fields
6. After creating, briefly confirm what was captured and note any fields you left blank because the info wasn't available

IMPORTANT:
- Be flexible with date formats — convert whatever the user gives into YYYY-MM-DD.
- Phone numbers can be any format.
- For case_type, normalize to common categories (auto accident, slip and fall, medical malpractice, prison injury, etc.).
- NEVER populate the `notes` field — it is reserved for office staff to add internal notes manually.
- When in doubt about which person a phone number or email belongs to, ASK the user rather than guessing.

Keep responses brief and action-oriented.""",
    },
    "full": {
        "tools": [],  # Empty = all tools available
        "system_prompt_addition": """You have access to all available tools. Help the user with any request related to their cases, tasks, events, contacts, notes, and more.

Call ALL needed tools in a SINGLE response using parallel tool calls. Be concise and action-oriented.""",
    },
}


def get_mode_config(mode: str | None) -> dict[str, Any] | None:
    """Get the configuration for a specific mode.

    Args:
        mode: The mode name (tasks, events, people, overview, full) or None.

    Returns:
        The mode configuration dict, or None if mode is invalid.
    """
    if not mode:
        return None
    return CHAT_MODES.get(mode)


def get_mode_tools(mode: str | None) -> list[str]:
    """Get the list of allowed tools for a mode.

    Args:
        mode: The mode name or None.

    Returns:
        List of tool names. Empty list means all tools are allowed.
    """
    config = get_mode_config(mode)
    if not config:
        return []
    return config.get("tools", [])


def get_mode_system_prompt(mode: str | None) -> str:
    """Get the system prompt addition for a mode.

    Args:
        mode: The mode name or None.

    Returns:
        The system prompt addition string, or empty string if no mode.
    """
    config = get_mode_config(mode)
    if not config:
        return ""
    return config.get("system_prompt_addition", "")
