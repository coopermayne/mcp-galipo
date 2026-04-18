"""
PDF intake generator.

Generates professional intake PDFs (list and detail) styled to match
the frontend's visual design. Uses WeasyPrint to render HTML/CSS to PDF.
"""

import re
from io import BytesIO
from html import escape
from datetime import datetime, date
from math import ceil


def generate_intake_list_pdf(intakes: list, status_filter: str | None = None) -> BytesIO:
    """Generate a professional PDF intake list report."""
    from weasyprint import HTML
    html = _build_html(intakes, status_filter)
    buf = BytesIO()
    HTML(string=html).write_pdf(buf)
    buf.seek(0)
    return buf


def _build_html(intakes: list, status_filter: str | None) -> str:
    now = datetime.now()
    date_str = now.strftime('%B %d, %Y')
    count = len(intakes)
    subtitle = f'{count} intake{"s" if count != 1 else ""}'
    if status_filter:
        subtitle = f'{status_filter} &middot; {subtitle}'

    rows = '\n'.join(_render_row(i, idx) for idx, i in enumerate(intakes))

    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
{_get_css()}
</style>
</head>
<body>

<div class="report-header">
  <div class="report-title">Intake List</div>
  <div class="report-meta">{date_str} &middot; {subtitle}</div>
</div>

<table class="intake-table">
  <thead>
    <tr>
      <th>Submitted</th>
      <th>Name</th>
      <th>Case Type</th>
      <th>DOI</th>
      <th class="sol-header">6MO / 2YR</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>
    {rows}
  </tbody>
</table>

