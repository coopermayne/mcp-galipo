"""Pure-function cost-sharing allocator and settlement minimizer.

This module knows nothing about the database. Inputs are plain dicts that the
caller has already loaded; outputs are plain dicts. Tested as pure logic.

The config shape:
    {
      "version": 1,
      "parties": [{"id": "ours", "label": ...}, {"id": "p:42", "person_id": 42, "label": ...}, ...],
      "phases": [
        {
          "id": "phase-1",
          "label": "Pre-trial",
          "boundary_kind": "open_start" | "date",
          "boundary_date": "2026-09-01" | None,
          "shares": [{"party": "ours", "pct": 50}, {"party": "p:42", "pct": 50}],
          "caps": [{"party": "p:42", "max_cumulative": 20000.00}]   # optional
        },
        ...
      ],
      "absorber_party": "ours"
    }

Conventions:
- Party IDs are strings. "ours" is the firm. Person-backed parties use "p:<id>".
- Phases are ordered by their position in the array. The first phase always
  has boundary_kind="open_start". Subsequent phases use boundary_kind="date"
  with a boundary_date. The phase a given invoice belongs to is the latest
  phase whose boundary_date is <= invoice.date (or the first phase if none).
"""

from __future__ import annotations

import datetime
from typing import Iterable, Optional


OURS = "ours"


def party_id_for_person(person_id: int) -> str:
    return f"p:{person_id}"


def person_id_from_party_id(party_id: str) -> Optional[int]:
    if party_id.startswith("p:"):
        try:
            return int(party_id[2:])
        except ValueError:
            return None
    return None


def bucket_invoice(invoice: dict, config: dict) -> str:
    """Return the phase_id for an invoice. Falls back to the first phase
    when no date is set on the invoice."""
    phases = config.get("phases") or []
    if not phases:
        return ""
    inv_date = invoice.get("date")
    if isinstance(inv_date, str):
        try:
            inv_date = datetime.date.fromisoformat(inv_date)
        except ValueError:
            inv_date = None
    if not inv_date:
        return phases[0]["id"]

    chosen = phases[0]["id"]
    for phase in phases[1:]:
        boundary = phase.get("boundary_date")
        if isinstance(boundary, str):
            try:
                boundary = datetime.date.fromisoformat(boundary)
            except ValueError:
                continue
        if not boundary:
            continue
        if inv_date >= boundary:
            chosen = phase["id"]
        else:
            break
    return chosen


def _phase_total(phase: dict, invoices: list[dict]) -> float:
    total = 0.0
    for inv in invoices:
        if inv.get("phase_id") != phase["id"]:
            continue
        amt = inv.get("case_amount")
        if amt is None:
            amt = inv.get("amount", 0)
        total += float(amt or 0)
    return total


def allocate(config: dict, invoices: list[dict]) -> dict[str, float]:
    """Compute the target contribution per party.

    `invoices` should already have `phase_id` set (call `bucket_invoice` first
    if needed). Only cost invoices count — transfers and advances should be
    filtered out by the caller.

    Returns: {party_id: target_amount}
    """
    parties = [p["id"] for p in config.get("parties") or []]
    if not parties:
        return {}
    phases = config.get("phases") or []
    absorber = config.get("absorber_party") or OURS

    cumulative: dict[str, float] = {p: 0.0 for p in parties}

    # Build a quick lookup of cumulative caps per party (cumulative-across-case)
    cap_by_party: dict[str, float] = {}
    cap_absorber_by_party: dict[str, str] = {}
    for phase in phases:
        for cap in phase.get("caps") or []:
            party = cap.get("party")
            if party not in cumulative:
                continue
            amount = float(cap.get("max_cumulative", 0))
            if party not in cap_by_party or amount < cap_by_party[party]:
                cap_by_party[party] = amount
            cap_absorber_by_party[party] = cap.get("absorber") or absorber

    for phase in phases:
        phase_total = _phase_total(phase, invoices)
        if phase_total <= 0:
            continue

        shares = {s["party"]: float(s["pct"]) for s in phase.get("shares") or []}
        # Initial uncapped allocation
        phase_alloc: dict[str, float] = {
            p: phase_total * (shares.get(p, 0.0) / 100.0) for p in parties
        }

        # Apply caps. Iterate until no party exceeds its cap; usually one pass.
        for _ in range(len(parties)):
            spilled = False
            for party, cap in cap_by_party.items():
                projected = cumulative[party] + phase_alloc[party]
                if projected <= cap + 1e-9:
                    continue
                overflow = projected - cap
                phase_alloc[party] -= overflow
                cap_absorber = cap_absorber_by_party.get(party, absorber)
                if cap_absorber in phase_alloc:
                    phase_alloc[cap_absorber] += overflow
                else:
                    phase_alloc[absorber] = phase_alloc.get(absorber, 0.0) + overflow
                spilled = True
            if not spilled:
                break

        for party in parties:
            cumulative[party] += phase_alloc[party]

    return {p: round(cumulative[p], 2) for p in parties}


