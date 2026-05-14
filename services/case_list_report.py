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

# Matches frontend BADGE_COLOR_NAMES order (lib/badge-colors.ts)
AVATAR_COLORS = [
    ("#dc2626", "#ffffff"),  # red
    ("#ea580c", "#ffffff"),  # orange
    ("#d97706", "#1c1917"),  # amber
    ("#ca8a04", "#1c1917"),  # yellow
    ("#65a30d", "#ffffff"),  # lime
    ("#16a34a", "#ffffff"),  # green
    ("#059669", "#ffffff"),  # emerald
    ("#0d9488", "#ffffff"),  # teal
    ("#0891b2", "#ffffff"),  # cyan
    ("#0284c7", "#ffffff"),  # sky
    ("#2563eb", "#ffffff"),  # blue
    ("#4f46e5", "#ffffff"),  # indigo
    ("#7c3aed", "#ffffff"),  # violet
    ("#9333ea", "#ffffff"),  # purple
    ("#c026d3", "#ffffff"),  # fuchsia
    ("#db2777", "#ffffff"),  # pink
]


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


def _avatar_square(uid: int, users_map: dict) -> str:
    u = users_map.get(uid)
    initials = u.get("initials", "?") if u else "?"
    bg, fg = AVATAR_COLORS[uid % len(AVATAR_COLORS)]
    return f'<span class="avatar" style="background:{bg};color:{fg}">{escape(initials)}</span>'


def _avatar_squares(attorney_ids: list, users_map: dict) -> str:
    if not attorney_ids:
        return '<span class="muted">—</span>'
    return "".join(_avatar_square(uid, users_map) for uid in attorney_ids)


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


def _case_name_cell(c: dict) -> str:
    name = escape(c.get("short_name") or c.get("case_name", ""))
    detail = escape(_case_detail_line(c))
    html = f'<span class="case-name">{name}</span>'
    if detail:
        html += f'<br><span class="case-detail">{detail}</span>'
    return html


def _render_table(cases: list, users_map: dict, show_team: bool = True, show_status: bool = True) -> str:
    rows = ""
    for i, c in enumerate(cases):
        row_class = "alt" if i % 2 == 0 else ""

        team_cell = ""
        if show_team:
            team_cell = f'<td class="team-col">{_avatar_squares(c.get("attorney_ids"), users_map)}</td>'

        status_cell = ""
        if show_status:
            status = escape(c.get("status", ""))
            status_cell = f'<td class="status-col"><span class="badge {_status_class(c.get("status", ""))}">{status}</span></td>'

        rows += f'<tr class="{row_class}">{team_cell}<td>{_case_name_cell(c)}</td>{status_cell}</tr>'

    # Header
    team_th = '<th class="team-th"></th>' if show_team else ""
    status_th = "<th>Status</th>" if show_status else ""

    return f"""<table>
      <thead><tr>{team_th}<th>Case</th>{status_th}</tr></thead>
      <tbody>{rows}</tbody>
    </table>"""


def _render_alphabetical(cases: list, users_map: dict) -> str:
    sorted_cases = sorted(cases, key=lambda c: (c.get("short_name") or c.get("case_name", "")).lower())
    return _render_table(sorted_cases, users_map, show_team=True, show_status=True)


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
        badge = f'<span class="badge {_status_class(status)}">{escape(status)}</span>'
        sections += f'<div class="group-header">{badge} <span class="group-count">{len(group)}</span></div>'
        sections += _render_table(group, users_map, show_team=True, show_status=False)

    for status, group in grouped.items():
        if status not in status_order:
            group.sort(key=lambda c: (c.get("short_name") or c.get("case_name", "")).lower())
            badge = f'<span class="badge">{escape(status)}</span>'
            sections += f'<div class="group-header">{badge} <span class="group-count">{len(group)}</span></div>'
            sections += _render_table(group, users_map, show_team=True, show_status=False)

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

    sorted_attorneys = sorted(grouped.keys(), key=lambda uid: _attorney_name(uid, users_map).lower())

    sections = ""
    for uid in sorted_attorneys:
        group = grouped[uid]
        group.sort(key=lambda c: (c.get("short_name") or c.get("case_name", "")).lower())
        avatar = _avatar_square(uid, users_map)
        name = escape(_attorney_name(uid, users_map))
        sections += f'<div class="group-header">{avatar} {name} <span class="group-count">{len(group)}</span></div>'
        sections += _render_table(group, users_map, show_team=False, show_status=True)

    if unassigned:
        unassigned.sort(key=lambda c: (c.get("short_name") or c.get("case_name", "")).lower())
        sections += f'<div class="group-header">Unassigned <span class="group-count">{len(unassigned)}</span></div>'
        sections += _render_table(unassigned, users_map, show_team=False, show_status=True)

    return sections


