"""
Case health / data-quality alerts — computed on read.

Each rule inspects one case and either stays silent or emits an issue. The
engine runs every rule against every (non-closed) case on request, then
subtracts dismissals. Dismissible rules whose underlying data can change carry
a `fingerprint`: a dismissal only suppresses the alert while the fingerprint
matches, so the issue re-surfaces if the relevant data later changes.
"""

from typing import Optional

from sqlalchemy import select, literal_column, delete

from .session import SessionLocal
from models import Case, User, AlertDismissal


# Case statuses that imply a complaint has been filed → a court proceeding
# (case number) is expected. Pre-filing, settled, stayed and closed are
# deliberately excluded.
FILED_STATUSES = {
    "Pleadings", "Discovery", "Expert Discovery",
    "Pre-trial", "Trial", "Post-Trial", "Appeal",
}

# Rule metadata surfaced to the frontend. `dismissible=False` means the issue
# can only clear by being resolved in the data.
RULE_META = {
    "missing_doi": {"label": "No Date of Injury", "severity": "error", "dismissible": False},
    "no_paralegal": {"label": "No paralegal assigned", "severity": "error", "dismissible": False},
    "no_plaintiff": {"label": "No plaintiff linked", "severity": "error", "dismissible": False},
    "active_no_proceeding": {"label": "Filed case missing court number", "severity": "warning", "dismissible": True},
    "wrong_paralegal": {"label": "Unusual paralegal assignment", "severity": "warning", "dismissible": True},
}


def _staff_fingerprint(attorney_ids: list[int], paralegal_ids: list[int]) -> str:
    return f"a:{sorted(attorney_ids)}|p:{sorted(paralegal_ids)}"


def _evaluate_case(row, users_by_id: dict) -> list[dict]:
    """Run all rules against one case row. Returns a list of raw issue dicts."""
    issues: list[dict] = []
    attorney_ids = list(row.attorney_ids or [])
    paralegal_ids = list(row.paralegal_ids or [])

    if row.date_of_injury is None:
        issues.append({"rule_id": "missing_doi", "message": "No Date of Injury set."})

    if not paralegal_ids:
        issues.append({"rule_id": "no_paralegal", "message": "No paralegal assigned to this case."})

    if (row.plaintiff_count or 0) == 0:
        issues.append({"rule_id": "no_plaintiff", "message": "No plaintiff linked to this case."})

    if row.status in FILED_STATUSES and (row.proceeding_count or 0) == 0:
        issues.append({
            "rule_id": "active_no_proceeding",
            "message": f'Case is in "{row.status}" but has no court case number.',
            "fingerprint": row.status,
        })

    # Wrong paralegal: only judge when we have both attorneys and paralegals,
    # and at least one assigned attorney has a default paralegal to compare to.
    if attorney_ids and paralegal_ids:
        expected = {
            users_by_id[aid]["paralegal_id"]
            for aid in attorney_ids
            if users_by_id.get(aid) and users_by_id[aid]["paralegal_id"]
        }
        if expected:
            mismatched = [pid for pid in paralegal_ids if pid not in expected]
            if mismatched:
                names = ", ".join(
                    users_by_id.get(pid, {}).get("name", f"#{pid}") for pid in mismatched
                )
                issues.append({
                    "rule_id": "wrong_paralegal",
                    "message": f"{names} is not the usual paralegal for the assigned attorney(s).",
                    "fingerprint": _staff_fingerprint(attorney_ids, paralegal_ids),
                })

    return issues


