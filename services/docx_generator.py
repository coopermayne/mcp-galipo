"""
DOCX case report generator.

Generates a professional case status report as a .docx file using
docxtpl (Jinja2 templating for DOCX) with RichText for conditional
styling — past items grey, urgent tasks bold, starred events highlighted.
"""

import re
from io import BytesIO
from datetime import datetime
from pathlib import Path

TEMPLATE_PATH = Path(__file__).parent.parent / "templates" / "exports" / "case_report_template.docx"


# Colors (hex without #, for RichText)
CLR_NAVY = "0F172A"
CLR_GREY = "94A3B8"
CLR_DARK_GREY = "475569"
CLR_RED = "DC2626"
CLR_BLUE = "2F4FF5"
CLR_WHITE = "FFFFFF"

# Background colors
BG_LIGHT = "F8FAFC"
BG_DOI = "FFF5F5"
BG_ALT = "F1F5F9"
BG_NONE = "FFFFFF"

# Status ordering (case lifecycle flow)
STATUS_ORDER = [
    'Signing Up', 'Prospective', 'Pre-Filing', 'Pleadings',
    'Discovery', 'Expert Discovery', 'Pre-trial', 'Trial',
    'Post-Trial', 'Appeal', 'Settl. Pend.', 'Stayed', 'Closed',
]

# Status colors for DOCX (text color, background color) - matches frontend Tailwind
STATUS_COLORS = {
    'Signing Up':       {"text": "1D4ED8", "bg": "DBEAFE"},
    'Prospective':      {"text": "7E22CE", "bg": "F3E8FF"},
    'Pre-Filing':       {"text": "4338CA", "bg": "E0E7FF"},
    'Pleadings':        {"text": "0E7490", "bg": "CFFAFE"},
    'Discovery':        {"text": "0369A1", "bg": "E0F2FE"},
    'Expert Discovery': {"text": "0F766E", "bg": "CCFBF1"},
    'Pre-trial':        {"text": "B45309", "bg": "FEF3C7"},
    'Trial':            {"text": "C2410C", "bg": "FFEDD5"},
    'Post-Trial':       {"text": "BE123C", "bg": "FFE4E6"},
    'Appeal':           {"text": "B91C1C", "bg": "FEE2E2"},
    'Settl. Pend.':     {"text": "4D7C0F", "bg": "ECFCCB"},
    'Stayed':           {"text": "334155", "bg": "F1F5F9"},
    'Closed':           {"text": "6B7280", "bg": "F3F4F6"},
}


def generate_case_list_docx(cases: list, attorney_name: str = "Attorney") -> BytesIO:
    """Generate a DOCX case status report from the template."""
    from docxtpl import DocxTemplate

    doc = DocxTemplate(str(TEMPLATE_PATH))
    context = _build_context(cases, attorney_name)
    doc.render(context)

    buf = BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf


def _build_context(cases: list, attorney_name: str) -> dict:
    """Transform case data into the template context dict, grouped by phase."""
    from docxtpl import RichText

    now = datetime.now()
    today = now.strftime("%Y-%m-%d")

    # Group cases by status
    by_status = {}
    for c in cases:
        status = c.get("status", "")
        by_status.setdefault(status, []).append(c)

    phases = []
    for status in STATUS_ORDER:
        if status not in by_status:
            continue
        phase_cases = [_transform_case(c, today) for c in by_status[status]]
        colors = STATUS_COLORS.get(status, {"text": CLR_NAVY, "bg": "F1F5F9"})

        header_rt = RichText()
        header_rt.add(status, bold=True, color=colors["text"], size=28)
        header_rt.add(f"  ({len(phase_cases)})", color=CLR_GREY, size=24)

        phases.append({
            "name": status,
            "count": len(phase_cases),
            "cases": phase_cases,
            "color": colors["text"],
            "bg": colors["bg"],
            "header_rt": header_rt,
        })

    # Handle any statuses not in STATUS_ORDER
    for status, case_list in by_status.items():
        if status not in STATUS_ORDER:
            phase_cases = [_transform_case(c, today) for c in case_list]
            header_rt = RichText()
            header_rt.add(status or "Other", bold=True, color=CLR_NAVY, size=28)
            header_rt.add(f"  ({len(phase_cases)})", color=CLR_GREY, size=24)
            phases.append({
                "name": status or "Other",
                "count": len(phase_cases),
                "cases": phase_cases,
                "color": CLR_NAVY,
                "bg": "F1F5F9",
                "header_rt": header_rt,
            })

    # Title: "LASTNAME - Case List"
    last_name = attorney_name.split()[-1].upper() if attorney_name else "ATTORNEY"
    title = f"{last_name} \u2013 Case List"

    return {
        "title": title,
        "attorney_name": attorney_name,
        "creation_date": now.strftime("%B %d, %Y"),
        "case_count": len(cases),
        "phases": phases,
    }


