"""
Per-case document tracking — the "Document Tracking" card.

A fixed catalog of intake documents/authorizations (defined here in code) is
overlaid with sparse per-case rows. A row in `case_checklist_items` is created
lazily, only when an item is actually acted on (status moved off the default,
notes added, a comment posted, or a custom item added). Untouched catalog items
are *virtual* — they have no row and report the default "needed" status. This
keeps the `documents` feature toggle freely reversible (a freshly-enabled case
has zero rows) and lets the catalog evolve without backfilling existing cases.

The per-item activity log reuses the polymorphic `comments` table via
db/comments.py with entity_type="checklist_item".
"""

import uuid
from typing import Optional

from sqlalchemy import select, func, delete

from .session import SessionLocal
from . import comments as comments_db
from models import CaseChecklistItem, Comment

# Entity type used in the polymorphic comments table for item activity logs.
CHECKLIST_ENTITY = "checklist_item"

# Valid statuses (default first). Kept here rather than in schemas/common.py
# because this is web-UI-only and not surfaced as an MCP enum.
STATUSES = ("needed", "in_progress", "partial", "complete", "na")
DEFAULT_STATUS = "needed"

_STATUS_LABELS = {
    "needed": "To do",
    "in_progress": "In progress",
    "partial": "Partial",
    "complete": "Complete",
    "na": "N/A",
}

# The standard catalog: two groups, each an ordered list of (key, label).
# Mirrors the firm's paper "Client Information Sheet" document checklists.
CATALOG: list[dict] = [
    {
        "key": "authorizations",
        "label": "Authorizations",
        "items": [
            ("signed_retainer", "Signed Retainer"),
            ("hipaa_auth", "HIPAA Authorization"),
            ("autopsy_auth", "Authorization — Release of Autopsy"),
            ("public_records_auth", "Authorization — Release of Public Records"),
        ],
    },
    {
        "key": "documents",
        "label": "Documents",
        "items": [
            ("photo_id", "Copy of Photo ID / License"),
            ("death_certificate", "Death Certificate"),
            ("funeral_expenses", "Funeral & Burial Expense Docs"),
            ("medical_records", "Medical Records"),
            ("family_photos", "Family Photographs"),
            ("ssn_dob", "SSN & DOB"),
            ("criminal_defense_contact", "Criminal Case / Defense Attorney Contact"),
            ("av_recordings", "Video / Audio Recordings"),
            ("work_history", "Work History / Wage Loss Docs"),
            ("complaint_claim_form", "Copy of Complaint / Claim Form"),
            ("police_report", "Police / Incident Report"),
        ],
    },
]

# Flat lookup of catalog key -> default label, and key -> sort position.
_CATALOG_LABELS: dict[str, str] = {}
_CATALOG_ORDER: dict[str, int] = {}
for _gi, _g in enumerate(CATALOG):
    for _ii, (_k, _label) in enumerate(_g["items"]):
        _CATALOG_LABELS[_k] = _label
        _CATALOG_ORDER[_k] = _gi * 100 + _ii


def _is_custom(item_key: str) -> bool:
    return item_key.startswith("custom:")


def _item_dict(
    key: str,
    label: str,
    row: Optional[CaseChecklistItem],
    comment_counts: dict[int, int],
) -> dict:
    return {
        "key": key,
        "label": row.label if (row and row.label) else label,
        "status": row.status if row else DEFAULT_STATUS,
        "notes": row.notes if row else None,
        "id": row.id if row else None,
        "comment_count": comment_counts.get(row.id, 0) if row else 0,
        "custom": _is_custom(key),
        "updated_at": row.updated_at.isoformat() if (row and row.updated_at) else None,
    }


def _comment_counts(session, row_ids: list[int]) -> dict[int, int]:
    if not row_ids:
        return {}
    rows = session.execute(
        select(Comment.entity_id, func.count(Comment.id))
        .where(
            Comment.entity_type == CHECKLIST_ENTITY,
            Comment.entity_id.in_(row_ids),
            Comment.is_system.isnot(True),
        )
        .group_by(Comment.entity_id)
    ).all()
    return {eid: c for eid, c in rows}


def get_checklist(case_id: int) -> dict:
    """Return the merged checklist: catalog items overlaid with persisted rows.

    Shape: {"groups": [{key, label, items: [item...]}], "custom_items": [...]}
    """
    with SessionLocal() as session:
        rows = session.scalars(
            select(CaseChecklistItem).where(CaseChecklistItem.case_id == case_id)
        ).all()
        by_key = {r.item_key: r for r in rows}
        counts = _comment_counts(session, [r.id for r in rows])

        groups = []
        for g in CATALOG:
            items = []
            for key, label in g["items"]:
                items.append(_item_dict(key, label, by_key.get(key), counts))
            groups.append({"key": g["key"], "label": g["label"], "items": items})

        customs = [r for k, r in by_key.items() if _is_custom(k)]
        customs.sort(key=lambda r: (r.sort_order or 0, r.id))
        custom_items = [
            _item_dict(r.item_key, r.label or "Untitled", r, counts) for r in customs
        ]

        return {"groups": groups, "custom_items": custom_items}


