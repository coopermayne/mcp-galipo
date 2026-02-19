"""
Fuzzy name matching for judges (extensible to persons later).

Uses rapidfuzz for scoring and hand-rolled Soundex for phonetic bonus.
Designed so normalize_name, score_name_match, extract_last_name, and soundex
are generic — parameterized by entity type for future person matching.
"""

import re
from dataclasses import dataclass, field
from typing import Optional, Literal

from rapidfuzz import fuzz
from sqlalchemy import select, func
from sqlalchemy.orm import joinedload

from models import Judge


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

TITLE_PREFIXES = {
    "judge": [
        "the honorable", "honorable", "magistrate judge", "magistrate",
        "chief judge", "senior judge", "judge", "hon.", "mag.", "hon", "mag",
    ],
    "person": [
        "dr.", "dr", "prof.", "prof", "mr.", "mr", "mrs.", "mrs",
        "ms.", "ms", "esq.", "esq",
    ],
}

# Thresholds when jurisdiction is provided (narrower candidate set)
THRESHOLDS_WITH_JURISDICTION = {
    "high": 75,
    "medium": 40,
    "gap": 10,
}

# Stricter thresholds without jurisdiction (wider search)
THRESHOLDS_WITHOUT_JURISDICTION = {
    "high": 85,
    "medium": 55,
    "gap": 15,
}


# ---------------------------------------------------------------------------
# Result types
# ---------------------------------------------------------------------------

@dataclass
class MatchCandidate:
    judge_id: int
    name: str
    score: float
    jurisdiction_id: Optional[int] = None
    jurisdiction_name: Optional[str] = None


@dataclass
class MatchResult:
    match_type: Literal["exact", "fuzzy", "ambiguous", "none"]
    judge: Optional[MatchCandidate] = None
    candidates: list[MatchCandidate] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Name normalization (generic by entity)
# ---------------------------------------------------------------------------

def normalize_name(name: str, entity: str = "judge") -> str:
    """Clean a name for comparison.

    1. Lowercase, strip
    2. "Last, First" → "First Last"
    3. Strip entity-specific title prefixes (longest first)
    4. Remove periods from initials
    5. Collapse whitespace
    """
    s = name.lower().strip()

    # "Last, First" → "First Last"
    if "," in s:
        parts = [p.strip() for p in s.split(",", 1)]
        if len(parts) == 2 and parts[1]:
            s = f"{parts[1]} {parts[0]}"

    # Strip title prefixes (longest first to match "magistrate judge" before "judge")
    prefixes = sorted(TITLE_PREFIXES.get(entity, []), key=len, reverse=True)
    for prefix in prefixes:
        if s.startswith(prefix):
            s = s[len(prefix):].lstrip(". ")

    # Remove periods (for initials like "D." → "D")
    s = s.replace(".", "")

    # Collapse whitespace
    s = re.sub(r"\s+", " ", s).strip()

    return s


def extract_last_name(normalized: str) -> str:
    """Return the last token of a normalized name."""
    parts = normalized.split()
    return parts[-1] if parts else ""


# ---------------------------------------------------------------------------
# Soundex (standard American Soundex)
# ---------------------------------------------------------------------------

_SOUNDEX_MAP = {
    "b": "1", "f": "1", "p": "1", "v": "1",
    "c": "2", "g": "2", "j": "2", "k": "2", "q": "2", "s": "2",
    "x": "2", "z": "2",
    "d": "3", "t": "3",
    "l": "4",
    "m": "5", "n": "5",
    "r": "6",
}


def soundex(name: str) -> str:
    """Standard American Soundex. Maps 'Gee'/'Gi'/'Gei' → same code."""
    s = re.sub(r"[^a-z]", "", name.lower())
    if not s:
        return ""

    result = s[0].upper()
    prev = _SOUNDEX_MAP.get(s[0], "")

    for ch in s[1:]:
        code = _SOUNDEX_MAP.get(ch, "")
        if code and code != prev:
            result += code
        prev = code if code else prev

    return (result + "000")[:4]


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

def score_name_match(input_name: str, candidate_name: str, entity: str = "judge") -> float:
    """Weighted score combining multiple fuzzy algorithms + phonetic bonus.

    Components:
    - last_name (40%): fuzz.ratio on extracted last names
    - full_name (30%): fuzz.token_sort_ratio on full normalized names
    - partial (15%): fuzz.partial_ratio for substring matches
    - phonetic_bonus (flat +15): if last names share Soundex code
    """
    norm_input = normalize_name(input_name, entity)
    norm_candidate = normalize_name(candidate_name, entity)

    input_last = extract_last_name(norm_input)
    candidate_last = extract_last_name(norm_candidate)

    # Weighted components
    last_score = fuzz.ratio(input_last, candidate_last) * 0.40
    full_score = fuzz.token_sort_ratio(norm_input, norm_candidate) * 0.30
    partial_score = fuzz.partial_ratio(norm_input, norm_candidate) * 0.15

    # Phonetic bonus
    phonetic_bonus = 0.0
    if input_last and candidate_last:
        if soundex(input_last) == soundex(candidate_last):
            phonetic_bonus = 15.0

    return last_score + full_score + partial_score + phonetic_bonus


