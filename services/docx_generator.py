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

# Urgency labels
URGENCY_LABELS = {1: "Low", 2: "Medium", 3: "High", 4: "Urgent"}

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
        header_rt.add(status, bold=True, color=colors["text"], size=20)
        header_rt.add(f"  ({len(phase_cases)})", color=CLR_GREY, size=16)

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
            header_rt.add(status or "Other", bold=True, color=CLR_NAVY, size=20)
            header_rt.add(f"  ({len(phase_cases)})", color=CLR_GREY, size=16)
            phases.append({
                "name": status or "Other",
                "count": len(phase_cases),
                "cases": phase_cases,
                "color": CLR_NAVY,
                "bg": "F1F5F9",
                "header_rt": header_rt,
            })

    return {
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
    notes = case_data.get("notes", [])

    # Metadata (same helpers as PDF generator)
    case_name = case_data.get("case_name", "Untitled Case")
    short_name = case_data.get("short_name") or case_name
    status = case_data.get("status", "")
    case_number = _get_primary_case_number(proceedings)
    judge = _get_judge_name(proceedings, persons)
    doi_raw = case_data.get("date_of_injury")
    doi = _format_date(doi_raw) if doi_raw else ""
    jurisdiction = _get_jurisdiction(proceedings)
    clients = ", ".join(_get_persons_by_role(persons, "Client"))
    other_proceedings = _get_other_proceedings(proceedings)
    summary = case_data.get("case_summary") or ""

    colors = STATUS_COLORS.get(status, {"text": CLR_NAVY, "bg": "F1F5F9"})

    # Title RichText: just the case name (status shown in banner)
    title_rt = RichText()
    title_rt.add(case_name, bold=True, color=CLR_NAVY, size=28)  # 14pt = 28 half-pts

    # Status badge RichText (right-aligned in title bar)
    status_rt = RichText()
    status_rt.add(f" {status} ", bold=True, color=colors["text"], size=20)  # 10pt

    # Case info line: "2:25-cv-01537-CSK (E.D. Cal.), Judge Troy L. Nunley"
    case_info_rt = RichText()
    has_info = bool(case_number or judge)
    if case_number:
        case_info_rt.add(case_number, bold=True, color=CLR_NAVY, size=18)
        if jurisdiction:
            case_info_rt.add(f" ({jurisdiction})", color=CLR_DARK_GREY, size=17)
        if judge:
            case_info_rt.add(", ", color=CLR_GREY, size=17)
    if judge:
        case_info_rt.add(f"Judge {judge}", color=CLR_NAVY, size=17)

    # Detail line: "DOI: Jun 10, 2024  ·  Client: Evgeniy Gubanov"
    detail_rt = RichText()
    has_detail = bool(doi or clients)
    if doi:
        detail_rt.add("DOI: ", color=CLR_GREY, size=15)
        detail_rt.add(doi, color=CLR_NAVY, size=16)
    if doi and clients:
        detail_rt.add("   \u00b7   ", color=CLR_GREY, size=15)
    if clients:
        detail_rt.add("Client: ", color=CLR_GREY, size=15)
        detail_rt.add(clients, color=CLR_NAVY, size=16)

    # Counsel line: all counsel grouped by side
    plaintiff_counsel, defense_counsel = _get_counsel_groups(persons)
    counsel_rt = RichText()
    has_counsel = bool(plaintiff_counsel or defense_counsel)
    if plaintiff_counsel:
        counsel_rt.add("Co-Counsel: ", color=CLR_GREY, size=15)
        counsel_rt.add(", ".join(plaintiff_counsel), color=CLR_NAVY, size=16)
    if plaintiff_counsel and defense_counsel:
        counsel_rt.add("   |   ", color=CLR_GREY, size=15)
    if defense_counsel:
        counsel_rt.add("Defense: ", color=CLR_GREY, size=15)
        counsel_rt.add(", ".join(defense_counsel), color=CLR_NAVY, size=16)

    # Events with RichText
    event_items = _build_events(events, doi_raw, today)

    # Tasks with RichText (exclude only "Done" status)
    task_items = _build_tasks(tasks, today)

    # Notes
    note_items = _build_notes(notes)

    # Timeline (events and tasks zipped side by side)
    # Each side gets its own bg — empty side stays white (no phantom rows)
    timeline = []
    max_len = max(len(event_items), len(task_items)) if (event_items or task_items) else 0
    for i in range(max_len):
        row = {}
        has_ev = i < len(event_items)
        has_tk = i < len(task_items)
        alt_bg = BG_ALT if i % 2 == 0 else BG_NONE

        row["ev_date"] = event_items[i]["date_rt"] if has_ev else ""
        row["ev_desc"] = event_items[i]["desc_rt"] if has_ev else ""
        row["ev_bg"] = alt_bg if has_ev else BG_NONE

        row["tk_date"] = task_items[i]["date_rt"] if has_tk else ""
        row["tk_desc"] = task_items[i]["desc_rt"] if has_tk else ""
        row["tk_bg"] = alt_bg if has_tk else BG_NONE

        timeline.append(row)

    return {
        "case_name": case_name,
        "short_name": short_name,
        "status": status,
        "case_number": case_number or "\u2014",
        "judge": judge or "\u2014",
        "doi": doi or "\u2014",
        "jurisdiction": jurisdiction or "\u2014",
        "clients": clients or "\u2014",
        "other_proceedings": other_proceedings,
        "summary": summary,
        "title_rt": title_rt,
        "status_rt": status_rt,
        "status_bg": colors["bg"],
        "case_info_rt": case_info_rt,
        "has_info": has_info,
        "detail_rt": detail_rt,
        "has_detail": has_detail,
        "counsel_rt": counsel_rt,
        "has_counsel": has_counsel,
        "has_timeline": len(timeline) > 0,
        "timeline": timeline,
        "notes": note_items if note_items else None,
    }


def _build_events(events: list, doi_raw, today: str) -> list:
    """Build event list with RichText objects and background colors."""
    from docxtpl import RichText

    items = []
    idx = 0  # for alternating bg

    # DOI row first
    if doi_raw:
        doi_str = _format_date(doi_raw)
        date_rt = RichText()
        date_rt.add("DOI ", bold=True, color=CLR_RED, size=12)  # 6pt
        date_rt.add(doi_str, bold=True, color=CLR_NAVY, size=16)

        desc_rt = RichText()
        desc_rt.add("Date of Injury", bold=True, color=CLR_NAVY, size=16)

        loc_rt = RichText()
        loc_rt.add("\u2014", color=CLR_GREY, size=16)

        items.append({
            "date_rt": date_rt,
            "desc_rt": desc_rt,
            "loc_rt": loc_rt,
            "bg": BG_DOI,
        })
        idx += 1

    # Sort by date (starred events keep visual styling but stay in order)
    all_events = sorted(events, key=lambda e: e.get("date", ""))

    for event in all_events:
        event_date = event.get("date", "")
        is_past = bool(event_date and event_date < today)
        is_starred = event.get("starred", False)
        date_str = _format_date(event_date)
        time_str = event.get("time") or ""
        desc = event.get("description") or ""
        location = event.get("location") or ""

        # Alternating background
        bg = BG_ALT if idx % 2 == 0 else BG_NONE

        # Date RichText
        date_rt = RichText()
        if is_starred:
            date_rt.add("\u2605 ", color="D97706" if not is_past else CLR_GREY, size=16)
        if is_past:
            date_rt.add(date_str, color=CLR_GREY, italic=True, bold=is_starred, size=16)
            if time_str:
                date_rt.add(f" at {time_str}", color=CLR_GREY, italic=True, size=14)
        else:
            date_rt.add(date_str, color=CLR_NAVY, bold=is_starred, size=16)
            if time_str:
                date_rt.add(f" at {time_str}", color=CLR_DARK_GREY, size=14)

        # Description RichText
        desc_rt = RichText()
        if is_past:
            desc_rt.add(desc, color=CLR_GREY, italic=True, bold=is_starred, size=16)
        else:
            desc_rt.add(desc, color=CLR_NAVY, bold=is_starred, size=16)

        # Location RichText
        loc_rt = RichText()
        if location:
            loc_rt.add(location, color=CLR_GREY if is_past else CLR_DARK_GREY, italic=is_past, size=15)
        else:
            loc_rt.add("\u2014", color=CLR_GREY, size=15)

        items.append({
            "date_rt": date_rt,
            "desc_rt": desc_rt,
            "loc_rt": loc_rt,
            "bg": bg,
        })
        idx += 1

    return items


def _build_tasks(tasks: list, today: str) -> list:
    """Build task list with RichText objects. Urgency shown via visual markers."""
    from docxtpl import RichText

    # Filter: exclude Done tasks only
    incomplete = [t for t in tasks if t.get("status") != "Done"]
    if not incomplete:
        return []

    items = []
    for idx, task in enumerate(incomplete):
        due_date = task.get("due_date") or ""
        desc = task.get("description") or ""
        urgency = task.get("urgency", 2)
        if urgency is None:
            urgency = 2

        is_overdue = bool(due_date and due_date < today)
        date_str = _format_date(due_date)

        # Alternating background
        bg = BG_ALT if idx % 2 == 0 else BG_NONE

        date_rt = RichText()
        desc_rt = RichText()

        if is_overdue:
            # Overdue: grey italic
            date_rt.add(date_str or "\u2014", color=CLR_GREY, italic=True, size=16)
            desc_rt.add(desc, color=CLR_GREY, italic=True, size=16)
        elif urgency == 4:
            # Urgent: red marker + bold
            date_rt.add(date_str or "\u2014", bold=True, color=CLR_RED, size=16)
            desc_rt.add("\u25CF ", color=CLR_RED, size=12)
            desc_rt.add(desc, bold=True, color=CLR_NAVY, size=16)
        elif urgency == 3:
            # High: bold navy
            date_rt.add(date_str or "\u2014", bold=True, color=CLR_NAVY, size=16)
            desc_rt.add("\u25CF ", color=CLR_NAVY, size=10)
            desc_rt.add(desc, bold=True, color=CLR_NAVY, size=16)
        else:
            # Normal: regular navy
            date_rt.add(date_str or "\u2014", color=CLR_NAVY, size=16)
            desc_rt.add(desc, color=CLR_NAVY, size=16)

        items.append({
            "date_rt": date_rt,
            "desc_rt": desc_rt,
            "bg": bg,
        })

    return items


def _build_notes(notes: list) -> list:
    """Build note list (max 5, truncated to 500 chars)."""
    items = []
    for note in notes[:5]:
        content = (note.get("content") or "").strip()
        if not content:
            continue
        # Strip person mention markdown links
        content = re.sub(r'\[@([^\]]+)\]\(person:\d+\)', r'\1', content)
        if len(content) > 500:
            content = content[:497] + "..."
        created = _format_date(note.get("created_at"))
        items.append({
            "date": created,
            "content": content,
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


def _get_jurisdiction(proceedings):
    for proc in proceedings:
        name = proc.get("jurisdiction_name")
        if name:
            return name
    return ""


def _get_persons_by_role(persons, role):
    return [p.get("name", "") for p in persons if p.get("role") == role]


def _get_counsel_groups(persons):
    """Get counsel names grouped into plaintiff-side and defense-side lists."""
    plaintiff = []
    defense = []
    for p in persons:
        role = p.get("role", "")
        name = p.get("name", "")
        if not name:
            continue
        if role in ("Co-Counsel", "Public Defender", "Criminal Defense Attorney"):
            plaintiff.append(name)
        elif role in ("Opposing Counsel", "Prosecutor"):
            defense.append(name)
    return plaintiff, defense


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
