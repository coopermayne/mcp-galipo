"""Visual trial calendar PDF — linear week-row layout mirroring the web UI."""

import calendar
import datetime
from io import BytesIO
from html import escape
from lib.tz import LA


def generate_visual_calendar_pdf(
    trials: list,
    blocking_events: list,
    staff_map: dict,
) -> BytesIO:
    from weasyprint import HTML

    html = _build_html(trials, blocking_events, staff_map)
    buf = BytesIO()
    HTML(string=html).write_pdf(buf)
    buf.seek(0)
    return buf


# ---------------------------------------------------------------------------
# Date helpers
# ---------------------------------------------------------------------------

def _parse(s: str) -> datetime.date:
    return datetime.date.fromisoformat(s)


def _add_months(d: datetime.date, n: int) -> datetime.date:
    month = d.month - 1 + n
    year = d.year + month // 12
    month = month % 12 + 1
    day = min(d.day, calendar.monthrange(year, month)[1])
    return datetime.date(year, month, day)


def _add_weekdays(start: datetime.date, count: int) -> datetime.date:
    remaining = count - 1
    cur = start
    while remaining > 0:
        cur += datetime.timedelta(days=1)
        if cur.weekday() < 5:
            remaining -= 1
    return cur


def _is_weekend(d: datetime.date) -> bool:
    return d.weekday() >= 5


def _date_key(d: datetime.date) -> str:
    return d.isoformat()


# ---------------------------------------------------------------------------
# Normalize items (port of calendar-helpers.ts normalizeItems)
# ---------------------------------------------------------------------------

def _normalize_items(trials: list, blocking_events: list, staff_map: dict) -> list[dict]:
    items = []
    for t in trials:
        if not t.get("trial_date"):
            continue
        start = _parse(t["trial_date"])
        end = _add_weekdays(start, max(t.get("trial_estimated_days") or 1, 1))
        short = t.get("short_name") or t.get("case_name", "").split(" ")[0]
        aids = t.get("attorney_ids") or []
        initials = ""
        if aids:
            s = staff_map.get(aids[0])
            if s:
                initials = s.get("initials", "")
        label = f"{short} ({initials})" if initials else short
        items.append({
            "kind": "trial",
            "start": start,
            "end": end,
            "label": label,
            "status": t.get("status", ""),
        })
    for evt in blocking_events:
        if not evt.get("date"):
            continue
        start = _parse(evt["date"])
        end = _parse(evt["end_date"]) if evt.get("end_date") else start
        is_vacation = evt.get("event_type") == "vacation"
        items.append({
            "kind": "vacation" if is_vacation else "event",
            "start": start,
            "end": end,
            "label": evt.get("description", "Event"),
        })
    return items


# ---------------------------------------------------------------------------
# Open days: weekdays not covered by any item (port of computeOpenDays)
# ---------------------------------------------------------------------------

def _compute_open_days(
    items: list[dict],
    range_start: datetime.date,
    range_end: datetime.date,
) -> set[str]:
    covered: set[str] = set()
    for item in items:
        d = max(item["start"], range_start)
        end = min(item["end"], range_end)
        while d <= end:
            covered.add(_date_key(d))
            d += datetime.timedelta(days=1)
    open_days: set[str] = set()
    d = range_start
    while d <= range_end:
        if not _is_weekend(d) and _date_key(d) not in covered:
            open_days.add(_date_key(d))
        d += datetime.timedelta(days=1)
    return open_days


# ---------------------------------------------------------------------------
# Generate Monday-aligned weeks (port of generateWeeks)
# ---------------------------------------------------------------------------

def _generate_weeks(
    range_start: datetime.date,
    range_end: datetime.date,
) -> list[list[datetime.date]]:
    monday = range_start - datetime.timedelta(days=range_start.weekday())
    weeks = []
    while monday <= range_end:
        week = [monday + datetime.timedelta(days=i) for i in range(7)]
        weeks.append(week)
        monday += datetime.timedelta(days=7)
    return weeks