def _transform_case(case_data: dict, today: str) -> dict:
    """Transform a single case into template-ready dict with RichText objects."""
    from docxtpl import RichText

    persons = case_data.get("persons", [])
    proceedings = case_data.get("proceedings", [])
    events = case_data.get("events", [])
    tasks = case_data.get("tasks", [])
    # Metadata (same helpers as PDF generator)
    case_name = case_data.get("case_name", "Untitled Case")
    short_name = case_data.get("short_name") or case_name
    status = case_data.get("status", "")
    case_number = _get_primary_case_number(proceedings)
    judge = _get_judge_name(proceedings, persons)
    doi_raw = case_data.get("date_of_injury")
    doi = _format_date(doi_raw) if doi_raw else ""
    jurisdiction = _get_jurisdiction(proceedings)
    clients = ", ".join(p.get("name", "") for p in persons if p.get("role_category") == "client")
    other_proceedings = _get_other_proceedings(proceedings)
    summary = case_data.get("case_summary") or ""
    trial_date = _get_trial_date(events)

    colors = STATUS_COLORS.get(status, {"text": CLR_NAVY, "bg": "F1F5F9"})

    # Summary line for cover page: "→  Case Name (case_number, jurisdiction)" or "→  Case Name (N/A)"
    display_name = case_name if len(case_name) <= 60 else case_name[:57] + "..."
    summary_line_rt = RichText()
    summary_line_rt.add("\u2192  ", color=CLR_GREY, size=24)
    summary_line_rt.add(display_name, bold=True, color=CLR_NAVY, size=24)
    if case_number:
        detail = case_number
        if jurisdiction:
            detail += f", {jurisdiction}"
        summary_line_rt.add(f" ({detail})", color=CLR_GREY, size=24)
    else:
        summary_line_rt.add(" (N/A)", color=CLR_GREY, size=24)

    # Title RichText: just the case name (status shown in banner)
    title_rt = RichText()
    title_rt.add(case_name, bold=True, color=CLR_NAVY, size=28)  # 14pt

    # Status badge RichText (right-aligned in title bar)
    status_rt = RichText()
    status_rt.add(f" {status} ", bold=True, color=colors["text"], size=24)  # 12pt

    # Case info line: "2:25-cv-01537-CSK (E.D. Cal.), Judge Troy L. Nunley"
    case_info_rt = RichText()
    has_info = bool(case_number or judge)
    if case_number:
        case_info_rt.add(case_number, bold=True, color=CLR_NAVY, size=28)
        if jurisdiction:
            case_info_rt.add(f" ({jurisdiction})", color=CLR_DARK_GREY, size=24)
        if judge:
            case_info_rt.add(", ", color=CLR_GREY, size=24)
    if judge:
        case_info_rt.add(f"Judge {judge}", color=CLR_NAVY, size=28)

    # Other proceedings line: "Also: 5:25-cv-01887-JGB, CIVDS2500145"
    other_proceedings_rt = RichText()
    has_other_proceedings = bool(other_proceedings)
    if has_other_proceedings:
        other_proceedings_rt.add("Also: ", color=CLR_GREY, size=24)
        other_proceedings_rt.add(other_proceedings, color=CLR_NAVY, size=24)

    # Detail line: "Client: Evgeniy Gubanov"
    detail_rt = RichText()
    has_detail = bool(clients)
    if clients:
        detail_rt.add("Client: ", color=CLR_GREY, size=24)
        detail_rt.add(clients, color=CLR_NAVY, size=24)

    # Counsel & mediators — one line per person with role badge
    counsel_items = _build_counsel(persons)

    # Events with RichText
    event_items = _build_events(events, doi_raw, today)

    # Tasks with RichText (exclude only "Done" status)
    task_items = _build_tasks(tasks, today)

    # Notes — single markdown field on the case
    case_notes = case_data.get("notes") or ""

    return {
        "case_name": case_name,
        "short_name": short_name,
        "status": status,
        "case_number": case_number or "\u2014",
        "judge": judge or "\u2014",
        "doi": doi or "\u2014",
        "jurisdiction": jurisdiction or "\u2014",
        "clients": clients or "\u2014",
        "trial_date": trial_date,
        "other_proceedings": other_proceedings,
        "summary": summary,
        "summary_line_rt": summary_line_rt,
        "title_rt": title_rt,
        "status_rt": status_rt,
        "status_bg": colors["bg"],
        "case_info_rt": case_info_rt,
        "has_info": has_info,
        "other_proceedings_rt": other_proceedings_rt,
        "has_other_proceedings": has_other_proceedings,
        "detail_rt": detail_rt,
        "has_detail": has_detail,
        "counsel_items": counsel_items,
        "has_counsel": len(counsel_items) > 0,
        "has_timeline": len(event_items) > 0,
        "event_items": event_items,
        "task_items": task_items,
        "has_tasks": len(task_items) > 0,
        "notes": case_notes,
    }


