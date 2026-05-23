"""Test battery for the calculate_deadline MCP tool.

Runs the tool through the same dispatch path the chat executor uses:
boot a FastMCP instance, register_tools(), look up by name, call .fn().

Each test prints PASS/FAIL with the actual vs expected. Exit code is the
number of failed cases (0 = all pass).

Usage:
    set -a && source .env && set +a
    source .venv/bin/activate
    python3 scripts/test_calculate_deadline.py
"""

import os
import sys
import logging
from dataclasses import dataclass
from typing import Any

# Allow running from the project root or any other cwd
_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(_HERE)
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from fastmcp import FastMCP

from tools import register_tools, CalculateDeadlineInput


# ---------------------------------------------------------------------------
# Minimal Context shim — mirrors services/chat/executor.ChatContext but local
# ---------------------------------------------------------------------------
class _Ctx:
    user_id = None

    def info(self, msg: str) -> None:
        # Stay quiet by default; flip to print(msg) when debugging
        pass

    def error(self, msg: str) -> None:
        print(f"  [tool error] {msg}", file=sys.stderr)


# ---------------------------------------------------------------------------
# Test harness
# ---------------------------------------------------------------------------
logging.disable(logging.CRITICAL)

_mcp = FastMCP("test-harness")
register_tools(_mcp)
_tool = _mcp._tool_manager._tools.get("calculate_deadline")
assert _tool is not None, "calculate_deadline tool not registered"


def call(**kwargs) -> dict:
    """Call the tool the same way chat executor does — build the Pydantic
    input from kwargs, then invoke tool.fn(ctx, data=input)."""
    data = CalculateDeadlineInput(**kwargs)
    return _tool.fn(_Ctx(), data=data)


@dataclass
class Case:
    name: str
    kwargs: dict
    expect: dict  # subset of fields that must match exactly


def assertion_failures(actual: dict, expected: dict) -> list[str]:
    failures = []
    for k, want in expected.items():
        got = actual.get(k)
        if got != want:
            failures.append(f"{k}: expected {want!r}, got {got!r}")
    return failures


