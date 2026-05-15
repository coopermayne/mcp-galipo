"""
Active case list PDF generator.

Generates a compact, grouped case list PDF.
Three grouping modes: by attorney, by status, or alphabetical.
"""

import math
from io import BytesIO
from html import escape
from collections import defaultdict
from datetime import datetime
from lib.tz import LA

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
        "attorney": "By Attorney",
        "status": "By Status",
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

<div class="header">
  <div class="header-left">
    <span class="title">Active Case List</span>
    <span class="subtitle">{subtitle} &middot; {count} cases</span>
  </div>
  <div class="date">{date_str}</div>
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
        return ""
    return "".join(_avatar_square(uid, users_map) for uid in attorney_ids)


def _case_detail(c: dict) -> str:
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
    return " · ".join(parts) if parts else ""


def _case_name(c: dict) -> str:
    return c.get("case_name") or c.get("short_name") or ""


def _render_case_row(c: dict, users_map: dict, show_team: bool = True, show_status: bool = True, indent: bool = False) -> str:
    name = escape(_case_name(c))
    detail = escape(_case_detail(c))

    team_html = ""
    if show_team:
        squares = _avatar_squares(c.get("attorney_ids"), users_map)
        team_html = f'<span class="team">{squares}</span>' if squares else ""

    status_html = ""
    if show_status:
        status = c.get("status", "")
        status_html = f'<span class="badge {_status_class(status)}">{escape(status)}</span>'

    detail_html = f' <span class="detail">{detail}</span>' if detail else ""
    row_class = "row indent" if indent else "row"

    return f'<div class="{row_class}">{team_html}<span class="name">{name}</span>{detail_html}{status_html}</div>\n'


def _render_case_list(cases: list, users_map: dict, show_team: bool = True, show_status: bool = True, indent: bool = False) -> str:
    return "".join(_render_case_row(c, users_map, show_team, show_status, indent) for c in cases)


PIE_COLORS = [
    "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
    "#ec4899", "#06b6d4", "#f97316", "#6366f1", "#14b8a6",
    "#e11d48", "#84cc16", "#0ea5e9", "#a855f7", "#64748b",
]

STATUS_BAR_COLORS = {
    "Signing Up": "#60a5fa",
    "Prospective": "#818cf8",
    "Pre-Filing": "#fbbf24",
    "Pleadings": "#fb923c",
    "Discovery": "#34d399",
    "Expert Discovery": "#2dd4bf",
    "Pre-trial": "#f472b6",
    "Trial": "#f87171",
    "Post-Trial": "#c084fc",
    "Appeal": "#818cf8",
    "Settl. Pend.": "#2dd4bf",
    "Stayed": "#94a3b8",
}


def _svg_pie(slices, size=80):
    total = sum(count for _, count, _ in slices)
    if not total:
        return ""
    r = size / 2
    cx, cy = r, r
    paths = []
    start = -90

    for _, count, color in slices:
        if count <= 0:
            continue
        sweep = (count / total) * 360
        if sweep >= 359.99:
            paths.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{color}"/>')
        else:
            end = start + sweep
            sr, er = math.radians(start), math.radians(end)
            x1 = cx + r * math.cos(sr)
            y1 = cy + r * math.sin(sr)
            x2 = cx + r * math.cos(er)
            y2 = cy + r * math.sin(er)
            large = 1 if sweep > 180 else 0
            paths.append(
                f'<path d="M{cx},{cy} L{x1:.1f},{y1:.1f} A{r},{r} 0 {large},1 {x2:.1f},{y2:.1f}Z" fill="{color}"/>'
            )
        start += sweep

    return f'<svg width="{size}" height="{size}" viewBox="0 0 {size} {size}">{"".join(paths)}</svg>'


def _render_pie_with_legend(slices):
    svg = _svg_pie(slices)
    legend = ""
    for label, count, color in slices:
        if count <= 0:
            continue
        legend += (
            f'<div class="legend-row">'
            f'<span class="legend-swatch" style="background:{color}"></span>'
            f'<span class="legend-label">{escape(label)}</span>'
            f'<span class="legend-val">{count}</span>'
            f'</div>\n'
        )
    return f'<div class="pie-chart">{svg}<div class="pie-legend">{legend}</div></div>\n'