# ---------------------------------------------------------------------------
# Process week: clip items, assign lanes, detect conflicts
# (port of processWeek from calendar-helpers.ts)
# ---------------------------------------------------------------------------

def _process_week(
    week_days: list[datetime.date],
    all_items: list[dict],
) -> dict:
    week_start = week_days[0]
    week_end = week_days[6]

    clipped = []
    for item in all_items:
        if item["start"] > week_end or item["end"] < week_start:
            continue
        cs = -1
        ce = -1
        for i in range(7):
            if week_days[i] >= item["start"] and week_days[i] <= item["end"]:
                if cs == -1:
                    cs = i
                ce = i
        if cs >= 0:
            clipped.append({"item": item, "col_start": cs, "col_end": ce})

    clipped.sort(key=lambda c: (
        c["col_start"],
        -(c["col_end"] - c["col_start"]),
    ))

    lane_ends: list[int] = []
    result_items = []
    for c in clipped:
        lane = -1
        for i, end in enumerate(lane_ends):
            if end < c["col_start"]:
                lane = i
                break
        if lane == -1:
            lane = len(lane_ends)
            lane_ends.append(-1)
        lane_ends[lane] = c["col_end"]
        result_items.append({**c, "lane": lane})

    conflict_columns: set[int] = set()
    for col in range(7):
        count = sum(1 for ci in result_items if col >= ci["col_start"] and col <= ci["col_end"])
        if count >= 2:
            conflict_columns.add(col)

    return {
        "items": result_items,
        "lane_count": max(len(lane_ends), 1),
        "conflict_columns": conflict_columns,
    }


# ---------------------------------------------------------------------------
# Build all week rows with labels (port of buildWeekRows)
# ---------------------------------------------------------------------------

def _build_week_rows(
    weeks: list[list[datetime.date]],
    all_items: list[dict],
) -> list[dict]:
    last_month = -1
    rows = []
    for days in weeks:
        result = _process_week(days, all_items)
        monday = days[0]
        mid = days[2]
        m_num = mid.month
        is_first = m_num != last_month
        if is_first:
            last_month = m_num

        month_label = mid.strftime("%B") if is_first else None
        week_label = str(mid.year) if is_first else f"{monday.strftime('%b')} {monday.day}"

        rows.append({
            "monday": monday,
            "days": days,
            "items": result["items"],
            "lane_count": result["lane_count"],
            "conflict_columns": result["conflict_columns"],
            "month_label": month_label,
            "week_label": week_label,
        })
    return rows


# ---------------------------------------------------------------------------
# HTML rendering — linear week rows matching the web UI
# ---------------------------------------------------------------------------

DAYNUM_H = 14   # pt for day number row
LANE_H = 14     # pt per lane
LANE_GAP = 1    # pt between lanes
BOTTOM_PAD = 2  # pt padding at bottom of week
GUTTER_W = 58   # pt for left gutter

# Theme colors (oklch → hex approximations from index.css)
CLR_FG = "#1a1a1a"
CLR_MUTED_FG = "#808080"
CLR_BORDER = "#e5e5e5"
CLR_MUTED_BG = "#f5f5f5"
CLR_DESTRUCTIVE = "#d93636"
CLR_INFO = "#2563eb"
CLR_SUCCESS = "#16a34a"
CLR_PRIMARY = "#2563eb"

DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def _row_height(lane_count: int) -> int:
    return (
        DAYNUM_H
        + lane_count * LANE_H
        + max(lane_count - 1, 0) * LANE_GAP
        + BOTTOM_PAD
    )


