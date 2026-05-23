"""
Per-case feature gates.

When `Case.feature_toggles[<feature>]` is not exactly `true`, that feature
is disabled for the case:

- Cross-case list/search queries filter out rows belonging to the case.
- Single-item reads return None (route layer turns this into 404).
- Create/update/delete operations raise FeatureDisabled.

Existing data is preserved when a feature is turned off — toggling back on
makes it reappear unchanged.

Feature keys (must match the frontend `CaseFeatureKey` union):

    tasks       -> Task rows
    events      -> Event rows
    financials  -> CaseFinancial + CounselFee rows
    costs       -> Invoice + Lien rows (the entire case-costs page)

Rows with a NULL case_id (e.g., unassigned tasks) are never filtered out
because they don't belong to any case.
"""

from typing import Optional

from sqlalchemy import func, or_, select as sa_select
from sqlalchemy.orm import Session

from models import Case, Task, Event, CaseFinancial, Invoice, Lien


FEATURE_TASKS = "tasks"
FEATURE_EVENTS = "events"
FEATURE_FINANCIALS = "financials"
FEATURE_COSTS = "costs"

ALL_FEATURES = (FEATURE_TASKS, FEATURE_EVENTS, FEATURE_FINANCIALS, FEATURE_COSTS)


class FeatureDisabled(Exception):
    """Raised when an operation requires a case feature that is disabled."""

    _LABELS = {
        FEATURE_TASKS: "Tasks",
        FEATURE_EVENTS: "Events",
        FEATURE_FINANCIALS: "Financials",
        FEATURE_COSTS: "Costs",
    }

    def __init__(self, case_id: int, feature: str):
        self.case_id = case_id
        self.feature = feature
        label = self._LABELS.get(feature, feature)
        super().__init__(
            f"{label} are disabled for case {case_id}. "
            f"Enable from the gear menu on the case page."
        )


def is_feature_enabled(session: Session, case_id: int, feature: str) -> bool:
    """True if the given case has the feature toggle set to True."""
    case = session.get(Case, case_id)
    if case is None:
        return False
    return bool((case.feature_toggles or {}).get(feature))


def require_feature_for_case(
    session: Session, case_id: Optional[int], feature: str
) -> None:
    """Raise FeatureDisabled if the case has the feature off.

    case_id=None is allowed (unassigned rows aren't tied to any case).
    """
    if case_id is None:
        return
    if not is_feature_enabled(session, case_id, feature):
        raise FeatureDisabled(case_id, feature)


class FeatureHasData(Exception):
    """Raised when trying to disable a feature that still has rows for a case."""

    def __init__(self, case_id: int, feature: str, count: int):
        self.case_id = case_id
        self.feature = feature
        self.count = count
        label = FeatureDisabled._LABELS.get(feature, feature)
        super().__init__(
            f"Cannot hide {label} for case {case_id}: {count} record(s) still exist. "
            f"Delete them first if you want to hide this section."
        )


def get_feature_data_counts(session: Session, case_id: int) -> dict[str, int]:
    """Return row counts per feature for the given case.

    Used to (a) populate the case detail response so the UI can disable
    toggles whose section has data, and (b) validate toggle-off requests.
    """
    return {
        FEATURE_TASKS:      session.scalar(sa_select(func.count(Task.id)).where(Task.case_id == case_id)) or 0,
        FEATURE_EVENTS:     session.scalar(sa_select(func.count(Event.id)).where(Event.case_id == case_id)) or 0,
        FEATURE_FINANCIALS: session.scalar(sa_select(func.count(CaseFinancial.id)).where(CaseFinancial.case_id == case_id)) or 0,
        FEATURE_COSTS:      (session.scalar(sa_select(func.count(Invoice.id)).where(Invoice.case_id == case_id)) or 0)
                           + (session.scalar(sa_select(func.count(Lien.id)).where(Lien.case_id == case_id)) or 0),
    }


def feature_enabled_filter(feature: str, case_id_col):
    """SQLAlchemy WHERE clause limiting to rows whose case has feature enabled.

    Rows with case_id IS NULL are always included.

        stmt = select(Task).where(feature_enabled_filter("tasks", Task.case_id))
    """
    return or_(
        case_id_col.is_(None),
        case_id_col.in_(
            sa_select(Case.id).where(
                Case.feature_toggles[feature].astext == "true"
            )
        ),
    )
