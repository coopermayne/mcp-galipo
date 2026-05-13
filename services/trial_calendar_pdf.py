"""Trial calendar PDF generator — portrait table with likelihood bars."""

from io import BytesIO
from html import escape
from datetime import datetime
from lib.tz import LA

PALETTE = [
    "#dc2626", "#ea580c", "#d97706", "#ca8a04",
    "#65a30d", "#16a34a", "#059669", "#0d9488",
    "#0891b2", "#0284c7", "#2563eb", "#4f46e5",
    "#7c3aed", "#9333ea", "#c026d3", "#db2777",
]


def generate_trial_calendar_pdf(trials: list, staff_map: dict) -> BytesIO:
    from weasyprint import HTML
    html = _build_html(trials, staff_map)
    buf = BytesIO()
    HTML(string=html).write_pdf(buf)
    buf.seek(0)
    return buf


def _avatar_color(uid: int) -> str:
    return PALETTE[uid % len(PALETTE)]


def _build_html(trials: list, staff_map: dict) -> str:
    now = datetime.now(LA)
    date_str = now.strftime("%B %d, %Y")

    rows = ""
    for i, t in enumerate(trials):
        case_name = escape(t.get("case_name", ""))

        chips = []
        for aid in t.get("attorney_ids") or []:
            s = staff_map.get(aid)
            if s:
                initials = escape(s.get("initials") or "")
                bg = _avatar_color(aid)
                chips.append(
                    f'<span class="avatar" style="background:{bg}">{initials}</span>'
                )
        attorneys_html = " ".join(chips) if chips else em()

        jurisdiction = escape(t.get("jurisdiction_name") or "")
        judge_names = t.get("judge_names") or ""
        case_number = escape(t.get("case_number") or "")
        if jurisdiction and judge_names:
            jur_line = f"{jurisdiction} ({escape(judge_names)})"
        elif jurisdiction:
            jur_line = jurisdiction
        else:
            jur_line = em()
        if case_number:
            jur_line += f'<br><span class="case-num">{case_number}</span>'

        trial_date = t.get("trial_date", "")
        if trial_date:
            from datetime import date as _date
            d = _date.fromisoformat(trial_date)
            date_display = f"{d.strftime('%b')} {d.day}, {d.year}"
        else:
            date_display = em()

        days = t.get("trial_estimated_days")
        days_display = f"({days}d)" if days else ""

        likelihood = t.get("trial_likelihood") or 0
        bar_html = _render_bar(likelihood)

        row_cls = "alt" if i % 2 == 0 else ""
        rows += f"""<tr class="{row_cls}">
          <td class="col-atty">{attorneys_html}</td>
          <td class="col-case">{case_name}</td>
          <td class="col-jur">{jur_line}</td>
          <td class="col-trial">{bar_html} {date_display} <span class="days">{days_display}</span></td>
        </tr>\n"""

    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>{_get_css()}</style>
</head>
<body>
<div class="header">
  <div class="title">Trial Calendar</div>
  <div class="meta">{date_str} &middot; {len(trials)} trial{"s" if len(trials) != 1 else ""}</div>
</div>
<table>
  <thead>
    <tr>
      <th class="col-atty">Assigned</th>
      <th class="col-case">Case</th>
      <th class="col-jur">Jurisdiction</th>
      <th class="col-trial">Trial</th>
    </tr>
  </thead>
  <tbody>
    {rows}
  </tbody>
</table>
</body>
</html>"""


def _render_bar(pct: int) -> str:
    filled = round(pct / 10)
    segments = ""
    for i in range(10):
        cls = "on" if i < filled else "off"
        segments += f'<span class="seg {cls}"></span>'
    return f'<span class="bar">{segments}</span>'


def em():
    return '<span class="em">—</span>'


def _get_css() -> str:
    return """
@page {
  size: letter portrait;
  margin: 0.6in 0.5in;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 9pt;
  color: #1a1a1a;
  line-height: 1.35;
}

.header { margin-bottom: 14pt; }
.title { font-size: 14pt; font-weight: 700; letter-spacing: -0.02em; }
.meta { font-size: 8pt; color: #666; margin-top: 2pt; }

table {
  width: 100%;
  border-collapse: collapse;
}

thead tr {
  border-bottom: 1.5pt solid #1a1a1a;
}

th {
  font-size: 7pt;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #666;
  text-align: left;
  padding: 4pt 6pt;
}

td {
  padding: 5pt 6pt;
  vertical-align: middle;
  border-bottom: 0.5pt solid #e0e0e0;
}

tr.alt { background: #f8f8f8; }

.col-atty { width: 10%; }
.col-case { width: 32%; font-style: italic; }
.col-jur { width: 32%; }
.col-trial { width: 26%; white-space: nowrap; font-variant-numeric: tabular-nums; }

.avatar {
  display: inline-block;
  width: 16pt;
  height: 16pt;
  line-height: 16pt;
  text-align: center;
  color: #fff;
  font-size: 6.5pt;
  font-weight: 600;
  margin-right: 1pt;
}

.case-num {
  font-family: "SF Mono", "Menlo", monospace;
  font-size: 7.5pt;
  color: #666;
}

.bar {
  display: inline-block;
  vertical-align: middle;
  margin-right: 4pt;
  line-height: 0;
}

.seg {
  display: inline-block;
  width: 3pt;
  height: 9pt;
  margin-right: 0.5pt;
}

.seg.on { background: #999; }
.seg.off { background: #ddd; }

.days {
  font-size: 7.5pt;
  color: #888;
  margin-left: 2pt;
}

.em { color: #bbb; }
"""