def _render_week_row(week: dict, today: datetime.date, open_days: set[str]) -> str:
    h = _row_height(week["lane_count"])
    has_conflict = len(week["conflict_columns"]) > 0
    border_cls = ' month-start' if week["month_label"] else ''

    # Gutter
    gutter = '<div class="gutter">'
    if week["month_label"]:
        gutter += f'<span class="month-lbl">{escape(week["month_label"])}</span>'
    gutter += f'<span class="week-lbl">{escape(week["week_label"])}</span>'
    if has_conflict:
        gutter += '<span class="conflict-badge">CONFLICT</span>'
    gutter += '</div>'

    # Day cells (background grid)
    cells = ""
    for col, day in enumerate(week["days"]):
        dk = _date_key(day)
        is_we = col >= 5
        is_today = day == today
        is_conflict = col in week["conflict_columns"]
        is_open = dk in open_days

        cls = "day-cell"
        if is_we:
            cls += " weekend"
        if is_today:
            cls += " today"

        overlay = ""
        if is_conflict:
            overlay = f'<div class="cell-overlay" style="background:{CLR_DESTRUCTIVE};opacity:0.07"></div>'
        elif is_open and not is_we:
            overlay = f'<div class="cell-overlay" style="background:{CLR_SUCCESS};opacity:0.07"></div>'

        num_cls = "day-num"
        if is_today:
            num_cls += " today-num"
        elif is_we:
            num_cls += " weekend-num"

        cells += f'<div class="{cls}">{overlay}<span class="{num_cls}">{day.day}</span></div>'

    # Lane bars (overlay)
    bars = ""
    for ci in week["items"]:
        item = ci["item"]
        left = f"{(ci['col_start'] / 7) * 100:.3f}%"
        width = f"{((ci['col_end'] - ci['col_start'] + 1) / 7) * 100:.3f}%"
        top = DAYNUM_H + ci["lane"] * (LANE_H + LANE_GAP)

        if item["kind"] == "vacation":
            bg = CLR_INFO
            opacity = 1.0
        elif item["kind"] == "event":
            bg = CLR_DESTRUCTIVE
            opacity = 1.0
        else:
            bg = CLR_DESTRUCTIVE
            opacity = 1.0

        stale = item.get("status", "") in ("Settl. Pend.", "Closed")
        stale_html = f' <span class="bar-stale">{escape(item["status"])}</span>' if stale else ""

        bars += (
            f'<div class="bar" style="left:{left};width:{width};top:{top}pt;'
            f'background:{bg};opacity:{opacity:.2f}">'
            f'<span class="bar-label">{escape(item["label"])}{stale_html}</span></div>'
        )

    return (
        f'<div class="week-row{border_cls}" style="height:{h}pt">'
        f'{gutter}'
        f'<div class="day-area">'
        f'<div class="day-grid" style="height:{h}pt">{cells}</div>'
        f'<div class="bar-layer" style="height:{h}pt">{bars}</div>'
        f'</div>'
        f'</div>'
    )


def _group_rows_by_month(week_rows: list[dict]) -> list[list[dict]]:
    """Group week rows by month. A week belongs to the month of its Wednesday."""
    groups: list[list[dict]] = []
    current_month = -1
    for row in week_rows:
        mid = row["days"][2]  # Wednesday
        if mid.month != current_month:
            current_month = mid.month
            groups.append([])
        groups[-1].append(row)
    return groups


# ---------------------------------------------------------------------------
# Greedy page packing — fit as many months per page as possible
# ---------------------------------------------------------------------------

# Letter portrait: 11in = 792pt, margins 0.35in top + 0.3in bottom = 46.8pt
_PAGE_USABLE = 740       # pt available (slightly conservative)
_HEADER_LEGEND_H = 40    # header + legend on first page
_CAL_OVERHEAD = 14       # day-header row + calendar border per page

def _month_group_height(rows: list[dict]) -> float:
    h = 0.0
    for i, row in enumerate(rows):
        h += _row_height(row["lane_count"])
        h += 0.5  # border-bottom
        if i == 0:
            h += 1.5  # month-start border-top
    return h


