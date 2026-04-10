"""
PDF case report generator.

Generates a professional case status report as a PDF,
styled to match the frontend's visual design.
Uses WeasyPrint to render HTML/CSS to PDF.
"""

import re
from io import BytesIO
from html import escape
from collections import defaultdict
from datetime import datetime


def generate_case_list_pdf(cases: list) -> BytesIO:
    """Generate a professional PDF case status report."""
    from weasyprint import HTML
    html = _build_html(cases)
    buf = BytesIO()
    HTML(string=html).write_pdf(buf)
    buf.seek(0)
    return buf


def _build_html(cases: list) -> str:
    now = datetime.now()
    date_str = now.strftime('%B %d, %Y')
    count = len(cases)

    # Build case detail pages
    case_pages = '\n'.join(_render_case_page(c) for c in cases)

    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
{_get_css()}
</style>
</head>
<body>

<!-- Header + summary -->
<div class="report-header">
  <div class="report-title">Active Case Portfolio</div>
  <div class="report-meta">{date_str} &middot; {count} matter{"s" if count != 1 else ""}</div>
</div>
{_render_summary_table(cases)}

<!-- Individual cases -->
{case_pages}

</body>
</html>"""


# ─── Summary table ───

def _render_summary_table(cases: list) -> str:
    rows = ''
    for i, c in enumerate(cases):
        persons = c.get('persons', [])
        proceedings = c.get('proceedings', [])
        name = escape(c.get('short_name') or c.get('case_name', ''))
        status = escape(c.get('status', ''))
        case_num = escape(_get_primary_case_number(proceedings))
        judge = escape(_get_judge_name(proceedings, persons))
        clients = escape(', '.join(_get_persons_by_category(persons, 'client')))
        doi = escape(_format_date(c.get('date_of_injury')))
        row_class = 'alt-row' if i % 2 == 0 else ''
        rows += f"""<tr class="{row_class}">
          <td class="name-col">{name or em()}</td>
          <td><span class="status-badge">{status}</span></td>
          <td class="mono">{case_num or em()}</td>
          <td>{judge or em()}</td>
          <td>{clients or em()}</td>
          <td>{doi or em()}</td>
        </tr>"""

    return f"""<table class="summary-table">
      <thead>
        <tr>
          <th>Case</th><th>Status</th><th>Case No.</th>
          <th>Judge</th><th>Clients</th><th>Date of Injury</th>
        </tr>
      </thead>
      <tbody>{rows}</tbody>
    </table>"""


# ─── Individual case page ───

def _render_case_page(case_data: dict) -> str:
    case_name = escape(case_data.get('case_name', 'Untitled Case'))
    short_name = case_data.get('short_name')
    persons = case_data.get('persons', [])
    proceedings = case_data.get('proceedings', [])
    events = case_data.get('events', [])
    notes = case_data.get('notes', [])

    # Metadata
    status = escape(case_data.get('status', ''))
    doi = escape(_format_date(case_data.get('date_of_injury')) or '\u2014')
    case_num = escape(_get_primary_case_number(proceedings) or '\u2014')
    judge = escape(_get_judge_name(proceedings, persons) or '\u2014')
    jurisdiction = escape(_get_jurisdiction(proceedings) or '\u2014')
    opp_counsel = escape(', '.join(_get_persons_by_role(persons, 'Opposing Counsel')) or '\u2014')
    clients = escape(', '.join(_get_persons_by_category(persons, 'client')) or '\u2014')

    short_line = ''
    if short_name and short_name != case_data.get('case_name'):
        short_line = f'<div class="case-short-name">{escape(short_name)}</div>'

    summary_html = ''
    summary = case_data.get('case_summary')
    if summary:
        summary_html = f'<div class="summary-box">{escape(summary)}</div>'

    parties_html = _render_parties(persons)
    events_html = _render_events(events, case_data.get('date_of_injury'))
    notes_html = _render_notes(notes)

    return f"""
    <div class="case-page">
      <div class="case-header">
        <span class="case-title">{case_name}</span>
        <span class="status-badge">{status}</span>
      </div>

      <div class="meta-grid">
        <div class="meta-item"><span class="meta-label">Case No.</span> <span class="meta-value mono">{case_num}</span></div>
        <div class="meta-item"><span class="meta-label">Judge</span> <span class="meta-value">{judge}</span></div>
        <div class="meta-item"><span class="meta-label">DOI</span> <span class="meta-value">{doi}</span></div>
        <div class="meta-item"><span class="meta-label">Jurisdiction</span> <span class="meta-value">{jurisdiction}</span></div>
        <div class="meta-item"><span class="meta-label">Opp. Counsel</span> <span class="meta-value">{opp_counsel}</span></div>
        <div class="meta-item"><span class="meta-label">Clients</span> <span class="meta-value">{clients}</span></div>
      </div>

      {summary_html}
      {parties_html}
      {events_html}
      {notes_html}
    </div>"""


def _render_parties(persons: list) -> str:
    if not persons:
        return ''

    grouped = defaultdict(list)
    for p in persons:
        role = p.get('role', 'Other')
        if role == 'Judge':
            continue
        name = p.get('name', 'Unknown')
        org = p.get('organization')
        display = f'{escape(name)}'
        if org:
            display += f' <span class="org">\u2014 {escape(org)}</span>'
        grouped[role].append(display)

    role_order = [
        'Client', 'Defendant', 'Opposing Counsel', 'Co-Counsel',
        'Expert', 'Plaintiff Expert', 'Defense Expert', 'Expert - Plaintiff', 'Expert - Defendant',
        'Mediator', 'Witness', 'Lien Holder', 'Interpreter',
        'Referring Attorney', 'Guardian Ad Litem', 'Plaintiff Contact',
    ]
    all_roles = list(grouped.keys())
    ordered = [r for r in role_order if r in all_roles]
    ordered += [r for r in all_roles if r not in role_order]

    role_variant = {
        'Client': 'primary', 'Defendant': 'default',
        'Opposing Counsel': 'danger', 'Co-Counsel': 'success',
        'Referring Attorney': 'warning',
        'Expert - Plaintiff': 'primary', 'Plaintiff Expert': 'primary',
        'Expert - Defendant': 'danger', 'Defense Expert': 'danger',
        'Mediator': 'muted', 'Witness': 'primary',
        'Lien Holder': 'danger', 'Interpreter': 'success',
    }

    rows = ''
    for i, role in enumerate(ordered):
        names = grouped[role]
        variant = role_variant.get(role, 'default')
        row_class = 'alt-row' if i % 2 == 0 else ''
        chips = ' '.join(f'<span class="chip chip-{variant}">{n}</span>' for n in names)
        rows += f'<tr class="{row_class}"><td class="role-cell">{escape(role)}</td><td>{chips}</td></tr>'

    return f"""
    <div class="subsection">
      <h3 class="subsection-title">Parties & Counsel</h3>
      <table class="parties-table">
        <thead><tr><th style="width:140px">Role</th><th>Name</th></tr></thead>
        <tbody>{rows}</tbody>
      </table>
    </div>"""


def _render_events(events: list, date_of_injury) -> str:
    if not events and not date_of_injury:
        return ''

    starred = [e for e in events if e.get('starred')]
    regular = [e for e in events if not e.get('starred')]
    all_events = starred + regular

    rows = ''

    # Date of injury first
    if date_of_injury:
        doi_str = escape(_format_date(date_of_injury))
        rows += f"""<tr class="alt-row">
          <td class="event-date"><span class="doi-marker">DOI</span> {doi_str}</td>
          <td>Date of Injury</td>
          <td>{em()}</td>
        </tr>"""

    for i, event in enumerate(all_events):
        is_starred = event.get('starred', False)
        date_str = escape(_format_date(event.get('date')))
        time_str = event.get('time') or ''
        if time_str:
            date_str += f' <span class="time">at {escape(time_str)}</span>'
        desc = escape(event.get('description') or '')
        location = escape(event.get('location') or '')

        star_html = '<span class="star">\u2605</span> ' if is_starred else ''
        row_class = 'starred-row' if is_starred else ('alt-row' if (i + (1 if date_of_injury else 0)) % 2 == 0 else '')

        rows += f"""<tr class="{row_class}">
          <td class="event-date">{star_html}{date_str}</td>
          <td class="{'event-starred-desc' if is_starred else ''}">{desc}</td>
          <td class="event-location">{location or em()}</td>
        </tr>"""

    return f"""
    <div class="subsection">
      <h3 class="subsection-title">Key Dates & Events</h3>
      <table class="events-table">
        <thead><tr><th style="width:180px">Date</th><th>Description</th><th style="width:180px">Location</th></tr></thead>
        <tbody>{rows}</tbody>
      </table>
    </div>"""


def _render_notes(notes: list) -> str:
    if not notes:
        return ''

    items = ''
    for note in notes[:5]:
        content = note.get('content', '').strip()
        if not content:
            continue
        content = re.sub(r'\[@([^\]]+)\]\(person:\d+\)', r'\1', content)
        if len(content) > 500:
            content = content[:497] + '...'
        created = _format_date(note.get('created_at'))
        date_html = f'<span class="note-date">{escape(created)}</span>' if created else ''
        items += f'<div class="note-item">{date_html}<div class="note-text">{escape(content)}</div></div>'

    return f"""
    <div class="subsection">
      <h3 class="subsection-title">Recent Notes</h3>
      {items}
    </div>"""


# ─── CSS ───

def _get_css() -> str:
    return """
    @page {
      size: letter;
      margin: 0.45in 0.5in;
      @bottom-right {
        content: counter(page);
        font-family: 'Inter', 'Helvetica Neue', sans-serif;
        font-size: 7px;
        color: #94a3b8;
      }
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', 'Helvetica Neue', 'Segoe UI', sans-serif;
      font-size: 8.5px;
      color: #0f172a;
      line-height: 1.35;
    }

    /* === Report header === */
    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 6px;
      margin-bottom: 8px;
    }
    .report-title { font-size: 16px; font-weight: 700; color: #0f172a; }
    .report-meta { font-size: 8px; color: #94a3b8; }

    /* === Summary table === */
    .summary-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 6px;
    }
    .summary-table thead tr { background: #0f172a; }
    .summary-table th {
      padding: 4px 6px;
      text-align: left;
      font-size: 7px;
      font-weight: 600;
      color: #fff;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .summary-table td {
      padding: 3px 6px;
      font-size: 8px;
      border-bottom: 1px solid #f1f5f9;
    }
    .summary-table .alt-row { background: #f8fafc; }
    .summary-table .name-col { font-weight: 600; }
    .mono {
      font-family: 'JetBrains Mono', 'SF Mono', monospace;
      font-size: 7.5px;
    }

    /* === Status badge === */
    .status-badge {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 9999px;
      font-size: 7px;
      font-weight: 600;
      background: #e0ebff;
      color: #2f4ff5;
      white-space: nowrap;
    }

    /* === Case page === */
    .case-page {
      page-break-before: always;
      padding-top: 2px;
    }
    .case-header {
      display: flex;
      align-items: baseline;
      gap: 8px;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 4px;
      margin-bottom: 6px;
    }
    .case-title {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
    }

    /* === Metadata grid === */
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 0;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 8px;
    }
    .meta-item {
      padding: 4px 8px;
      border-bottom: 1px solid #e2e8f0;
      border-right: 1px solid #e2e8f0;
    }
    .meta-item:nth-child(3n) { border-right: none; }
    .meta-item:nth-last-child(-n+3) { border-bottom: none; }
    .meta-label {
      font-size: 6.5px;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .meta-value {
      font-size: 8.5px;
      color: #0f172a;
      font-weight: 500;
    }

    /* === Summary box === */
    .summary-box {
      background: #f0f5ff;
      border-left: 3px solid #4771ff;
      padding: 5px 8px;
      font-size: 8px;
      font-style: italic;
      color: #334155;
      line-height: 1.4;
      margin-bottom: 8px;
    }

    /* === Subsections === */
    .subsection { margin-top: 8px; }
    .subsection-title {
      font-size: 9px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      margin-bottom: 3px;
      padding-bottom: 2px;
      border-bottom: 1px solid #e2e8f0;
    }

    /* === Parties table === */
    .parties-table { width: 100%; border-collapse: collapse; }
    .parties-table thead tr { background: #0f172a; }
    .parties-table th {
      padding: 3px 6px;
      text-align: left;
      font-size: 7px;
      font-weight: 600;
      color: #fff;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .parties-table td {
      padding: 2px 6px;
      font-size: 8px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: top;
    }
    .parties-table .alt-row { background: #f8fafc; }
    .role-cell { font-weight: 600; color: #475569; white-space: nowrap; }

    /* === Person chips === */
    .chip {
      display: inline-block;
      padding: 1px 5px;
      border-radius: 3px;
      font-size: 7.5px;
      font-weight: 500;
      margin: 0 1px;
    }
    .chip .org { font-weight: 400; color: #64748b; font-size: 7px; }
    .chip-primary { background: #e0ebff; color: #2236ae; }
    .chip-default { background: #f1f5f9; color: #334155; }
    .chip-danger { background: #fee2e2; color: #991b1b; }
    .chip-success { background: #dcfce7; color: #166534; }
    .chip-warning { background: #fef3c7; color: #92400e; }
    .chip-muted { background: #f1f5f9; color: #475569; }

    /* === Events table === */
    .events-table { width: 100%; border-collapse: collapse; }
    .events-table thead tr { background: #0f172a; }
    .events-table th {
      padding: 3px 6px;
      text-align: left;
      font-size: 7px;
      font-weight: 600;
      color: #fff;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .events-table td {
      padding: 2px 6px;
      font-size: 8px;
      border-bottom: 1px solid #f1f5f9;
    }
    .events-table .alt-row { background: #f8fafc; }
    .starred-row { background: #fefce8; }
    .event-date { white-space: nowrap; font-weight: 500; }
    .event-date .time { color: #64748b; font-weight: 400; }
    .event-location { color: #64748b; font-size: 7.5px; }
    .event-starred-desc { font-weight: 600; }
    .star { color: #d97706; }
    .doi-marker {
      display: inline-block;
      padding: 0 3px;
      border-radius: 2px;
      font-size: 6px;
      font-weight: 700;
      background: #fee2e2;
      color: #dc2626;
      margin-right: 2px;
      text-transform: uppercase;
    }

    /* === Notes === */
    .note-item {
      padding: 3px 8px;
      border-left: 2px solid #e2e8f0;
      margin-bottom: 4px;
    }
    .note-date {
      font-size: 7px;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .note-text { font-size: 8px; color: #334155; line-height: 1.4; }

    .em { color: #cbd5e1; }
    """


# ─── Helpers ───

def em():
    return '<span class="em">\u2014</span>'


def _get_primary_case_number(proceedings):
    if not proceedings:
        return ''
    primary = next((p for p in proceedings if p.get('is_primary')), None)
    if primary:
        return primary.get('case_number', '')
    return proceedings[0].get('case_number', '') if proceedings else ''


def _get_judge_name(proceedings, persons):
    for proc in proceedings:
        judges = proc.get('judges', [])
        if judges:
            return judges[0].get('name', '')
    names = _get_persons_by_role(persons, 'Judge')
    return names[0] if names else ''


def _get_jurisdiction(proceedings):
    for proc in proceedings:
        # Support both flat (jurisdiction_name) and nested (jurisdiction.name) formats
        name = proc.get('jurisdiction_name')
        if not name:
            jur = proc.get('jurisdiction')
            if isinstance(jur, dict):
                name = jur.get('name')
        if name:
            return name
    return ''


def _get_persons_by_role(persons, role):
    return [p.get('name', '') for p in persons if p.get('role') == role]


def _get_persons_by_category(persons, category):
    return [p.get('name', '') for p in persons if p.get('role_category') == category]


def _format_date(date_val):
    if not date_val:
        return ''
    if isinstance(date_val, str):
        try:
            if 'T' in date_val:
                dt = datetime.fromisoformat(date_val.replace('Z', '+00:00'))
                return dt.strftime('%b %d, %Y')
            dt = datetime.strptime(date_val, '%Y-%m-%d')
            return dt.strftime('%b %d, %Y')
        except (ValueError, TypeError):
            return str(date_val)
    return str(date_val)