def _status_class(status: str) -> str:
    mapping = {
        "Signing Up": "s-signup",
        "Prospective": "s-prospect",
        "Pre-Filing": "s-prefiling",
        "Pleadings": "s-pleadings",
        "Discovery": "s-discovery",
        "Expert Discovery": "s-discovery",
        "Pre-trial": "s-pretrial",
        "Trial": "s-trial",
        "Post-Trial": "s-posttrial",
        "Appeal": "s-appeal",
        "Settl. Pend.": "s-settle",
        "Stayed": "s-stayed",
    }
    return mapping.get(status, "")


def _get_css() -> str:
    return """
    @page {
      size: letter;
      margin: 0.4in 0.45in;
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
      font-size: 8px;
      color: #0f172a;
      line-height: 1.3;
    }

    /* ── Header ── */
    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 4px;
      margin-bottom: 6px;
    }
    .report-title { font-size: 14px; font-weight: 700; }
    .report-subtitle { font-size: 8px; color: #64748b; margin-top: 1px; }
    .report-meta { font-size: 7.5px; color: #94a3b8; white-space: nowrap; }

    /* ── Group headers ── */
    .group-header {
      font-size: 10px;
      font-weight: 700;
      color: #0f172a;
      padding: 4px 0 2px;
      margin-top: 6px;
      border-bottom: 1px solid #cbd5e1;
    }
    .group-header:first-child { margin-top: 0; }
    .group-count {
      font-weight: 400;
      color: #94a3b8;
      font-size: 8px;
    }
    .group-count::before { content: "("; }
    .group-count::after { content: ")"; }

    /* ── Avatar squares ── */
    .avatar {
      display: inline-block;
      width: 13px;
      height: 13px;
      line-height: 13px;
      text-align: center;
      font-size: 6.5px;
      font-weight: 700;
      vertical-align: middle;
      margin-right: 1px;
    }

    /* ── Table ── */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 1px;
    }
    thead tr { background: #f1f5f9; }
    th {
      padding: 2px 4px;
      text-align: left;
      font-size: 6.5px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    td {
      padding: 2px 4px;
      font-size: 8px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: middle;
    }
    tr.alt { background: #fafbfc; }

    .team-col { width: 1px; white-space: nowrap; padding-right: 2px; }
    .team-th { width: 1px; }
    .status-col { white-space: nowrap; text-align: right; }

    /* ── Case name + detail ── */
    .case-name { font-weight: 600; font-size: 8px; }
    .case-detail {
      font-family: 'JetBrains Mono', 'SF Mono', monospace;
      font-size: 6.5px;
      color: #64748b;
    }

    /* ── Status badges ── */
    .badge {
      display: inline-block;
      padding: 0px 4px;
      font-size: 6.5px;
      font-weight: 600;
      background: #f1f5f9;
      color: #475569;
      white-space: nowrap;
    }
    .s-signup    { background: #dbeafe; color: #1e40af; }
    .s-prospect  { background: #e0e7ff; color: #3730a3; }
    .s-prefiling { background: #fef3c7; color: #92400e; }
    .s-pleadings { background: #fed7aa; color: #9a3412; }
    .s-discovery { background: #d1fae5; color: #065f46; }
    .s-pretrial  { background: #fce7f3; color: #9d174d; }
    .s-trial     { background: #fee2e2; color: #991b1b; }
    .s-posttrial { background: #f3e8ff; color: #6b21a8; }
    .s-appeal    { background: #e0e7ff; color: #4338ca; }
    .s-settle    { background: #ccfbf1; color: #0f766e; }
    .s-stayed    { background: #f1f5f9; color: #475569; }

    .muted { color: #cbd5e1; }
    """
