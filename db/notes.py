"""
Note management functions.
"""

from typing import Optional

from sqlalchemy import select, func

from .session import SessionLocal
from models import Note, Case
from schemas import NoteOut


def _note_to_dict(note: Note) -> dict:
    """Convert a Note ORM instance to a serializable dict."""
    return NoteOut.model_validate(note).model_dump(mode="json")


def _note_with_case_to_dict(note: Note, case: Case) -> dict:
    """Convert a Note + Case pair to a serializable dict (for get_notes join)."""
    d = _note_to_dict(note)
    d["case_name"] = case.case_name if case else None
    d["short_name"] = case.short_name if case else None
    return d


def add_note(case_id: int, content: str) -> dict:
    """Add a note to a case."""
    with SessionLocal() as session:
        note = Note(case_id=case_id, content=content)
        session.add(note)
        session.flush()
        session.refresh(note)
        result = _note_to_dict(note)
        session.commit()
        return result


def update_note(note_id: int, content: str) -> Optional[dict]:
    """Update a note's content."""
    with SessionLocal() as session:
        note = session.get(Note, note_id)
        if not note:
            return None

        note.content = content
        note.updated_at = func.now()
        session.flush()
        session.refresh(note)
        result = _note_to_dict(note)
        session.commit()
        return result


def delete_note(note_id: int) -> bool:
    """Delete a note."""
    with SessionLocal() as session:
        note = session.get(Note, note_id)
        if not note:
            return False
        session.delete(note)
        session.commit()
        return True


def get_notes(case_id: int = None) -> dict:
    """Get notes, optionally filtered by case."""
    with SessionLocal() as session:
        # Count
        count_stmt = select(func.count(Note.id))
        if case_id:
            count_stmt = count_stmt.where(Note.case_id == case_id)
        total = session.scalar(count_stmt)

        # Notes with case info
        stmt = (
            select(Note, Case)
            .join(Case, Note.case_id == Case.id)
            .order_by(Note.created_at.desc())
        )
        if case_id:
            stmt = stmt.where(Note.case_id == case_id)

        rows = session.execute(stmt).all()
        return {
            "notes": [_note_with_case_to_dict(note, case) for note, case in rows],
            "total": total,
        }