# ---------------------------------------------------------------------------
# Judge resolution (used by import_case)
# ---------------------------------------------------------------------------

def resolve_judge(session, name: str, jurisdiction_id: int = None) -> MatchResult:
    """Resolve a judge name against existing judges.

    1. Exact match (case-insensitive) → "exact"
    2. Fuzzy scoring against candidates → "fuzzy" / "ambiguous" / "none"

    Jurisdiction is optional — when provided, narrows candidates and uses
    lower thresholds. Without it, thresholds are raised.
    """
    # Fast path: exact match on original name
    exact_stmt = select(Judge).options(joinedload(Judge.jurisdiction)).where(
        func.lower(Judge.name) == func.lower(name.strip())
    )
    if jurisdiction_id:
        exact_stmt = exact_stmt.where(Judge.jurisdiction_id == jurisdiction_id)

    exact = session.scalars(exact_stmt).unique().first()
    if exact:
        return MatchResult(
            match_type="exact",
            judge=MatchCandidate(
                judge_id=exact.id,
                name=exact.name,
                score=100.0,
                jurisdiction_id=exact.jurisdiction_id,
                jurisdiction_name=exact.jurisdiction.name if exact.jurisdiction else None,
            ),
        )

    # Also try exact match without jurisdiction scope (might exist in another)
    if jurisdiction_id:
        exact_any = session.scalars(
            select(Judge).options(joinedload(Judge.jurisdiction)).where(
                func.lower(Judge.name) == func.lower(name.strip())
            )
        ).unique().first()
        if exact_any:
            return MatchResult(
                match_type="exact",
                judge=MatchCandidate(
                    judge_id=exact_any.id,
                    name=exact_any.name,
                    score=100.0,
                    jurisdiction_id=exact_any.jurisdiction_id,
                    jurisdiction_name=exact_any.jurisdiction.name if exact_any.jurisdiction else None,
                ),
            )

    # Build candidate set
    candidate_stmt = select(Judge).options(joinedload(Judge.jurisdiction))
    if jurisdiction_id:
        # Judges in this jurisdiction + judges with NULL jurisdiction
        candidate_stmt = candidate_stmt.where(
            (Judge.jurisdiction_id == jurisdiction_id) | (Judge.jurisdiction_id.is_(None))
        )

    candidates = session.scalars(candidate_stmt).unique().all()
    if not candidates:
        return MatchResult(match_type="none")

    # Score each candidate
    scored = []
    for judge in candidates:
        score = score_name_match(name, judge.name)
        scored.append(MatchCandidate(
            judge_id=judge.id,
            name=judge.name,
            score=round(score, 1),
            jurisdiction_id=judge.jurisdiction_id,
            jurisdiction_name=judge.jurisdiction.name if judge.jurisdiction else None,
        ))

    scored.sort(key=lambda c: c.score, reverse=True)

    # Select thresholds
    thresholds = (
        THRESHOLDS_WITH_JURISDICTION if jurisdiction_id
        else THRESHOLDS_WITHOUT_JURISDICTION
    )
    high = thresholds["high"]
    medium = thresholds["medium"]
    gap = thresholds["gap"]

    top = scored[0]
    second_score = scored[1].score if len(scored) > 1 else 0.0

    # High confidence with clear gap → auto-assign
    if top.score >= high and (top.score - second_score) >= gap:
        return MatchResult(match_type="fuzzy", judge=top)

    # Medium confidence or ambiguous → return candidates for review
    if top.score >= medium:
        # Return top candidates above medium threshold
        above_medium = [c for c in scored if c.score >= medium]
        return MatchResult(match_type="ambiguous", candidates=above_medium[:5])

    # Below medium → no match
    return MatchResult(match_type="none")


# ---------------------------------------------------------------------------
# Fuzzy search (used by search_judges fallback)
# ---------------------------------------------------------------------------

def fuzzy_search_judges(session, name: str, jurisdiction_id: int = None,
                        limit: int = 10) -> list[dict]:
    """Fuzzy search for judges by name. Returns scored results."""
    candidate_stmt = select(Judge).options(joinedload(Judge.jurisdiction))
    if jurisdiction_id:
        candidate_stmt = candidate_stmt.where(
            (Judge.jurisdiction_id == jurisdiction_id) | (Judge.jurisdiction_id.is_(None))
        )

    candidates = session.scalars(candidate_stmt).unique().all()
    if not candidates:
        return []

    scored = []
    for judge in candidates:
        score = score_name_match(name, judge.name)
        if score >= 25:  # minimum relevance threshold
            scored.append({
                "id": judge.id,
                "name": judge.name,
                "title": judge.title,
                "score": round(score, 1),
                "jurisdiction_id": judge.jurisdiction_id,
                "jurisdiction_name": judge.jurisdiction.name if judge.jurisdiction else None,
                "fuzzy_match": score < 90,
            })

    scored.sort(key=lambda c: c["score"], reverse=True)
    return scored[:limit]