CASES: list[Case] = [
    # -------------------------------------------------------------------
    # Calendar-day arithmetic
    # -------------------------------------------------------------------
    Case(
        "30 calendar days from a Monday",
        {"start_date": "2026-06-01", "days": 30},
        {"result_date": "2026-07-01", "result_weekday": "Wednesday", "is_court_day": True, "rolled_forward": False},
    ),
    Case(
        "Negative calendar days (90 days back)",
        {"start_date": "2026-06-01", "days": -90},
        {"result_date": "2026-03-03", "result_weekday": "Tuesday"},
    ),
    Case(
        "Zero calendar days = anchor",
        {"start_date": "2026-06-01", "days": 0},
        {"result_date": "2026-06-01", "result_weekday": "Monday"},
    ),
    Case(
        "Cross year boundary (400 calendar days)",
        {"start_date": "2026-06-01", "days": 400},
        {"result_date": "2027-07-06"},
    ),

    # -------------------------------------------------------------------
    # Court-day arithmetic (skip Sat/Sun + federal holidays)
    # -------------------------------------------------------------------
    Case(
        "15 court days from Mon 2026-06-01 skips Juneteenth (Fri 6/19)",
        {"start_date": "2026-06-01", "days": 15, "unit": "court"},
        {"result_date": "2026-06-23", "result_weekday": "Tuesday"},
    ),
    Case(
        "5 court days back from Mon 2026-07-06 skips observed 7/3 holiday",
        # July 4 2026 is a Saturday → observed on Fri July 3.
        # Counting back: 7/2 Thu(1) 7/1 Wed(2) 6/30 Tue(3) 6/29 Mon(4) 6/26 Fri(5)
        {"start_date": "2026-07-06", "days": -5, "unit": "court"},
        {"result_date": "2026-06-26", "result_weekday": "Friday"},
    ),
    Case(
        "1 court day after a Friday skips weekend",
        {"start_date": "2026-06-05", "days": 1, "unit": "court"},  # Fri
        {"result_date": "2026-06-08", "result_weekday": "Monday"},
    ),
    Case(
        "Anchor is itself a holiday — anchor not counted",
        # 2026-07-04 (Sat, observed Fri 7/3). Start anchored ON Sat 7/4, +1 court day.
        # Mon 7/6 is the next court day (7/3 observed-holiday + weekend).
        {"start_date": "2026-07-04", "days": 1, "unit": "court"},
        {"result_date": "2026-07-06", "result_weekday": "Monday"},
    ),
    Case(
        "Anchor is itself a weekend — anchor not counted",
        # Sat 2026-06-06 + 1 court day = Mon 6/8
        {"start_date": "2026-06-06", "days": 1, "unit": "court"},
        {"result_date": "2026-06-08", "result_weekday": "Monday"},
    ),
    Case(
        "Zero court days = anchor itself",
        {"start_date": "2026-06-01", "days": 0, "unit": "court"},
        {"result_date": "2026-06-01"},
    ),
    Case(
        "50 court days forward",
        # 2026-06-01 Mon + 50 court days. Manually: 50 weekdays = ~10 weeks.
        # 2026-06-01 to 2026-08-10 is 10 weeks (Mon → Mon). Holidays in window:
        # Juneteenth (Fri 6/19) and Independence Day observed (Fri 7/3) → 2 skips.
        # 50 court days lands 2 weekdays past 8/10 → 8/12 Wed.
        {"start_date": "2026-06-01", "days": 50, "unit": "court"},
        {"result_date": "2026-08-12", "result_weekday": "Wednesday"},
    ),

    # -------------------------------------------------------------------
    # CCP §12c roll-forward
    # -------------------------------------------------------------------
    Case(
        "Roll forward: lands on Saturday → next Monday",
        # 2026-06-01 Mon + 5 cal days = Sat 6/6. Roll → Mon 6/8.
        {"start_date": "2026-06-01", "days": 5, "unit": "calendar", "roll_forward": True},
        {"result_date": "2026-06-08", "result_weekday": "Monday", "rolled_forward": True, "pre_roll_date": "2026-06-06"},
    ),
    Case(
        "Roll forward: lands on Sunday → next Monday",
        # 2026-06-01 Mon + 6 cal days = Sun 6/7. Roll → Mon 6/8.
        {"start_date": "2026-06-01", "days": 6, "unit": "calendar", "roll_forward": True},
        {"result_date": "2026-06-08", "rolled_forward": True, "pre_roll_date": "2026-06-07"},
    ),
    Case(
        "Roll forward over New Year's: lands on observed Fri 1/1, then weekend → Mon 1/4",
        # 2026-12-22 + 10 cal days = Fri 2027-01-01 (New Year's). Roll over Sat/Sun → Mon 1/4.
        {"start_date": "2026-12-22", "days": 10, "unit": "calendar", "roll_forward": True},
        {"result_date": "2027-01-04", "result_weekday": "Monday", "rolled_forward": True, "pre_roll_date": "2027-01-01"},
    ),
    Case(
        "Roll forward no-op when already on a court day",
        {"start_date": "2026-06-01", "days": 1, "unit": "calendar", "roll_forward": True},
        {"result_date": "2026-06-02", "rolled_forward": False, "pre_roll_date": None},
    ),
    Case(
        "Roll forward over Thanksgiving (Thu 11/26/2026)",
        # 2026-11-26 is Thanksgiving. Start 11-25 Wed + 1 cal day = Thu 11/26 (holiday).
        # Roll → Fri 11/27 (note: federal Black Friday isn't a holiday).
        {"start_date": "2026-11-25", "days": 1, "unit": "calendar", "roll_forward": True},
        {"result_date": "2026-11-27", "result_weekday": "Friday", "rolled_forward": True, "pre_roll_date": "2026-11-26"},
    ),

    # -------------------------------------------------------------------
    # Holiday recognition
    # -------------------------------------------------------------------
    Case(
        "MLK Day (3rd Mon Jan) treated as holiday in court-day count",
        # MLK 2026 = Mon Jan 19. Start Fri 1/16 + 1 court day = should skip Mon 1/19 → Tue 1/20.
        {"start_date": "2026-01-16", "days": 1, "unit": "court"},
        {"result_date": "2026-01-20", "result_weekday": "Tuesday"},
    ),
    Case(
        "Memorial Day (last Mon May) treated as holiday",
        # Memorial Day 2026 = Mon May 25. Fri 5/22 + 1 court day → skip Mon 5/25 → Tue 5/26.
        {"start_date": "2026-05-22", "days": 1, "unit": "court"},
        {"result_date": "2026-05-26", "result_weekday": "Tuesday"},
    ),
    Case(
        "Labor Day (1st Mon Sep) treated as holiday",
        # Labor Day 2026 = Mon Sep 7. Fri 9/4 + 1 court day → skip 9/7 → Tue 9/8.
        {"start_date": "2026-09-04", "days": 1, "unit": "court"},
        {"result_date": "2026-09-08"},
    ),
    Case(
        "Christmas 2027 falls on Sat → observed Fri 12/24 is the holiday",
        # Dec 25 2027 = Sat. Observed Fri 12/24. So Thu 12/23 + 1 court day → skip Fri 12/24 → Mon 12/27.
        {"start_date": "2027-12-23", "days": 1, "unit": "court"},
        {"result_date": "2027-12-27", "result_weekday": "Monday"},
    ),

    # -------------------------------------------------------------------
    # Skipped-days reporting
    # -------------------------------------------------------------------
    Case(
        "skipped_non_court_days lists weekends/holidays for court counts",
        # 5 court days from Fri 2026-06-19 (which is Juneteenth — anchor not counted).
        # Anchor is itself a holiday but we don't count it; we walk forward.
        # Sat 6/20 (skip), Sun 6/21 (skip), Mon 6/22 (1), Tue (2), Wed (3), Thu (4), Fri (5) = 6/26.
        {"start_date": "2026-06-19", "days": 5, "unit": "court"},
        {"result_date": "2026-06-26"},
    ),

    # -------------------------------------------------------------------
    # Error paths
    # -------------------------------------------------------------------
    Case(
        "Invalid date format returns VALIDATION_ERROR",
        {"start_date": "06/01/2026", "days": 30},
        {"success": False},
    ),
    Case(
        "Non-ISO date returns VALIDATION_ERROR",
        {"start_date": "not-a-date", "days": 1},
        {"success": False},
    ),
]


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------
def main() -> int:
    print(f"Running {len(CASES)} test cases against calculate_deadline\n")
    failures = 0
    for i, case in enumerate(CASES, 1):
        try:
            result = call(**case.kwargs)
        except Exception as e:
            print(f"  [{i:2d}] FAIL  {case.name}")
            print(f"        raised {type(e).__name__}: {e}")
            failures += 1
            continue

        misses = assertion_failures(result, case.expect)
        if misses:
            print(f"  [{i:2d}] FAIL  {case.name}")
            for m in misses:
                print(f"        {m}")
            print(f"        full result: {result}")
            failures += 1
        else:
            print(f"  [{i:2d}] pass  {case.name}")

    total = len(CASES)
    passed = total - failures
    print()
    print(f"Result: {passed}/{total} passed, {failures} failed")
    return failures


if __name__ == "__main__":
    sys.exit(main())