def _pack_pages(month_groups: list[list[dict]]) -> list[list[list[dict]]]:
    """Greedily pack month groups into pages based on computed heights."""
    pages: list[list[list[dict]]] = []
    current_page: list[list[dict]] = []
    is_first = True
    budget = _PAGE_USABLE - _HEADER_LEGEND_H - _CAL_OVERHEAD
    used = 0.0

    for group in month_groups:
        gh = _month_group_height(group)
        if current_page and used + gh > budget:
            pages.append(current_page)
            current_page = []
            is_first = False
            budget = _PAGE_USABLE - _CAL_OVERHEAD
            used = 0.0
        current_page.append(group)
        used += gh

    if current_page:
        pages.append(current_page)
    return pages


def _build_html(trials: list, blocking_events: list, staff_map: dict) -> str:
    now = datetime.datetime.now(LA)
    today = now.date()
    date_str = now.strftime("%B %d, %Y")

    items = _normalize_items(trials, blocking_events, staff_map)

    range_start = today.replace(day=1)
    range_end = _add_months(range_start, 24)
    range_end = datetime.date(
        range_end.year,
        range_end.month,
        calendar.monthrange(range_end.year, range_end.month)[1],
    )

    open_days = _compute_open_days(items, range_start, range_end)
    weeks = _generate_weeks(range_start, range_end)
    week_rows = _build_week_rows(weeks, items)

    range_label = f"{range_start.strftime('%b %Y')} – {range_end.strftime('%b %Y')}"

    month_groups = _group_rows_by_month(week_rows)

    day_header_cells = ""
    for i, d in enumerate(DAY_HEADERS):
        cls = "dh weekend-dh" if i >= 5 else "dh"
        day_header_cells += f'<div class="{cls}">{d}</div>'

    day_header_row = (
        f'<div class="day-header-row">'
        f'<div class="gutter"></div>'
        f'<div class="day-area"><div class="day-grid">{day_header_cells}</div></div>'
        f'</div>'
    )

    pages = _pack_pages(month_groups)

    pages_html = ""
    for pi, page_groups in enumerate(pages):
        if pi == 0:
            header = (
                f'<div class="hdr">'
                f'<div class="title">Trial Calendar</div>'
                f'<div class="meta">{date_str} &middot; {range_label}</div>'
                f'</div>'
            )
            pages_html += header
            pages_html += _legend()

        rows_html = ""
        for month_rows in page_groups:
            for row in month_rows:
                rows_html += _render_week_row(row, today, open_days)

        pages_html += f'<div class="calendar">{day_header_row}{rows_html}</div>'

        if pi < len(pages) - 1:
            pages_html += '<div class="page-break"></div>'

    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>{_get_css()}</style>
</head>
<body>
{pages_html}
</body>
</html>"""


def _legend() -> str:
    return f"""<div class="legend">
<span class="leg-item"><span class="leg-swatch" style="background:{CLR_DESTRUCTIVE}"></span> Trial</span>
<span class="leg-item"><span class="leg-swatch" style="background:{CLR_INFO}"></span> Vacation</span>
<span class="leg-item"><span class="leg-swatch" style="background:{CLR_SUCCESS};opacity:0.4"></span> Open day</span>
</div>"""


def _get_css() -> str:
    return f"""
@page {{
  size: letter portrait;
  margin: 0.35in 0.35in 0.3in 0.35in;
}}

* {{ margin: 0; padding: 0; box-sizing: border-box; }}

body {{
  font-family: "JetBrains Mono", "SF Mono", "Menlo", "Consolas", monospace;
  font-size: 7pt;
  color: {CLR_FG};
  line-height: 1.2;
}}

.hdr {{ margin-bottom: 4pt; }}
.title {{ font-size: 11pt; font-weight: 700; letter-spacing: -0.02em; }}
.meta {{ font-size: 6.5pt; color: {CLR_MUTED_FG}; margin-top: 1pt; }}

