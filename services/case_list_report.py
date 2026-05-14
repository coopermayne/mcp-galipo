"""
Active case list PDF generator.

Generates a compact, grouped case list PDF.
Three grouping modes: by attorney, by status, or alphabetical.
"""

from io import BytesIO
from html import escape
from collections import defaultdict
from datetime import datetime
from lib.tz import LA


def generate_case_list_report(cases: list, users_map: dict, group_by: str = "alphabetical") -> BytesIO:
    from weasyprint import HTML
    html = _build_html(cases, users_map, group_by)
    buf = BytesIO()
    HTML(string=html).write_pdf(buf)
    buf.seek(0)
    return buf


def _build_html(cases: list, users_map: dict, group_by: str) -> str:
    now = datetime.now(LA)
    date_str = now.strftime("%B %d, %Y")
    count = len(cases)

    subtitle_map = {
        "attorney": "Grouped by Attorney",
        "status": "Grouped by Status",
        "alphabetical": "Alphabetical",
    }
    subtitle = subtitle_map.get(group_by, "")

    if group_by == "attorney":
        body = _render_by_attorney(cases, users_map)
    elif group_by == "status":
        body = _render_by_status(cases, users_map)
    else:
        body = _render_alphabetical(cases, users_map)

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
  <div>
    <div class="report-title">Active Case List</div>
    <div class="report-subtitle">{subtitle}</div>
  </div>
  <div class="report-meta">{date_str} &middot; {count} case{"s" if count != 1 else ""}</div>
</div>

{body}