def compute_paid_by_party(invoices: list[dict], parties: list[str]) -> dict[str, float]:
    """Sum what each party has actually paid (cost invoices only, not transfers)."""
    paid: dict[str, float] = {p: 0.0 for p in parties}
    for inv in invoices:
        if inv.get("is_transfer"):
            continue
        if inv.get("type") and inv["type"] != "cost":
            continue
        amt = inv.get("case_amount")
        if amt is None:
            amt = inv.get("amount", 0)
        amt = float(amt or 0)
        paid_by_id = inv.get("paid_by_person_id")
        if paid_by_id is None:
            party = OURS
        else:
            party = party_id_for_person(int(paid_by_id))
        if party in paid:
            paid[party] += amt
        else:
            # Payer isn't in the config; bucket under "ours" so the totals
            # still sum to the case total.
            paid[OURS] = paid.get(OURS, 0.0) + amt
    return {p: round(paid[p], 2) for p in paid}


def apply_transfers(
    paid: dict[str, float], invoices: list[dict]
) -> dict[str, float]:
    """Adjust per-party paid totals for settlement transfers already on file.

    A transfer where party A pays party B is money out of A's pocket and into
    B's. So A's effective contribution to the case goes UP by the amount and
    B's goes DOWN. Returns a copy with adjusted totals.
    """
    net = dict(paid)
    for inv in invoices:
        if not inv.get("is_transfer"):
            continue
        amt = inv.get("case_amount")
        if amt is None:
            amt = inv.get("amount", 0)
        amt = float(amt or 0)
        paid_by_id = inv.get("paid_by_person_id")
        transfer_to_id = inv.get("transfer_to_person_id")

        from_party = OURS if paid_by_id is None else party_id_for_person(int(paid_by_id))
        to_party = OURS if transfer_to_id is None else party_id_for_person(int(transfer_to_id))

        if from_party in net:
            net[from_party] = round(net[from_party] + amt, 2)
        if to_party in net:
            net[to_party] = round(net[to_party] - amt, 2)
    return net


def compute_settlement(deltas: dict[str, float], threshold: float = 0.01) -> list[dict]:
    """Greedy minimum-transactions settlement.

    Input: {party_id: delta}, where positive delta = overpaid (creditor) and
    negative = underpaid (debtor). Sum of deltas should be ~0.

    Returns list of {"from_party": ..., "to_party": ..., "amount": ...}.
    """
    creditors = sorted(
        [(p, d) for p, d in deltas.items() if d > threshold],
        key=lambda x: -x[1],
    )
    debtors = sorted(
        [(p, -d) for p, d in deltas.items() if d < -threshold],
        key=lambda x: -x[1],
    )

    transfers: list[dict] = []
    ci = di = 0
    while ci < len(creditors) and di < len(debtors):
        c_party, c_amt = creditors[ci]
        d_party, d_amt = debtors[di]
        amount = round(min(c_amt, d_amt), 2)
        if amount > 0:
            transfers.append({
                "from_party": d_party,
                "to_party": c_party,
                "amount": amount,
            })
        c_amt -= amount
        d_amt -= amount
        if c_amt <= threshold:
            ci += 1
        else:
            creditors[ci] = (c_party, c_amt)
        if d_amt <= threshold:
            di += 1
        else:
            debtors[di] = (d_party, d_amt)

    return transfers


def settlement_for_case(
    config: dict, invoices: list[dict], parties_meta: Optional[dict] = None
) -> dict:
    """High-level: given config + invoices (with phase_id), return targets,
    paid, deltas, and the proposed transfers.

    `parties_meta` optionally maps party_id -> {"label": ..., "person_id": ...}
    so the result can include human-readable names.
    """
    parties = [p["id"] for p in config.get("parties") or []]
    targets = allocate(config, invoices)
    paid = compute_paid_by_party(invoices, parties)
    net = apply_transfers(paid, invoices)
    deltas = {p: round(net.get(p, 0) - targets.get(p, 0), 2) for p in parties}

    transfers_raw = compute_settlement(deltas)
    transfers: list[dict] = []
    for t in transfers_raw:
        from_meta = (parties_meta or {}).get(t["from_party"]) or {}
        to_meta = (parties_meta or {}).get(t["to_party"]) or {}
        transfers.append({
            "from_party": t["from_party"],
            "to_party": t["to_party"],
            "amount": t["amount"],
            "from_label": from_meta.get("label"),
            "to_label": to_meta.get("label"),
            "from_person_id": from_meta.get("person_id"),
            "to_person_id": to_meta.get("person_id"),
        })

    return {
        "parties": parties,
        "targets": targets,
        "paid": paid,
        "net_paid": net,
        "deltas": deltas,
        "transfers": transfers,
    }


def materialize_simple_config(
    partner_person_id: int,
    partner_label: str,
    partner_pct: float,
    partner_organization: Optional[str] = None,
    our_label: str = "Our Firm",
) -> dict:
    """Build a one-phase, two-party config from the legacy simple split.

    Used both when upgrading a case from simple to advanced mode and as a
    fallback for callers that always want the rich shape.
    """
    our_pct = round(100.0 - partner_pct, 2)
    return {
        "version": 1,
        "parties": [
            {"id": OURS, "label": our_label},
            {
                "id": party_id_for_person(partner_person_id),
                "person_id": partner_person_id,
                "label": partner_label,
                "organization": partner_organization,
            },
        ],
        "phases": [
            {
                "id": "phase-1",
                "label": "Default",
                "boundary_kind": "open_start",
                "boundary_date": None,
                "shares": [
                    {"party": OURS, "pct": our_pct},
                    {"party": party_id_for_person(partner_person_id), "pct": partner_pct},
                ],
                "caps": [],
            }
        ],
        "absorber_party": OURS,
    }