# Role badge colors — text and background, matching frontend person-tree.tsx
ROLE_BADGE_COLORS = {
    "referring_attorney": {"text": "FFFFFF", "bg": "0D9488"},  # teal
    "co_counsel":         {"text": "FFFFFF", "bg": "16A34A"},  # green
    "public_defender":    {"text": "FFFFFF", "bg": "16A34A"},  # green
    "mediator":           {"text": "000000", "bg": "F59E0B"},  # amber
    "opposing_counsel":   {"text": "FFFFFF", "bg": "DC2626"},  # red
    "prosecutor":         {"text": "FFFFFF", "bg": "DC2626"},  # red
    "defense_counsel":    {"text": "FFFFFF", "bg": "EA580C"},  # orange
    "criminal_defense_attorney": {"text": "FFFFFF", "bg": "EA580C"},  # orange
}

# Display order for counsel role groups
COUNSEL_ROLE_ORDER = [
    "referring_attorney",
    "co_counsel",
    "public_defender",
    "mediator",
    "opposing_counsel",
    "prosecutor",
    "defense_counsel",
    "criminal_defense_attorney",
]

COUNSEL_ROLE_LABELS = {
    "referring_attorney": "Referring Attorney",
    "co_counsel": "Co Counsel",
    "public_defender": "Public Defender",
    "mediator": "Mediator",
    "opposing_counsel": "Opposing Counsel",
    "prosecutor": "Prosecutor",
    "defense_counsel": "Defense Counsel",
    "criminal_defense_attorney": "Criminal Defense Attorney",
}