def get_case_alerts(case_id: Optional[int] = None, include_dismissed: bool = False) -> dict:
    """Compute current case-health alerts.

    When `case_id` is given, only that case is evaluated; otherwise all
    non-closed cases. Dismissed alerts are excluded unless `include_dismissed`.
    """
    with SessionLocal() as session:
        plaintiff_count_sq = literal_column("""(
            SELECT COUNT(*) FROM person_roles pr
            JOIN roles r ON pr.role_id = r.id
            WHERE pr.case_id = cases.id AND r.name = 'plaintiff'
        )""").label("plaintiff_count")

        proceeding_count_sq = literal_column("""(
            SELECT COUNT(*) FROM proceedings p WHERE p.case_id = cases.id
        )""").label("proceeding_count")

        stmt = select(
            Case.id, Case.case_name, Case.short_name, Case.status, Case.color,
            Case.date_of_injury, Case.attorney_ids, Case.paralegal_ids,
            plaintiff_count_sq, proceeding_count_sq,
        )
        if case_id is not None:
            stmt = stmt.where(Case.id == case_id)
        else:
            stmt = stmt.where(Case.status != "Closed")
        stmt = stmt.order_by(Case.case_name)
        rows = session.execute(stmt).fetchall()

        user_rows = session.execute(
            select(User.id, User.first_name, User.last_name, User.paralegal_id)
        ).fetchall()
        users_by_id = {
            u.id: {"name": f"{u.first_name} {u.last_name}", "paralegal_id": u.paralegal_id}
            for u in user_rows
        }

        dstmt = select(
            AlertDismissal.case_id, AlertDismissal.rule_id,
            AlertDismissal.fingerprint, AlertDismissal.created_at,
        )
        if case_id is not None:
            dstmt = dstmt.where(AlertDismissal.case_id == case_id)
        dismissals = {
            (d.case_id, d.rule_id): {"fingerprint": d.fingerprint, "created_at": d.created_at}
            for d in session.execute(dstmt).fetchall()
        }

        alerts: list[dict] = []
        for row in rows:
            for issue in _evaluate_case(row, users_by_id):
                rule_id = issue["rule_id"]
                meta = RULE_META[rule_id]
                fingerprint = issue.get("fingerprint")

                dismissal = dismissals.get((row.id, rule_id))
                is_dismissed = bool(
                    dismissal
                    and meta["dismissible"]
                    and (dismissal["fingerprint"] or None) == (fingerprint or None)
                )
                if is_dismissed and not include_dismissed:
                    continue

                alerts.append({
                    "case_id": row.id,
                    "case_name": row.case_name,
                    "short_name": row.short_name,
                    "case_color": row.color,
                    "case_status": row.status,
                    "rule_id": rule_id,
                    "label": meta["label"],
                    "severity": meta["severity"],
                    "dismissible": meta["dismissible"],
                    "message": issue["message"],
                    "fingerprint": fingerprint,
                    "dismissed": is_dismissed,
                    "dismissed_at": (
                        dismissal["created_at"].isoformat()
                        if is_dismissed and dismissal["created_at"] else None
                    ),
                })

        error_count = sum(1 for a in alerts if a["severity"] == "error" and not a["dismissed"])
        warning_count = sum(1 for a in alerts if a["severity"] == "warning" and not a["dismissed"])
        affected_cases = len({a["case_id"] for a in alerts if not a["dismissed"]})

        return {
            "alerts": alerts,
            "total": len(alerts),
            "error_count": error_count,
            "warning_count": warning_count,
            "affected_cases": affected_cases,
        }


def dismiss_alert(case_id: int, rule_id: str, fingerprint: Optional[str] = None,
                  dismissed_by: Optional[int] = None, reason: Optional[str] = None) -> dict:
    """Record (or update) a dismissal for a dismissible rule on a case."""
    meta = RULE_META.get(rule_id)
    if meta is None:
        raise ValueError(f"Unknown rule_id: {rule_id}")
    if not meta["dismissible"]:
        raise ValueError(f"Rule '{rule_id}' cannot be dismissed")

    with SessionLocal() as session:
        existing = session.scalars(
            select(AlertDismissal).where(
                AlertDismissal.case_id == case_id,
                AlertDismissal.rule_id == rule_id,
            )
        ).first()
        if existing:
            existing.fingerprint = fingerprint
            existing.dismissed_by = dismissed_by
            existing.reason = reason
        else:
            session.add(AlertDismissal(
                case_id=case_id, rule_id=rule_id, fingerprint=fingerprint,
                dismissed_by=dismissed_by, reason=reason,
            ))
        session.commit()
        return {"success": True}


def undismiss_alert(case_id: int, rule_id: str) -> dict:
    """Remove a dismissal so the alert re-appears (if still applicable)."""
    with SessionLocal() as session:
        session.execute(
            delete(AlertDismissal).where(
                AlertDismissal.case_id == case_id,
                AlertDismissal.rule_id == rule_id,
            )
        )
        session.commit()
        return {"success": True}