</body>
</html>"""


def _attorney_name(uid: int, users_map: dict) -> str:
    u = users_map.get(uid)
    if not u:
        return f"User #{uid}"
    name = f"{u.get('first_name', '')} {u.get('last_name', '')}".strip()
    return name or u.get("initials", f"User #{uid}")


def _attorney_names(attorney_ids: list, users_map: dict) -> str:
    if not attorney_ids:
        return "Unassigned"
    return ", ".join(_attorney_name(uid, users_map) for uid in attorney_ids)


def _case_detail_line(c: dict) -> str:
    parts = []
    case_num = c.get("case_number") or ""
    jurisdiction = c.get("jurisdiction_name") or ""
    judge = c.get("judge") or ""

    if case_num:
        parts.append(case_num)
    if jurisdiction:
        parts.append(jurisdiction)
    if judge:
        parts.append(f"Judge {judge}")

    return " — ".join(parts) if parts else ""


def _render_table(cases: list, users_map: dict, show_attorneys: bool = True) -> str:
    rows = ""
    for i, c in enumerate(cases):
        name = escape(c.get("short_name") or c.get("case_name", ""))
        status = escape(c.get("status", ""))
        detail = escape(_case_detail_line(c))
        attorneys = escape(_attorney_names(c.get("attorney_ids"), users_map))
        row_class = "alt-row" if i % 2 == 0 else ""

        attorney_cell = f'<td class="attorneys-col">{attorneys}</td>' if show_attorneys else ""

        rows += f"""<tr class="{row_class}">
          {attorney_cell}
          <td class="name-col">{name}</td>
          <td class="detail-col mono">{detail or em()}</td>
          <td class="status-col"><span class="status-badge {_status_class(c.get('status', ''))}">{status}</span></td>
        </tr>"""

    attorney_header = '<th class="attorneys-th">Attorney(s)</th>' if show_attorneys else ""

    return f"""<table class="case-table">
      <thead>
        <tr>
          {attorney_header}
          <th>Case</th>
          <th>Case No. / Jurisdiction / Judge</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>{rows}</tbody>
    </table>"""


def _render_alphabetical(cases: list, users_map: dict) -> str:
    sorted_cases = sorted(cases, key=lambda c: (c.get("short_name") or c.get("case_name", "")).lower())
    return _render_table(sorted_cases, users_map, show_attorneys=True)


def _render_by_status(cases: list, users_map: dict) -> str:
    status_order = [
        "Signing Up", "Prospective", "Pre-Filing", "Pleadings",
        "Discovery", "Expert Discovery", "Pre-trial", "Trial",
        "Post-Trial", "Appeal", "Settl. Pend.", "Stayed",
    ]

    grouped = defaultdict(list)
    for c in cases:
        grouped[c.get("status", "Unknown")].append(c)

    sections = ""
    for status in status_order:
        group = grouped.get(status)
        if not group:
            continue
        group.sort(key=lambda c: (c.get("short_name") or c.get("case_name", "")).lower())
        sections += f'<div class="group-header">{escape(status)} <span class="group-count">({len(group)})</span></div>'
        sections += _render_table(group, users_map, show_attorneys=True)

    # Any statuses not in the order list
    for status, group in grouped.items():
        if status not in status_order:
            group.sort(key=lambda c: (c.get("short_name") or c.get("case_name", "")).lower())
            sections += f'<div class="group-header">{escape(status)} <span class="group-count">({len(group)})</span></div>'
            sections += _render_table(group, users_map, show_attorneys=True)

    return sections


def _render_by_attorney(cases: list, users_map: dict) -> str:
    grouped = defaultdict(list)
    unassigned = []

    for c in cases:
        aids = c.get("attorney_ids") or []
        if not aids:
            unassigned.append(c)
        else:
            for uid in aids:
                grouped[uid].append(c)

    # Sort attorney groups by name
    sorted_attorneys = sorted(grouped.keys(), key=lambda uid: _attorney_name(uid, users_map).lower())

    sections = ""
    for uid in sorted_attorneys:
        group = grouped[uid]
        group.sort(key=lambda c: (c.get("short_name") or c.get("case_name", "")).lower())
        name = escape(_attorney_name(uid, users_map))
        sections += f'<div class="group-header">{name} <span class="group-count">({len(group)})</span></div>'
        sections += _render_table(group, users_map, show_attorneys=False)

    if unassigned:
        unassigned.sort(key=lambda c: (c.get("short_name") or c.get("case_name", "")).lower())
        sections += f'<div class="group-header">Unassigned <span class="group-count">({len(unassigned)})</span></div>'
        sections += _render_table(unassigned, users_map, show_attorneys=False)

    return sections


def _status_class(status: str) -> str:
    mapping = {
        "Signing Up": "status-signing-up",
        "Prospective": "status-prospective",
        "Pre-Filing": "status-pre-filing",
        "Pleadings": "status-pleadings",
        "Discovery": "status-discovery",
        "Expert Discovery": "status-discovery",
        "Pre-trial": "status-pre-trial",
        "Trial": "status-trial",
        "Post-Trial": "status-post-trial",
        "Appeal": "status-appeal",
        "Settl. Pend.": "status-settlement",
        "Stayed": "status-stayed",
    }
    return mapping.get(status, "")


def em():
    return '<span class="em">—</span>'


def _get_css() -> str:
    return """
    @page {
      size: letter landscape;
      margin: 0.4in 0.5in;
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

    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 6px;
      margin-bottom: 10px;
    }
    .report-title { font-size: 16px; font-weight: 700; color: #0f172a; }
    .report-subtitle { font-size: 9px; color: #64748b; margin-top: 1px; }
    .report-meta { font-size: 8px; color: #94a3b8; white-space: nowrap; }

    .group-header {
      font-size: 11px;
      font-weight: 700;
      color: #0f172a;
      padding: 6px 0 3px;
      margin-top: 8px;
      border-bottom: 1px solid #cbd5e1;
    }
    .group-header:first-child { margin-top: 0; }
    .group-count { font-weight: 400; color: #94a3b8; font-size: 9px; }

    .case-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 2px;
    }
    .case-table thead tr { background: #f1f5f9; }
    .case-table th {
      padding: 3px 6px;
      text-align: left;
      font-size: 7px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .case-table td {
      padding: 3px 6px;
      font-size: 8px;
      border-bottom: 1px solid #f1f5f9;
    }
    .case-table .alt-row { background: #fafbfc; }
    .name-col { font-weight: 600; white-space: nowrap; }
    .detail-col { color: #475569; }
    .attorneys-col { color: #334155; white-space: nowrap; }
    .status-col { white-space: nowrap; }

    .mono {
      font-family: 'JetBrains Mono', 'SF Mono', monospace;
      font-size: 7.5px;
    }

    .status-badge {
      display: inline-block;
      padding: 1px 5px;
      font-size: 7px;
      font-weight: 600;
      background: #f1f5f9;
      color: #475569;
      white-space: nowrap;
    }
    .status-signing-up  { background: #dbeafe; color: #1e40af; }
    .status-prospective  { background: #e0e7ff; color: #3730a3; }
    .status-pre-filing   { background: #fef3c7; color: #92400e; }
    .status-pleadings    { background: #fed7aa; color: #9a3412; }
    .status-discovery    { background: #d1fae5; color: #065f46; }
    .status-pre-trial    { background: #fce7f3; color: #9d174d; }
    .status-trial        { background: #fee2e2; color: #991b1b; }
    .status-post-trial   { background: #f3e8ff; color: #6b21a8; }
    .status-appeal       { background: #e0e7ff; color: #4338ca; }
    .status-settlement   { background: #ccfbf1; color: #0f766e; }
    .status-stayed       { background: #f1f5f9; color: #475569; }

    .em { color: #cbd5e1; }
    """