.legend {{
  display: flex;
  gap: 10pt;
  align-items: center;
  margin-bottom: 4pt;
}}
.leg-item {{
  font-size: 6pt;
  color: {CLR_MUTED_FG};
  display: flex;
  align-items: center;
  gap: 2pt;
}}
.leg-swatch {{
  display: inline-block;
  width: 10pt;
  height: 5pt;
}}
.leg-note {{ font-style: italic; color: #aaa; }}

.calendar {{
  border: 0.5pt solid {CLR_BORDER};
}}

/* Day header row */
.day-header-row {{
  display: flex;
  border-bottom: 0.5pt solid {CLR_BORDER};
}}
.day-header-row .gutter {{
  width: {GUTTER_W}pt;
  min-width: {GUTTER_W}pt;
  border-right: 0.5pt solid {CLR_BORDER};
}}
.day-header-row .day-area {{
  flex: 1;
}}
.day-header-row .day-grid {{
  display: flex;
}}
.dh {{
  width: 14.2857%;
  text-align: center;
  font-size: 6pt;
  font-weight: 600;
  color: {CLR_MUTED_FG};
  padding: 2pt 0;
}}
.dh.weekend-dh {{
  color: #bbb;
}}

/* Week rows */
.week-row {{
  display: flex;
  page-break-inside: avoid;
  border-bottom: 0.5pt solid {CLR_BORDER};
}}
.week-row.month-start {{
  border-top: 1.5pt solid {CLR_FG};
}}

/* Gutter */
.gutter {{
  width: {GUTTER_W}pt;
  min-width: {GUTTER_W}pt;
  border-right: 0.5pt solid {CLR_BORDER};
  padding: 2pt 4pt;
  display: flex;
  flex-direction: column;
}}
.month-lbl {{
  font-size: 7.5pt;
  font-weight: 700;
  color: {CLR_FG};
  line-height: 1.1;
}}
.week-lbl {{
  font-size: 6pt;
  color: {CLR_MUTED_FG};
  line-height: 1.1;
}}
.conflict-badge {{
  display: inline-block;
  background: {CLR_DESTRUCTIVE};
  color: #fff;
  font-size: 5pt;
  font-weight: 700;
  padding: 0.5pt 2pt;
  margin-top: 1pt;
  align-self: flex-start;
}}

/* Day area */
.day-area {{
  flex: 1;
  position: relative;
}}

.day-grid {{
  display: flex;
  position: relative;
}}
.day-grid > .day-cell {{
  width: 14.2857%;
  position: relative;
  border-right: 0.25pt solid rgba(0,0,0,0.06);
}}
.day-grid > .day-cell:last-child {{
  border-right: none;
}}
.day-cell.weekend {{
  background: {CLR_MUTED_BG};
}}
.day-cell.today {{
  box-shadow: inset 0 0 0 1pt {CLR_PRIMARY};
}}

.cell-overlay {{
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}}

.day-num {{
  position: relative;
  z-index: 1;
  display: block;
  padding: 1pt 0 0 2pt;
  font-size: 6pt;
  line-height: 1;
  color: rgba(0,0,0,0.35);
}}
.day-num.today-num {{
  font-weight: 700;
  color: {CLR_PRIMARY};
}}
.day-num.weekend-num {{
  color: rgba(0,0,0,0.18);
}}

/* Bar layer */
.bar-layer {{
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
}}
.bar {{
  position: absolute;
  height: {LANE_H}pt;
  overflow: hidden;
  white-space: nowrap;
  display: flex;
  align-items: center;
  padding: 0 2pt;
}}
.bar-label {{
  font-size: 5.5pt;
  font-weight: 500;
  line-height: 1;
  color: #fff;
}}
.bar-stale {{
  font-size: 4.5pt;
  font-weight: 700;
  background: rgba(255,255,255,0.85);
  color: #92400e;
  padding: 0.5pt 1.5pt;
  margin-left: 1pt;
}}

.page-break {{
  page-break-after: always;
}}

.calendar + .calendar {{
  margin-top: 4pt;
}}
"""