def _build_counsel(persons: list) -> list:
    """Build counsel & mediator list grouped by role — one line per role with colored tag + names."""
    from docxtpl import RichText

    # Group persons by role
    by_role = {}
    for p in persons:
        if p.get("role_category") not in ("counsel", "mediator"):
            continue
        role = p.get("role", "")
        if p.get("name"):
            by_role.setdefault(role, []).append(p)

    if not by_role:
        return []

    # Roles that show firm name
    SHOW_ORG_ROLES = {"opposing_counsel", "prosecutor", "defense_counsel", "criminal_defense_attorney"}

    items = []
    for role in COUNSEL_ROLE_ORDER:
        role_persons = by_role.get(role)
        if not role_persons:
            continue
        colors = ROLE_BADGE_COLORS.get(role, {"text": "FFFFFF", "bg": "6B7280"})
        label = COUNSEL_ROLE_LABELS.get(role, role)
        show_org = role in SHOW_ORG_ROLES

        rt = RichText()
        rt.add(f" {label} ", color=colors["text"], size=20,
               bold=True, highlight=colors["bg"])
        rt.add("  ", size=24)

        for i, p in enumerate(role_persons):
            if i > 0:
                rt.add(", ", color=CLR_NAVY, size=24)
            rt.add(p["name"], color=CLR_NAVY, size=24)
            org = p.get("organization")
            if show_org and org:
                rt.add(f" ({org})", color=CLR_GREY, size=24)

        items.append({"rt": rt})

    return items


def _build_events(events: list, doi_raw, today: str) -> list:
    """Build event list with RichText objects and background colors."""
    from docxtpl import RichText

    items = []
    idx = 0  # for alternating bg

    # DOI row first — styled as a past event with star
    if doi_raw:
        doi_str = _format_date(doi_raw)
        date_rt = RichText()
        date_rt.add("\u2605 ", color=CLR_GREY, size=24)
        date_rt.add(doi_str, color=CLR_GREY, italic=True, size=24)

        desc_rt = RichText()
        desc_rt.add("Date of Injury", color=CLR_GREY, italic=True, size=24)

        items.append({
            "date_rt": date_rt,
            "desc_rt": desc_rt,
            "bg": BG_DOI,
        })
        idx += 1

    # Sort by date, skip past events unless starred
    all_events = sorted(events, key=lambda e: e.get("date", ""))

    for event in all_events:
        event_date = event.get("date", "")
        is_past = bool(event_date and event_date < today)
        is_starred = event.get("starred", False)
        if is_past and not is_starred:
            continue
        date_str = _format_date(event_date)
        time_str = event.get("time") or ""
        desc = event.get("description") or ""

        # Alternating background
        bg = BG_ALT if idx % 2 == 0 else BG_NONE

        # Date RichText — star before starred events, time on its own line
        date_rt = RichText()
        if is_starred:
            star_color = CLR_GREY if is_past else "D97706"
            date_rt.add("\u2605 ", color=star_color, size=24)
        if is_past:
            date_rt.add(date_str, color=CLR_GREY, italic=True, bold=is_starred, size=24)
            if time_str:
                date_rt.add("\n", size=24)
                date_rt.add(time_str, color=CLR_GREY, italic=True, size=24)
        else:
            date_rt.add(date_str, color=CLR_NAVY, bold=is_starred, size=24)
            if time_str:
                date_rt.add("\n", size=24)
                date_rt.add(time_str, color=CLR_DARK_GREY, italic=True, size=24)

        # Description RichText
        desc_rt = RichText()
        if is_past:
            desc_rt.add(desc, color=CLR_GREY, italic=True, bold=is_starred, size=24)
        else:
            desc_rt.add(desc, color=CLR_NAVY, bold=is_starred, size=24)

        items.append({
            "date_rt": date_rt,
            "desc_rt": desc_rt,
            "bg": bg,
        })
        idx += 1

    return items


# Task status symbols
TASK_STATUS_SYMBOLS = {
    "Pending":              "\u2610",  # ☐ empty checkbox
    "Active":               "\u25D1",  # ◑ half-filled circle
    "Partially Done":       "\u25D1",  # ◑ half-filled circle
    "Blocked":              "\u2717",  # ✗ x mark
    "Awaiting Atty Review": "\u25D1",  # ◑ half-filled circle
    "Done":                 "\u2611",  # ☑ checked
}


