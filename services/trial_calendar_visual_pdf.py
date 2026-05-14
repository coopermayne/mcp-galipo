"""Visual trial calendar PDF — month-card grid mirroring the web UI."""

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

def _add_months(d: datetime.date, n: int) -> datetime.date:
    month = d.month - 1 + n
    year = d.year + month // 12
    month = month % 12 + 1
    day = min(d.day, calendar.monthrange(year, month)[1])
    return datetime.date(year, month, day)


def _parse(s: str) -> datetime.date:
    return datetime.date.fromisoformat(s)


def _monday_idx(d: datetime.date) -> int:
    return (d.weekday()) % 7  # Monday=0


def _add_weekdays(start: datetime.date, count: int) -> datetime.date:
    remaining = count - 1
    cur = start
    while remaining > 0:
        cur += datetime.timedelta(days=1)
        if cur.weekday() < 5:
            remaining -= 1
    return cur


def _get_month_weeks(year: int, month: int) -> list[list[datetime.date | None]]:
    first = datetime.date(year, month, 1)
    last = datetime.date(year, month, calendar.monthrange(year, month)[1])
    cursor = first - datetime.timedelta(days=_monday_idx(first))
    weeks = []
    while True:
        week = []
        for _ in range(7):
            if cursor.month == month and cursor.year == year:
                week.append(cursor)
            else:
                week.append(None)
            cursor += datetime.timedelta(days=1)
        weeks.append(week)
        if cursor > last:
            break
    return weeks


# ---------------------------------------------------------------------------
# Lane stacking (port of buildWeekSegments)
# ---------------------------------------------------------------------------

def _build_week_segments(
    week: list[datetime.date | None],
    month_start: datetime.date,
    month_end: datetime.date,
    trials: list,
    blocking_events: list,
    staff_map: dict,
) -> list[dict]:
    dates = [d for d in week if d is not None]
    if not dates:
        return []

    week_start = dates[0]
    week_end = dates[-1]
    segments = []

    for trial in trials:
        if not trial.get("trial_date"):
            continue
        t_start = _parse(trial["trial_date"])
        t_end = _add_weekdays(t_start, max(trial.get("trial_estimated_days") or 1, 1))

        clip_start = max(t_start, month_start)
        clip_end = min(t_end, month_end)
        if clip_start > week_end or clip_end < week_start:
            continue

        seg_start = max(clip_start, week_start)
        seg_end = min(clip_end, week_end)

        short = trial.get("short_name") or (trial.get("case_name", "").split(" ")[0])
        aids = trial.get("attorney_ids") or []
        initials = ""
        if aids:
            s = staff_map.get(aids[0])
            if s:
                initials = s.get("initials", "")
        label = f"{short} ({initials})" if initials else short
        likelihood = trial.get("trial_likelihood") or 50

        segments.append({
            "type": "trial",
            "label": label,
            "start_col": _monday_idx(seg_start),
            "end_col": _monday_idx(seg_end),
            "opacity": max(likelihood / 100, 0.2),
            "lane": 0,
        })

    for evt in blocking_events:
        if not evt.get("date"):
            continue
        e_start = _parse(evt["date"])
        e_end = _parse(evt["end_date"]) if evt.get("end_date") else e_start
        is_vacation = evt.get("event_type") == "vacation"

        clip_start = max(e_start, month_start)
        clip_end = min(e_end, month_end)
        if clip_start > week_end or clip_end < week_start:
            continue

        seg_start = max(clip_start, week_start)
        seg_end = min(clip_end, week_end)

        if is_vacation:
            segments.append({
                "type": "vacation",
                "label": evt.get("description", "Vacation"),
                "start_col": _monday_idx(seg_start),
                "end_col": _monday_idx(seg_end),
                "opacity": 0.7,
                "lane": 0,
            })
        else:
            segments.append({
                "type": "dot",
                "label": "",
                "start_col": _monday_idx(seg_start),
                "end_col": _monday_idx(seg_start),
                "opacity": 1,
                "lane": 0,
            })

    segments.sort(key=lambda s: (
        1 if s["type"] == "dot" else 0,
        s["start_col"],
        -(s["end_col"] - s["start_col"]),
    ))

    lane_ends: list[int] = []
    for seg in segments:
        lane = -1
        for i, end in enumerate(lane_ends):
            if end < seg["start_col"]:
                lane = i
                break
        if lane == -1:
            lane = len(lane_ends)
            lane_ends.append(-1)
        seg["lane"] = lane
        lane_ends[lane] = seg["end_col"]

    return segments


# ---------------------------------------------------------------------------
# HTML rendering
# ---------------------------------------------------------------------------

LANE_H = 12  # px per lane
DAY_HEADERS = ["M", "T", "W", "T", "F", "S", "S"]


