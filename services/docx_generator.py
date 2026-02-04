"""
DOCX case report generator.

Generates a case status report as a .docx file using the attorney's
Word template rendered via docxtpl (Jinja2 templating for DOCX).
"""

import re
from io import BytesIO
from datetime import datetime
from pathlib import Path

TEMPLATE_PATH = Path(__file__).parent.parent / "templates" / "exports" / "case_report_template.docx"


def generate_case_list_docx(cases: list) -> BytesIO:
    """Generate a DOCX case status report from the attorney's template."""
    from docxtpl import DocxTemplate

    doc = DocxTemplate(str(TEMPLATE_PATH))
    context = _build_context(cases)
    doc.render(context)

    buf = BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf


def _build_context(cases: list) -> dict:
    """Transform case data into the template context dict."""
    now = datetime.now()
    today = now.strftime("%Y-%m-%d")

    return {
        "attorney_name": "Attorney",
        "creation_date": now.strftime("%B %d, %Y"),
        "cases": [_transform_case(c, today) for c in cases],
    }


def _transform_case(case_data: dict, today: str) -> dict:
    """Transform a single case into template-ready dict."""
    events = case_data.get("events", [])
    tasks = case_data.get("tasks", [])
    notes = case_data.get("notes", [])

    future_events = [
        {"date": _format_date(e.get("date")), "title": e.get("description", "")}
        for e in events
        if e.get("date") and e["date"] >= today
    ]

    future_tasks = [
        {"date": _format_date(t.get("due_date")), "title": t.get("description", "")}
        for t in tasks
        if t.get("status") != "Complete"
    ]

    # Concatenate recent notes (up to 5)
    note_texts = []
    for n in notes[:5]:
        content = (n.get("content") or "").strip()
        if content:
            # Strip person mention markdown links
            content = re.sub(r'\[@([^\]]+)\]\(person:\d+\)', r'\1', content)
            note_texts.append(content)
    notes_str = "\n\n".join(note_texts)

    return {
        "case_name": case_data.get("case_name", ""),
        "status": case_data.get("status", ""),
        "summary": case_data.get("case_summary") or "",
        "future_events": future_events,
        "future_tasks": future_tasks,
        "notes": notes_str,
    }


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