def _build_tasks(tasks: list, today: str) -> list:
    """Build task list with RichText objects. Status symbols + urgency styling."""
    from docxtpl import RichText

    # Filter: exclude Done tasks only
    incomplete = [t for t in tasks if t.get("status") != "Done"]
    if not incomplete:
        return []

    items = []
    for idx, task in enumerate(incomplete):
        desc = task.get("description") or ""
        urgency = task.get("urgency", "Medium")
        if urgency is None:
            urgency = "Medium"
        status = task.get("status") or "Pending"
        due_date = task.get("due_date") or ""
        is_overdue = bool(due_date and due_date < today)
        symbol = TASK_STATUS_SYMBOLS.get(status, "\u2610")

        # Alternating background
        bg = BG_ALT if idx % 2 == 0 else BG_NONE

        desc_rt = RichText()
        if status == "Blocked":
            desc_rt.add(f"{symbol} ", color=CLR_RED, size=24)
            desc_rt.add(desc, color=CLR_RED, size=24)
        elif is_overdue:
            desc_rt.add(f"{symbol} ", color=CLR_GREY, size=24)
            desc_rt.add(desc, color=CLR_GREY, italic=True, size=24)
        elif urgency == "Urgent":
            desc_rt.add(f"{symbol} ", color=CLR_RED, size=24)
            desc_rt.add(desc, bold=True, color=CLR_NAVY, size=24)
        elif urgency == "High":
            desc_rt.add(f"{symbol} ", color=CLR_NAVY, size=24)
            desc_rt.add(desc, bold=True, color=CLR_NAVY, size=24)
        else:
            desc_rt.add(f"{symbol} ", color=CLR_GREY, size=24)
            desc_rt.add(desc, color=CLR_NAVY, size=24)

        items.append({
            "desc_rt": desc_rt,
            "bg": bg,
        })

    return items


# ─── Helpers (mirrored from pdf_generator.py) ───

def _get_primary_case_number(proceedings):
    if not proceedings:
        return ""
    primary = next((p for p in proceedings if p.get("is_primary")), None)
    if primary:
        return primary.get("case_number", "")
    return proceedings[0].get("case_number", "") if proceedings else ""


def _get_judge_name(proceedings, persons):
    for proc in proceedings:
        judges = proc.get("judges", [])
        if judges:
            return judges[0].get("name", "")
    names = _get_persons_by_role(persons, "Judge")
    return names[0] if names else ""


def _get_trial_date(events):
    """Find the trial date from events (e.g. 'Trial', 'Jury Trial', 'JURY TRIAL')."""
    import re
    trial_pattern = re.compile(r'^(jury\s+)?trial\b', re.IGNORECASE)
    for event in sorted(events, key=lambda e: e.get("date", ""), reverse=True):
        desc = (event.get("description") or "").strip()
        if trial_pattern.match(desc):
            return _format_date(event.get("date"))
    return ""


def _get_jurisdiction(proceedings):
    for proc in proceedings:
        # Support both flat (jurisdiction_name) and nested (jurisdiction.name) formats
        name = proc.get("jurisdiction_name")
        if not name:
            jur = proc.get("jurisdiction")
            if isinstance(jur, dict):
                name = jur.get("name")
        if name:
            return name
    return ""


def _get_persons_by_role(persons, role):
    return [p.get("name", "") for p in persons if p.get("role") == role]



def _get_other_proceedings(proceedings):
    """Get non-primary case numbers as comma-separated string."""
    if not proceedings:
        return ""
    others = [
        p.get("case_number", "")
        for p in proceedings
        if not p.get("is_primary") and p.get("case_number")
    ]
    return ", ".join(others)


def _format_date(date_val) -> str:
    """Format a date value into a human-readable string."""
    if not date_val:
        return ""
    if isinstance(date_val, str):
        try:
            if "T" in date_val:
                dt = datetime.fromisoformat(date_val.replace("Z", "+00:00"))
                return dt.strftime("%b %d, %Y")
            dt = datetime.strptime(date_val, "%Y-%m-%d")
            return dt.strftime("%b %d, %Y")
        except (ValueError, TypeError):
            return str(date_val)
    return str(date_val)