def _row_dict(session, row: CaseChecklistItem) -> dict:
    label = _CATALOG_LABELS.get(row.item_key, row.label or "Untitled")
    counts = _comment_counts(session, [row.id])
    return _item_dict(row.item_key, label, row, counts)


def set_checklist_item(
    case_id: int,
    item_key: str,
    *,
    status: Optional[str] = None,
    notes: Optional[str] = None,
    user_id: Optional[int] = None,
) -> Optional[dict]:
    """Upsert status/notes for a catalog item.

    Materialization guard: if the item has no row yet and the requested state
    is still the untouched default (status "needed", empty notes), no row is
    created — the item stays virtual. Logs a system comment when the status
    actually changes.

    Returns the item dict, or None if the case/item is unknown.
    """
    if item_key not in _CATALOG_LABELS and not _is_custom(item_key):
        return None
    if status is not None and status not in STATUSES:
        return None

    with SessionLocal() as session:
        row = session.scalar(
            select(CaseChecklistItem).where(
                CaseChecklistItem.case_id == case_id,
                CaseChecklistItem.item_key == item_key,
            )
        )

        old_status = row.status if row else DEFAULT_STATUS
        new_status = status if status is not None else old_status
        new_notes = notes if notes is not None else (row.notes if row else None)
        if new_notes == "":
            new_notes = None

        # Nothing persisted yet and the result is still the pristine default →
        # don't create a row (keeps the feature toggle reversible).
        if row is None and new_status == DEFAULT_STATUS and not new_notes:
            return _item_dict(
                item_key, _CATALOG_LABELS.get(item_key, "Untitled"), None, {}
            )

        if row is None:
            row = CaseChecklistItem(
                case_id=case_id,
                item_key=item_key,
                status=new_status,
                notes=new_notes,
                sort_order=_CATALOG_ORDER.get(item_key),
            )
            session.add(row)
        else:
            row.status = new_status
            row.notes = new_notes
            row.updated_at = func.now()

        session.flush()
        result = _row_dict(session, row)

        if new_status != old_status:
            comments_db.add_comment(
                CHECKLIST_ENTITY,
                row.id,
                user_id,
                f"changed status to {_STATUS_LABELS.get(new_status, new_status)}",
                is_system=True,
                detail={"from": old_status, "to": new_status},
            )
            result["comment_count"] = _comment_counts(session, [row.id]).get(row.id, 0)

        session.commit()
        return result


def add_custom_item(case_id: int, label: str) -> dict:
    """Create a user-defined ("Other") checklist item. Always materializes."""
    item_key = f"custom:{uuid.uuid4().hex[:12]}"
    with SessionLocal() as session:
        max_order = session.scalar(
            select(func.max(CaseChecklistItem.sort_order)).where(
                CaseChecklistItem.case_id == case_id
            )
        )
        row = CaseChecklistItem(
            case_id=case_id,
            item_key=item_key,
            label=label.strip()[:120] or "Untitled",
            status=DEFAULT_STATUS,
            sort_order=(max_order or 999) + 1,
        )
        session.add(row)
        session.flush()
        result = _row_dict(session, row)
        session.commit()
        return result


def delete_checklist_item(case_id: int, item_key: str) -> bool:
    """Delete an item's row (and its activity log).

    For a custom item this removes it entirely. For a standard item this resets
    it back to the virtual default ("needed", no notes).
    """
    with SessionLocal() as session:
        row = session.scalar(
            select(CaseChecklistItem).where(
                CaseChecklistItem.case_id == case_id,
                CaseChecklistItem.item_key == item_key,
            )
        )
        if row is None:
            return False
        session.execute(
            delete(Comment).where(
                Comment.entity_type == CHECKLIST_ENTITY,
                Comment.entity_id == row.id,
            )
        )
        session.delete(row)
        session.commit()
        return True


def _resolve_row_id(case_id: int, item_key: str) -> Optional[int]:
    with SessionLocal() as session:
        return session.scalar(
            select(CaseChecklistItem.id).where(
                CaseChecklistItem.case_id == case_id,
                CaseChecklistItem.item_key == item_key,
            )
        )


def get_item_comments(case_id: int, item_key: str) -> list[dict]:
    """Activity log for one item. Empty when the item has no row yet."""
    row_id = _resolve_row_id(case_id, item_key)
    if row_id is None:
        return []
    return comments_db.get_comments(CHECKLIST_ENTITY, row_id)


def add_item_comment(
    case_id: int, item_key: str, user_id: Optional[int], content: str
) -> Optional[dict]:
    """Add an activity-log entry, materializing the item row if needed."""
    if item_key not in _CATALOG_LABELS and not _is_custom(item_key):
        return None

    with SessionLocal() as session:
        row = session.scalar(
            select(CaseChecklistItem).where(
                CaseChecklistItem.case_id == case_id,
                CaseChecklistItem.item_key == item_key,
            )
        )
        if row is None:
            row = CaseChecklistItem(
                case_id=case_id,
                item_key=item_key,
                status=DEFAULT_STATUS,
                sort_order=_CATALOG_ORDER.get(item_key),
            )
            session.add(row)
            session.flush()
        row_id = row.id
        session.commit()

    return comments_db.add_comment(CHECKLIST_ENTITY, row_id, user_id, content)