def _render_month(year: int, month: int, trials: list, blocking_events: list, staff_map: dict, today: datetime.date) -> str:
    weeks = _get_month_weeks(year, month)
    month_start = datetime.date(year, month, 1)
    month_end = datetime.date(year, month, calendar.monthrange(year, month)[1])

    header = f'<div class="mh">{datetime.date(year, month, 1).strftime("%B %Y")}</div>'

    day_headers = "".join(f'<div class="dh">{d}</div>' for d in DAY_HEADERS)

    weeks_html = ""
    for week in weeks:
        day_cells = ""
        for i, d in enumerate(week):
            cls = "dn"
            if d is None:
                cls += " empty"
            elif d == today:
                cls += " today"
            elif i >= 5:
                cls += " wknd"
            day_cells += f'<div class="{cls}">{d.day if d else ""}</div>'

        segs = _build_week_segments(week, month_start, month_end, trials, blocking_events, staff_map)
        lane_count = max((s["lane"] for s in segs), default=-1) + 1
        lane_h = max(lane_count, 0) * LANE_H

        seg_html = ""
        for s in segs:
            left = f"{(s['start_col'] / 7) * 100:.2f}%"
            span = s["end_col"] - s["start_col"] + 1
            width = f"{(span / 7) * 100:.2f}%"
            top = s["lane"] * LANE_H

            if s["type"] == "dot":
                seg_html += (
                    f'<div class="seg dot" style="left:{left};top:{top}px">'
                    f'<div class="dot-box"></div></div>'
                )
            elif s["type"] == "vacation":
                seg_html += (
                    f'<div class="seg vac" style="left:{left};width:{width};top:{top}px;opacity:{s["opacity"]}">'
                    f'<span class="sl">{escape(s["label"])}</span></div>'
                )
            else:
                seg_html += (
                    f'<div class="seg trial" style="left:{left};width:{width};top:{top}px;opacity:{s["opacity"]}">'
                    f'<span class="sl">{escape(s["label"])}</span></div>'
                )

        weeks_html += f'<div class="wk"><div class="grid7">{day_cells}</div>'
        if lane_h > 0:
            weeks_html += f'<div class="lanes" style="height:{lane_h}px">{seg_html}</div>'
        weeks_html += "</div>"

    return f'<div class="mc"><div class="grid7 dhr">{day_headers}</div>{header}{weeks_html}</div>'


def _build_html(trials: list, blocking_events: list, staff_map: dict) -> str:
    now = datetime.datetime.now(LA)
    today = now.date()
    date_str = now.strftime("%B %d, %Y")

    start_month = _add_months(today.replace(day=1), 1)
    pages = []
    for page_idx in range(4):
        month_cards = ""
        for i in range(6):
            m = _add_months(start_month, page_idx * 6 + i)
            month_cards += _render_month(m.year, m.month, trials, blocking_events, staff_map, today)

        first_m = _add_months(start_month, page_idx * 6)
        last_m = _add_months(start_month, page_idx * 6 + 5)
        range_label = f"{first_m.strftime('%b %Y')} – {last_m.strftime('%b %Y')}"

        page_break = ' style="page-break-before:always"' if page_idx > 0 else ""
        pages += f'<div class="page"{page_break}>'
        pages += f'<div class="hdr"><div class="title">Trial Calendar</div>'
        pages += f'<div class="meta">{date_str} &middot; {range_label}</div></div>'
        pages += f'<div class="grid6">{month_cards}</div>'

        if page_idx == 0:
            pages += _legend()

        pages += "</div>"

    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>{_get_css()}</style>
</head>
<body>{"".join(pages) if isinstance(pages, list) else pages}</body>
</html>"""


def _legend() -> str:
    return """<div class="legend">
<span class="leg-item"><span class="leg-swatch trial-sw"></span> Trial</span>
<span class="leg-item"><span class="leg-swatch vac-sw"></span> Vacation</span>
<span class="leg-item"><span class="leg-swatch dot-sw"></span> Event</span>
<span class="leg-item leg-note">Opacity = trial likelihood</span>
</div>"""


def _get_css() -> str:
    return """
@page {
  size: letter portrait;
  margin: 0.4in 0.4in 0.35in 0.4in;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 8pt;
  color: #1a1a1a;
  line-height: 1.2;
}

.page { width: 100%; }

.hdr { margin-bottom: 6pt; }
.title { font-size: 12pt; font-weight: 700; letter-spacing: -0.02em; }
.meta { font-size: 7pt; color: #666; margin-top: 1pt; }

.grid6 {
  display: flex;
  flex-wrap: wrap;
  gap: 6pt;
}

.mc {
  width: calc(50% - 3pt);
  border: 0.5pt solid #d0d0d0;
  padding: 4pt;
  background: #fff;
  overflow: hidden;
}

.mh {
  font-size: 7.5pt;
  font-weight: 700;
  margin-bottom: 2pt;
}

.grid7 {
  display: flex;
}
.grid7 > div { width: 14.2857%; text-align: center; }

.dhr { margin-bottom: 1pt; }
.dh {
  font-size: 6pt;
  font-weight: 600;
  color: #999;
}

.dn {
  font-size: 7pt;
  line-height: 13pt;
  color: #333;
}
.dn.empty { color: transparent; }
.dn.today {
  background: #dc2626;
  color: #fff;
  font-weight: 700;
}
.dn.wknd { color: #bbb; }

.wk { margin-bottom: 0; }

.lanes {
  position: relative;
  width: 100%;
}

.seg {
  position: absolute;
  height: 9pt;
  overflow: hidden;
  white-space: nowrap;
}

.seg.trial {
  background: #dc2626;
  color: #fff;
  padding: 0 2pt;
}

.seg.vac {
  background: #3b82f6;
  color: #fff;
  padding: 0 2pt;
}

.sl {
  font-size: 5.5pt;
  font-weight: 500;
  line-height: 9pt;
}

.seg.dot {
  width: 14.2857%;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 9pt;
}

.dot-box {
  width: 7pt;
  height: 7pt;
  background: #dc2626;
}

.legend {
  margin-top: 6pt;
  display: flex;
  gap: 12pt;
  align-items: center;
}

.leg-item {
  font-size: 6.5pt;
  color: #666;
  display: flex;
  align-items: center;
  gap: 3pt;
}

.leg-swatch {
  display: inline-block;
  width: 10pt;
  height: 6pt;
}
.trial-sw { background: #dc2626; }
.vac-sw { background: #3b82f6; }
.dot-sw { background: #dc2626; width: 6pt; height: 6pt; }

.leg-note { font-style: italic; color: #999; }
"""