</body>
</html>"""


def _render_row(intake: dict, idx: int) -> str:
    row_class = 'alt-row' if idx % 2 == 0 else ''

    submitted = _format_submitted(intake.get('submitted_on'))
    name = escape(intake.get('name') or '—')
    case_type = escape(intake.get('case_type') or '—')
    doi = _format_doi(intake.get('incident_date'))
    sol_html = _render_sol(intake.get('incident_date'))
    status = intake.get('status', '')
    status_class = _status_css_class(status)

    return f"""<tr class="{row_class}">
      <td class="submitted-col">{submitted}</td>
      <td class="name-col">{name}</td>
      <td>{case_type}</td>
      <td>{doi}</td>
      <td class="sol-col">{sol_html}</td>
      <td><span class="status-badge {status_class}">{escape(status)}</span></td>
    </tr>"""


def _render_sol(incident_date: str | None) -> str:
    if not incident_date:
        return '<span class="em">—</span>'

    six_mo = _days_until(incident_date, 6)
    two_yr = _days_until(incident_date, 24)

    six_html = _sol_span(six_mo)
    two_html = _sol_span(two_yr)

    return f'{six_html} <span class="sol-sep">/</span> {two_html}'


def _sol_span(days: int) -> str:
    if days < 0:
        return f'<span class="sol-danger">{days}</span>'
    if days <= 30:
        return f'<span class="sol-warning">{days}</span>'
    return f'<span class="sol-normal">{days}</span>'


def _days_until(doi_str: str, months: int) -> int:
    try:
        if isinstance(doi_str, date) and not isinstance(doi_str, datetime):
            doi = doi_str
        else:
            doi = datetime.strptime(str(doi_str)[:10], '%Y-%m-%d').date()
        year = doi.year + (doi.month - 1 + months) // 12
        month = (doi.month - 1 + months) % 12 + 1
        day = min(doi.day, 28)  # safe day
        deadline = date(year, month, day)
        today = date.today()
        return (deadline - today).days
    except (ValueError, TypeError):
        return 9999


def _status_css_class(status: str) -> str:
    mapping = {
        'New': 'status-info',
        'Dave Review': 'status-warning',
        'Needs Follow-Up': 'status-warning',
        'Awaiting PC': 'status-warning',
        'Atty Review': 'status-purple',
        'Needs Rejection Letter': 'status-destructive',
        'Rejection Letter Sent': 'status-destructive',
        'Needs Retainer': 'status-success',
        'Retainer Sent': 'status-success',
        'Retainer Signed': 'status-success',
        'Archived': 'status-muted',
    }
    return mapping.get(status, 'status-muted')


def _format_submitted(val) -> str:
    if not val:
        return '—'
    try:
        if isinstance(val, str):
            dt = datetime.fromisoformat(val.replace('Z', '+00:00'))
        elif isinstance(val, datetime):
            dt = val
        else:
            return str(val)
        return dt.strftime('%b %-d')
    except (ValueError, TypeError):
        return str(val)


def _format_doi(val) -> str:
    if not val:
        return '—'
    try:
        if isinstance(val, date) and not isinstance(val, datetime):
            d = val
        elif isinstance(val, str):
            d = datetime.strptime(val[:10], '%Y-%m-%d').date()
        else:
            return str(val)
        return d.strftime('%-m/%-d/%y')
    except (ValueError, TypeError):
        return str(val)


def _get_css() -> str:
    return """
    @page {
      size: letter portrait;
      margin: 0.5in 1.25in;
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

    /* === Intake table === */
    .intake-table {
      width: 100%;
      border-collapse: collapse;
    }
    .intake-table thead tr { background: #0f172a; }
    .intake-table th {
      padding: 2px 3px;
      text-align: left;
      font-size: 6.5px;
      font-weight: 600;
      color: #fff;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .intake-table td {
      padding: 2px 3px;
      font-size: 7.5px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: middle;
    }
    .intake-table .alt-row { background: #f8fafc; }

    .submitted-col {
      white-space: nowrap;
      font-size: 7.5px;
      color: #475569;
    }
    .name-col { font-weight: 600; }

    /* === SOL column === */
    .sol-header { text-align: center; }
    .sol-col {
      text-align: center;
      white-space: nowrap;
      font-family: 'JetBrains Mono', 'SF Mono', monospace;
      font-size: 8px;
    }
    .sol-sep { color: #94a3b8; }
    .sol-danger {
      background: #fee2e2;
      color: #dc2626;
      padding: 0 3px;
      font-weight: 600;
    }
    .sol-warning {
      background: #fef3c7;
      color: #92400e;
      padding: 0 3px;
      font-weight: 600;
    }
    .sol-normal { color: #0f172a; }

    /* === Status badges === */
    .status-badge {
      display: inline-block;
      padding: 1px 6px;
      font-size: 7px;
      font-weight: 600;
      white-space: nowrap;
    }
    .status-info { background: #dbeafe; color: #1d4ed8; }
    .status-warning { background: #fef3c7; color: #92400e; }
    .status-purple { background: #f3e8ff; color: #7c3aed; }
    .status-destructive { background: #fee2e2; color: #dc2626; }
    .status-success { background: #dcfce7; color: #166534; }
    .status-muted { background: #f1f5f9; color: #64748b; }

    .em { color: #cbd5e1; }
    """


# =============================================================================
# Individual Intake Detail PDF
# =============================================================================

def generate_intake_detail_pdf(intake: dict, comments: list) -> BytesIO:
    """Generate a PDF for a single intake with all details and activity."""
    from weasyprint import HTML
    html = _build_detail_html(intake, comments)
    buf = BytesIO()
    HTML(string=html).write_pdf(buf)
    buf.seek(0)
    return buf


def generate_intake_batch_pdf(intakes_with_comments: list[tuple[dict, list]]) -> BytesIO:
    """Generate a PDF with multiple intakes, each on its own page."""
    from weasyprint import HTML

    now = datetime.now()
    date_str = now.strftime('%B %d, %Y')
    count = len(intakes_with_comments)

    pages = []
    for i, (intake, comments) in enumerate(intakes_with_comments):
        page_class = 'detail-page' if i > 0 else 'detail-page-first'
        page_html = _build_detail_page(intake, comments)
        pages.append(f'<div class="{page_class}">{page_html}</div>')

    body = '\n'.join(pages)
    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
{_get_detail_css()}
.detail-page {{ page-break-before: always; }}
.detail-page-first {{ }}
</style>
</head>
<body>
{body}
</body>
</html>"""

    buf = BytesIO()
    HTML(string=html).write_pdf(buf)
    buf.seek(0)
    return buf


def _build_detail_page(intake: dict, comments: list) -> str:
    """Build the inner HTML content for a single intake detail (header + sections).

    Used by both single-detail and batch PDF generators.
    """
    now = datetime.now()
    date_str = now.strftime('%B %d, %Y')
    name = escape(intake.get('name') or 'Unnamed Intake')
    status = intake.get('status', '')
    status_cls = _status_css_class(status)

    sections = []

    # --- Header ---
    sections.append(f"""<div class="d-header">
  <div class="d-header-left">
    <span class="d-title">{name}</span>
    <span class="status-badge {status_cls}">{escape(status)}</span>
  </div>
  <div class="d-header-right">Printed {date_str}</div>
</div>""")

    # --- Metadata grid ---
    meta_items = []
    _add_meta(meta_items, 'Case Type', intake.get('case_type'))
    _add_meta(meta_items, 'DOI', _format_doi(intake.get('incident_date')))
    sol_html = _render_sol(intake.get('incident_date'))
    if intake.get('incident_date'):
        meta_items.append(f'<div class="d-meta-item"><span class="d-meta-label">6MO / 2YR</span><span class="d-meta-value mono">{sol_html}</span></div>')
    _add_meta(meta_items, 'Location', intake.get('location_short') or intake.get('location'))
    _add_meta(meta_items, 'Submitted', _format_submitted_full(intake.get('submitted_on')))
    _add_meta(meta_items, 'Phone', intake.get('phone'))
    _add_meta(meta_items, 'Email', intake.get('email'))
    _add_meta(meta_items, 'Contact Relationship', intake.get('contact_relationship'))

    if meta_items:
        sections.append(f'<div class="d-meta-grid">{"".join(meta_items)}</div>')

    # --- Referral ---
    ref_items = []
    _add_meta(ref_items, 'Name', intake.get('referral_name'))
    _add_meta(ref_items, 'Organization', intake.get('referral_org'))
    _add_meta(ref_items, 'Email', intake.get('referral_email'))
    _add_meta(ref_items, 'Phone', intake.get('referral_phone'))
    if ref_items:
        sections.append(f'<div class="d-section"><h3 class="d-section-title">Referral</h3><div class="d-meta-grid">{"".join(ref_items)}</div></div>')

    # --- AI Summary ---
    if intake.get('ai_summary'):
        summary = escape(intake['ai_summary'])
        summary = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', summary)
        summary = summary.replace('\n', '<br>')
        sections.append(f'<div class="d-section"><h3 class="d-section-title">AI Summary</h3><div class="d-ai-summary">{summary}</div></div>')

    # --- Notes ---
    if intake.get('notes'):
        notes = escape(intake['notes'])
        notes = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', notes)
        notes = notes.replace('\n', '<br>')
        sections.append(f'<div class="d-section"><h3 class="d-section-title">Notes</h3><div class="d-text">{notes}</div></div>')

    # --- Incident / Injury Description ---
    if intake.get('incident_description'):
        desc = escape(intake['incident_description'])
        sections.append(f'<div class="d-section"><h3 class="d-section-title">Incident Description</h3><div class="d-text">{desc}</div></div>')
    if intake.get('injury_description'):
        desc = escape(intake['injury_description'])
        sections.append(f'<div class="d-section"><h3 class="d-section-title">Injury Description</h3><div class="d-text">{desc}</div></div>')

    # --- Activity Log (timeline style) ---
    if comments:
        grouped = _group_comments_by_date(comments)
        timeline_html = []
        for date_label, group in grouped:
            timeline_html.append(f'<div class="tl-date-header">{escape(date_label)}</div>')
            for c in group:
                timeline_html.append(_render_timeline_entry(c))
        sections.append(f"""<div class="d-section">
          <h3 class="d-section-title">Activity</h3>
          <div class="tl-container">{"".join(timeline_html)}</div>
        </div>""")

    return '\n'.join(sections)


def _build_detail_html(intake: dict, comments: list) -> str:
    page_content = _build_detail_page(intake, comments)

    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
{_get_detail_css()}
</style>
</head>
<body>
{page_content}
</body>
</html>"""


def _add_meta(items: list, label: str, value) -> None:
    if not value or value == '—':
        return
    items.append(f'<div class="d-meta-item"><span class="d-meta-label">{escape(label)}</span><span class="d-meta-value">{escape(str(value))}</span></div>')


def _format_submitted_full(val) -> str:
    if not val:
        return ''
    try:
        if isinstance(val, str):
            dt = datetime.fromisoformat(val.replace('Z', '+00:00'))
        elif isinstance(val, datetime):
            dt = val
        else:
            return str(val)
        return dt.strftime('%b %-d, %Y at %-I:%M %p')
    except (ValueError, TypeError):
        return str(val)


def _format_activity_time(val) -> str:
    if not val:
        return ''
    try:
        if isinstance(val, str):
            dt = datetime.fromisoformat(val.replace('Z', '+00:00'))
        elif isinstance(val, datetime):
            dt = val
        else:
            return str(val)
        return dt.strftime('%-m/%-d %I:%M %p')
    except (ValueError, TypeError):
        return str(val)


def _format_activity_time_short(val) -> str:
    if not val:
        return ''
    try:
        if isinstance(val, str):
            dt = datetime.fromisoformat(val.replace('Z', '+00:00'))
        elif isinstance(val, datetime):
            dt = val
        else:
            return str(val)
        return dt.strftime('%-I:%M %p')
    except (ValueError, TypeError):
        return str(val)


def _format_date_header(val) -> str:
    if not val:
        return ''
    try:
        if isinstance(val, str):
            dt = datetime.fromisoformat(val.replace('Z', '+00:00'))
        elif isinstance(val, datetime):
            dt = val
        else:
            return str(val)
        today = datetime.now(dt.tzinfo) if dt.tzinfo else datetime.now()
        diff = (today.date() - dt.date()).days
        if diff == 0:
            return 'Today'
        if diff == 1:
            return 'Yesterday'
        return dt.strftime('%a, %b %-d')
    except (ValueError, TypeError):
        return str(val)


def _get_date_key(val) -> str:
    try:
        if isinstance(val, str):
            dt = datetime.fromisoformat(val.replace('Z', '+00:00'))
        elif isinstance(val, datetime):
            dt = val
        else:
            return str(val)
        return dt.strftime('%Y-%m-%d')
    except (ValueError, TypeError):
        return str(val)


def _group_comments_by_date(comments: list) -> list:
    groups = []
    current_key = ''
    for c in comments:
        key = _get_date_key(c.get('created_at'))
        if key != current_key:
            current_key = key
            label = _format_date_header(c.get('created_at'))
            groups.append((label, [c]))
        else:
            groups[-1][1].append(c)
    return groups


def _render_timeline_entry(c: dict) -> str:
    ts = _format_activity_time_short(c.get('created_at'))
    content_raw = c.get('content', '')
    is_system = c.get('is_system', False)

    if not is_system:
        first = c.get('user_first_name') or ''
        last = c.get('user_last_name') or ''
        user_name = f'{first} {last}'.strip() or 'Unknown'
        initials = (first[:1] + last[:1]).upper() or '?'
        return f"""<div class="tl-entry">
          <div class="tl-avatar">{escape(initials)}</div>
          <div class="tl-body">
            <div class="tl-meta"><span class="tl-name">{escape(user_name)}</span><span class="tl-time">{ts}</span></div>
            <div class="tl-comment">{escape(content_raw)}</div>
          </div>
        </div>"""

    status_match = re.match(r'^(.+?) changed status from (.+?) to (.+)$', content_raw)
    if status_match:
        who = escape(status_match.group(1))
        from_s = status_match.group(2)
        to_s = status_match.group(3)
        from_cls = _status_css_class(from_s)
        to_cls = _status_css_class(to_s)
        return f"""<div class="tl-entry">
          <div class="tl-icon">&#x21BB;</div>
          <div class="tl-body tl-system-body">
            <span>{who}</span>
            <span class="status-badge {from_cls}">{escape(from_s)}</span>
            <span class="tl-arrow">&rarr;</span>
            <span class="status-badge {to_cls}">{escape(to_s)}</span>
            <span class="tl-time">{ts}</span>
          </div>
        </div>"""

    icon = '&#x2139;'
    if 'created via' in content_raw or 'imported from' in content_raw:
        icon = '&#x2605;'
    elif 'AI analysis' in content_raw:
        icon = '&#x2B50;'
    elif c.get('detail', {}).get('type') == 'interaction':
        detail = c.get('detail', {})
        icon = '&#x260E;' if detail.get('interaction_type') == 'phone' else '&#x2709;'

    return f"""<div class="tl-entry">
      <div class="tl-icon">{icon}</div>
      <div class="tl-body tl-system-body">
        <span>{escape(content_raw)}</span>
        <span class="tl-time">{ts}</span>
      </div>
    </div>"""


def _get_detail_css() -> str:
    return """
    @page {
      size: letter portrait;
      margin: 0.35in 0.4in;
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
      line-height: 1.4;
    }

    /* === Header === */
    .d-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 5px;
      margin-bottom: 10px;
    }
    .d-header-left { display: flex; align-items: baseline; gap: 8px; }
    .d-title { font-size: 16px; font-weight: 700; }
    .d-header-right { font-size: 8px; color: #94a3b8; }

    /* === Status badges (shared) === */
    .status-badge {
      display: inline-block;
      padding: 1px 5px;
      font-size: 7px;
      font-weight: 600;
      white-space: nowrap;
    }
    .status-info { background: #dbeafe; color: #1d4ed8; }
    .status-warning { background: #fef3c7; color: #92400e; }
    .status-purple { background: #f3e8ff; color: #7c3aed; }
    .status-destructive { background: #fee2e2; color: #dc2626; }
    .status-success { background: #dcfce7; color: #166534; }
    .status-muted { background: #f1f5f9; color: #64748b; }

    /* === Sections === */
    .d-section { margin-top: 10px; }
    .d-section-title {
      font-size: 9px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      margin-bottom: 4px;
      padding-bottom: 2px;
      border-bottom: 1px solid #e2e8f0;
    }

    /* === Metadata grid === */
    .d-meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1fr;
      gap: 0;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      overflow: hidden;
    }
    .d-meta-item {
      padding: 3px 6px;
      border-bottom: 1px solid #e2e8f0;
      border-right: 1px solid #e2e8f0;
    }
    .d-meta-item:nth-child(4n) { border-right: none; }
    .d-meta-label {
      display: block;
      font-size: 6px;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .d-meta-value {
      font-size: 8px;
      color: #0f172a;
      font-weight: 500;
      word-break: break-word;
    }
    .mono {
      font-family: 'JetBrains Mono', 'SF Mono', monospace;
      font-size: 7.5px;
    }

    /* === SOL colors === */
    .sol-sep { color: #94a3b8; }
    .sol-danger { background: #fee2e2; color: #dc2626; padding: 0 2px; font-weight: 600; }
    .sol-warning { background: #fef3c7; color: #92400e; padding: 0 2px; font-weight: 600; }
    .sol-normal { color: #0f172a; }

    /* === AI Summary === */
    .d-ai-summary {
      font-size: 8px;
      color: #334155;
      line-height: 1.45;
      border-left: 3px solid #4771ff;
      padding: 4px 8px;
    }

    /* === Text blocks (notes, descriptions) === */
    .d-text {
      font-size: 8px;
      color: #334155;
      line-height: 1.45;
      white-space: pre-wrap;
    }

    /* === Activity timeline === */
    .tl-container {
      position: relative;
      padding-left: 20px;
      border-left: 1px solid #e2e8f0;
      margin-left: 8px;
    }
    .tl-date-header {
      font-size: 7px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: #94a3b8;
      padding: 5px 0 2px 0;
      margin-left: -20px;
      padding-left: 20px;
    }
    .tl-entry {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 3px 0;
      position: relative;
    }
    .tl-icon {
      width: 16px;
      height: 16px;
      background: #f1f5f9;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 7px;
      color: #64748b;
      flex-shrink: 0;
      position: relative;
      left: -28px;
      margin-right: -20px;
    }
    .tl-avatar {
      width: 16px;
      height: 16px;
      background: #4771ff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 6px;
      font-weight: 700;
      color: #fff;
      flex-shrink: 0;
      position: relative;
      left: -28px;
      margin-right: -20px;
    }
    .tl-body {
      flex: 1;
      min-width: 0;
    }
    .tl-system-body {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
      font-size: 7.5px;
      color: #64748b;
    }
    .tl-meta {
      display: flex;
      align-items: baseline;
      gap: 6px;
    }
    .tl-name {
      font-size: 8px;
      font-weight: 600;
      color: #0f172a;
    }
    .tl-time {
      font-size: 6.5px;
      color: #94a3b8;
      margin-left: auto;
      flex-shrink: 0;
    }
    .tl-comment {
      margin-top: 2px;
      border-left: 2px solid #cbd5e1;
      padding: 2px 8px;
      font-size: 8px;
      color: #334155;
      white-space: pre-wrap;
      line-height: 1.4;
    }
    .tl-arrow {
      font-size: 7px;
      color: #94a3b8;
    }

    .em { color: #cbd5e1; }
    """