def _render_bar_chart(bars):
    max_count = max(count for _, count, _ in bars) if bars else 1
    rows = ""
    for label, count, color in bars:
        if count <= 0:
            continue
        pct = (count / max_count) * 100
        rows += (
            f'<div class="bar-row">'
            f'<span class="bar-label">{escape(label)}</span>'
            f'<span class="bar-track"><span class="bar" style="width:{pct:.0f}%;background:{color}"></span></span>'
            f'<span class="bar-val">{count}</span>'
            f'</div>\n'
        )
    return f'<div class="bar-chart">{rows}</div>\n'


def _render_alphabetical(cases: list, users_map: dict) -> str:
    sorted_cases = sorted(cases, key=lambda c: _case_name(c).lower())

    jurisdictions = defaultdict(int)
    for c in cases:
        j = c.get("jurisdiction_name") or "Unspecified"
        jurisdictions[j] += 1
    sorted_j = sorted(jurisdictions.items(), key=lambda x: -x[1])
    slices = [(label, count, PIE_COLORS[i % len(PIE_COLORS)]) for i, (label, count) in enumerate(sorted_j)]
    chart = _render_pie_with_legend(slices)

    return chart + _render_case_list(sorted_cases, users_map, show_team=True, show_status=True)


def _render_by_status(cases: list, users_map: dict) -> str:
    status_order = [
        "Signing Up", "Prospective", "Pre-Filing", "Pleadings",
        "Discovery", "Expert Discovery", "Pre-trial", "Trial",
        "Post-Trial", "Appeal", "Settl. Pend.", "Stayed",
    ]

    grouped = defaultdict(list)
    for c in cases:
        grouped[c.get("status", "Unknown")].append(c)

    bars = []
    for status in status_order:
        count = len(grouped.get(status, []))
        if count > 0:
            bars.append((status, count, STATUS_BAR_COLORS.get(status, "#94a3b8")))
    for status in grouped:
        if status not in status_order and grouped[status]:
            bars.append((status, len(grouped[status]), "#94a3b8"))
    chart = _render_bar_chart(bars)

    sections = ""
    for status in status_order:
        group = grouped.get(status)
        if not group:
            continue
        group.sort(key=lambda c: _case_name(c).lower())
        badge = f'<span class="badge {_status_class(status)}">{escape(status)}</span>'
        sections += f'<div class="group-header">{badge} <span class="count">{len(group)}</span></div>\n'
        sections += _render_case_list(group, users_map, show_team=True, show_status=False, indent=True)

    for status, group in grouped.items():
        if status not in status_order:
            group.sort(key=lambda c: _case_name(c).lower())
            badge = f'<span class="badge">{escape(status)}</span>'
            sections += f'<div class="group-header">{badge} <span class="count">{len(group)}</span></div>\n'
            sections += _render_case_list(group, users_map, show_team=True, show_status=False, indent=True)

    return chart + sections


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

    slices = []
    for uid in sorted_attorneys:
        bg, _ = AVATAR_COLORS[uid % len(AVATAR_COLORS)]
        slices.append((_attorney_name(uid, users_map), len(grouped[uid]), bg))
    if unassigned:
        slices.append(("Unassigned", len(unassigned), "#94a3b8"))
    chart = _render_pie_with_legend(slices)

    sections = ""
    for uid in sorted_attorneys:
        group = grouped[uid]
        group.sort(key=lambda c: _case_name(c).lower())
        avatar = _avatar_square(uid, users_map)
        name = escape(_attorney_name(uid, users_map))
        sections += f'<div class="group-header">{avatar} {name} <span class="count">{len(group)}</span></div>\n'
        sections += _render_case_list(group, users_map, show_team=False, show_status=True, indent=True)

    if unassigned:
        unassigned.sort(key=lambda c: _case_name(c).lower())
        sections += f'<div class="group-header">Unassigned <span class="count">{len(unassigned)}</span></div>\n'
        sections += _render_case_list(unassigned, users_map, show_team=False, show_status=True, indent=True)

    return chart + sections


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
      margin: 0.35in 0.4in;
      @bottom-right {
        content: counter(page);
        font-family: 'Helvetica Neue', 'Inter', sans-serif;
        font-size: 7pt;
        color: #94a3b8;
      }
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Helvetica Neue', 'Inter', 'Segoe UI', sans-serif;
      font-size: 9.5pt;
      color: #1e293b;
      line-height: 1.25;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      border-bottom: 1.5pt solid #1e293b;
      padding-bottom: 4pt;
      margin-bottom: 6pt;
    }
    .header-left { display: flex; align-items: baseline; gap: 8pt; }
    .title { font-size: 14pt; font-weight: 700; white-space: nowrap; }
    .subtitle { font-size: 8.5pt; color: #64748b; white-space: nowrap; }
    .date { font-size: 8.5pt; color: #64748b; white-space: nowrap; }

    .group-header {
      font-size: 10pt;
      font-weight: 700;
      color: #1e293b;
      padding: 2pt 0;
      margin-top: 6pt;
      border-bottom: 0.75pt solid #cbd5e1;
    }
    .group-header:first-child { margin-top: 0; }
    .count {
      font-weight: 400;
      color: #94a3b8;
      font-size: 8.5pt;
    }
    .count::before { content: "("; }
    .count::after { content: ")"; }

    .avatar {
      display: inline-block;
      width: 13pt;
      height: 13pt;
      line-height: 13pt;
      text-align: center;
      font-size: 6.5pt;
      font-weight: 700;
      vertical-align: middle;
      margin-right: 1pt;
    }

    /* ── Charts ── */
    .pie-chart {
      display: flex;
      align-items: flex-start;
      gap: 10pt;
      margin-bottom: 8pt;
      padding: 6pt 0;
      border-bottom: 0.5pt solid #e2e8f0;
    }
    .pie-legend { flex: 1; padding-top: 2pt; }
    .legend-row {
      display: flex;
      align-items: center;
      gap: 4pt;
      padding: 1pt 0;
      font-size: 8pt;
    }
    .legend-swatch {
      width: 8pt;
      height: 8pt;
      display: inline-block;
      flex-shrink: 0;
    }
    .legend-label { flex: 1; color: #374151; }
    .legend-val { font-weight: 600; color: #1e293b; min-width: 14pt; text-align: right; }

    .bar-chart {
      margin-bottom: 8pt;
      padding: 6pt 0;
      border-bottom: 0.5pt solid #e2e8f0;
    }
    .bar-row {
      display: flex;
      align-items: center;
      gap: 4pt;
      padding: 1.5pt 0;
    }
    .bar-label {
      width: 75pt;
      font-size: 7.5pt;
      text-align: right;
      color: #64748b;
      flex-shrink: 0;
    }
    .bar-track {
      flex: 1;
      height: 10pt;
      background: #f1f5f9;
    }
    .bar {
      display: block;
      height: 100%;
      min-width: 2pt;
    }
    .bar-val {
      width: 16pt;
      font-size: 7.5pt;
      font-weight: 600;
      text-align: right;
      flex-shrink: 0;
    }

    /* ── Rows ── */
    .row {
      padding: 1.5pt 0;
      border-bottom: 0.25pt solid #e8ecf0;
      line-height: 1.3;
    }
    .row.indent { padding-left: 14pt; }

    .team {
      margin-right: 3pt;
    }

    .name {
      font-weight: 600;
      font-size: 9.5pt;
    }

    .detail {
      font-size: 7.5pt;
      color: #64748b;
      margin-left: 2pt;
    }
    .detail::before { content: "— "; }

    .badge {
      display: inline-block;
      padding: 0 3pt;
      font-size: 7pt;
      font-weight: 600;
      background: #f1f5f9;
      color: #475569;
      white-space: nowrap;
      margin-left: 3pt;
      vertical-align: middle;
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
    """
