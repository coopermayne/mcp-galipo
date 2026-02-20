"""SQLAlchemy ORM models — auto-generated via sqlacodegen, then cleaned up.

Source of truth for the database schema. Alembic migrations are generated
by diffing these models against the live database.
"""

from __future__ import annotations

from typing import Any, Optional
import datetime
import uuid

from sqlalchemy import (
    ARRAY,
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKeyConstraint,
    Index,
    Integer,
    PrimaryKeyConstraint,
    Sequence,
    String,
    Text,
    Time,
    UniqueConstraint,
    Uuid,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# Independent tables (no FK dependencies)
# ---------------------------------------------------------------------------


class Intake(Base):
    __tablename__ = "intakes"
    __table_args__ = (
        PrimaryKeyConstraint("id", name="intakes_pkey"),
        UniqueConstraint("google_row_number", name="intakes_google_row_number_key"),
        Index("idx_intakes_status", "status"),
        Index("idx_intakes_submitted_on", "submitted_on"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Sheet fields
    submitted_on: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)
    name: Mapped[Optional[str]] = mapped_column(String(255))
    email: Mapped[Optional[str]] = mapped_column(String(255))
    phone: Mapped[Optional[str]] = mapped_column(String(100))
    case_type: Mapped[Optional[str]] = mapped_column(String(255))
    incident_date: Mapped[Optional[datetime.date]] = mapped_column(Date)
    incident_time: Mapped[Optional[str]] = mapped_column(String(50))
    location: Mapped[Optional[str]] = mapped_column(Text)
    incident_description: Mapped[Optional[str]] = mapped_column(Text)
    injury_description: Mapped[Optional[str]] = mapped_column(Text)
    disclaimer_accepted: Mapped[Optional[bool]] = mapped_column(
        Boolean, server_default=text("false")
    )
    # Galipo fields
    status: Mapped[str] = mapped_column(
        String(50), server_default=text("'New'::character varying")
    )
    referral_note: Mapped[Optional[str]] = mapped_column(Text)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    ai_summary: Mapped[Optional[str]] = mapped_column(Text)
    ai_rating: Mapped[Optional[int]] = mapped_column(Integer)
    ai_rating_reasoning: Mapped[Optional[str]] = mapped_column(Text)
    google_row_number: Mapped[Optional[int]] = mapped_column(Integer, unique=True, nullable=True)
    # Timestamps
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime, server_default=text("CURRENT_TIMESTAMP")
    )
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime, server_default=text("CURRENT_TIMESTAMP")
    )

    # Relationships
    comments: Mapped[list[IntakeComment]] = relationship(back_populates="intake")


class IntakeComment(Base):
    __tablename__ = "intake_comments"
    __table_args__ = (
        ForeignKeyConstraint(
            ["intake_id"],
            ["intakes.id"],
            ondelete="CASCADE",
            name="intake_comments_intake_id_fkey",
        ),
        ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="SET NULL",
            name="intake_comments_user_id_fkey",
        ),
        PrimaryKeyConstraint("id", name="intake_comments_pkey"),
        Index("idx_intake_comments_intake_id", "intake_id"),
        Index("idx_intake_comments_user_id", "user_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    intake_id: Mapped[int] = mapped_column(Integer)
    user_id: Mapped[Optional[int]] = mapped_column(Integer)
    content: Mapped[str] = mapped_column(Text)
    is_system: Mapped[Optional[bool]] = mapped_column(
        Boolean, server_default=text("false")
    )
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime, server_default=text("CURRENT_TIMESTAMP")
    )
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime, server_default=text("CURRENT_TIMESTAMP")
    )

    # Relationships
    intake: Mapped[Intake] = relationship(back_populates="comments")
    user: Mapped[Optional[User]] = relationship()


class IntakeCommentRead(Base):
    __tablename__ = "intake_comment_reads"
    __table_args__ = (
        ForeignKeyConstraint(
            ["intake_id"],
            ["intakes.id"],
            ondelete="CASCADE",
            name="intake_comment_reads_intake_id_fkey",
        ),
        ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
            name="intake_comment_reads_user_id_fkey",
        ),
        PrimaryKeyConstraint("intake_id", "user_id", name="intake_comment_reads_pkey"),
    )

    intake_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    last_read_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime, server_default=text("CURRENT_TIMESTAMP")
    )


class Objection(Base):
    __tablename__ = "objections"
    __table_args__ = (
        PrimaryKeyConstraint("id", name="objections_pkey"),
        UniqueConstraint("short_name", name="objections_short_name_key"),
        Index("idx_objections_position", "position"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    short_name: Mapped[str] = mapped_column(String(50))
    formal_language: Mapped[str] = mapped_column(Text)
    argument_template: Mapped[Optional[str]] = mapped_column(Text)
    ai_notes: Mapped[Optional[str]] = mapped_column(Text)
    position: Mapped[Optional[int]] = mapped_column(
        Integer, server_default=text("0")
    )
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime, server_default=text("CURRENT_TIMESTAMP")
    )
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime, server_default=text("CURRENT_TIMESTAMP")
    )


class Case(Base):
    __tablename__ = "cases"
    __table_args__ = (
        PrimaryKeyConstraint("id", name="cases_pkey"),
        Index("idx_cases_attorney_ids", "attorney_ids"),
        Index("idx_cases_paralegal_ids", "paralegal_ids"),
        Index("idx_cases_status", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    case_name: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(
        String(50), server_default=text("'Signing Up'::character varying")
    )
    short_name: Mapped[Optional[str]] = mapped_column(String(100))
    print_code: Mapped[Optional[str]] = mapped_column(String(50))
    case_summary: Mapped[Optional[str]] = mapped_column(Text)
    result: Mapped[Optional[str]] = mapped_column(Text)
    date_of_injury: Mapped[Optional[datetime.date]] = mapped_column(Date)
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime, server_default=text("CURRENT_TIMESTAMP")
    )
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime, server_default=text("CURRENT_TIMESTAMP")
    )
    color: Mapped[Optional[str]] = mapped_column(String(20))
    attorney_ids: Mapped[Optional[list[int]]] = mapped_column(
        ARRAY(Integer()), server_default=text("'{}'::integer[]")
    )
    paralegal_ids: Mapped[Optional[list[int]]] = mapped_column(
        ARRAY(Integer()), server_default=text("'{}'::integer[]")
    )

    # Relationships
    events: Mapped[list[Event]] = relationship(back_populates="case")
    notes: Mapped[list[Note]] = relationship(back_populates="case")
    person_roles: Mapped[list[PersonRole]] = relationship(back_populates="case")
    proceedings: Mapped[list[Proceeding]] = relationship(back_populates="case")
    tasks: Mapped[list[Task]] = relationship(back_populates="case")


class ExpertiseType(Base):
    __tablename__ = "expertise_types"
    __table_args__ = (
        PrimaryKeyConstraint("id", name="expertise_types_pkey"),
        UniqueConstraint("name", name="expertise_types_name_key"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime, server_default=text("CURRENT_TIMESTAMP")
    )


class Jurisdiction(Base):
    __tablename__ = "jurisdictions"
    __table_args__ = (
        PrimaryKeyConstraint("id", name="jurisdictions_pkey"),
        UniqueConstraint("name", name="jurisdictions_name_key"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    aliases: Mapped[Optional[list]] = mapped_column(JSONB, server_default=text("'[]'::jsonb"))
    local_rules_link: Mapped[Optional[str]] = mapped_column(Text)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime, server_default=text("CURRENT_TIMESTAMP")
    )

    # Relationships
    judges: Mapped[list[Judge]] = relationship(back_populates="jurisdiction")
    proceedings: Mapped[list[Proceeding]] = relationship(back_populates="jurisdiction")


class Person(Base):
    __tablename__ = "persons"
    __table_args__ = (
        PrimaryKeyConstraint("id", name="persons_pkey1"),
        Index("idx_persons_archived", "archived"),
        Index("idx_persons_name", "name"),
    )

    id: Mapped[int] = mapped_column(
        Integer, Sequence("persons_id_seq1"), primary_key=True
    )
    name: Mapped[str] = mapped_column(String(255))
    phones: Mapped[Optional[list[Any]]] = mapped_column(
        JSONB, server_default=text("'[]'::jsonb")
    )
    emails: Mapped[Optional[list[Any]]] = mapped_column(
        JSONB, server_default=text("'[]'::jsonb")
    )
    address: Mapped[Optional[str]] = mapped_column(Text)
    organization: Mapped[Optional[str]] = mapped_column(String(255))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime, server_default=text("CURRENT_TIMESTAMP")
    )
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime, server_default=text("CURRENT_TIMESTAMP")
    )
    archived: Mapped[Optional[bool]] = mapped_column(
        Boolean, server_default=text("false")
    )

    # Relationships
    roles: Mapped[list[PersonRole]] = relationship(
        foreign_keys="[PersonRole.person_id]", back_populates="person"
    )
    grouped_dependents: Mapped[list[PersonRole]] = relationship(
        foreign_keys="[PersonRole.grouped_under_id]", back_populates="grouped_under"
    )


class Role(Base):
    __tablename__ = "roles"
    __table_args__ = (
        PrimaryKeyConstraint("id", name="roles_pkey"),
        UniqueConstraint("name", name="roles_name_key"),
        Index("idx_roles_category", "category"),
        Index("idx_roles_sort_order", "sort_order"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    category: Mapped[str] = mapped_column(String(50))
    sort_order: Mapped[Optional[int]] = mapped_column(
        Integer, server_default=text("0")
    )
    description: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime, server_default=text("CURRENT_TIMESTAMP")
    )

    # Relationships
    person_roles: Mapped[list[PersonRole]] = relationship(back_populates="role")


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        ForeignKeyConstraint(
            ["paralegal_id"],
            ["users.id"],
            ondelete="SET NULL",
            name="users_paralegal_id_fkey",
        ),
        PrimaryKeyConstraint("id", name="users_pkey"),
        UniqueConstraint("email", name="users_email_key"),
        Index("idx_users_email", "email"),
        Index("idx_users_is_active", "is_active"),
        Index("idx_users_paralegal_id", "paralegal_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255))
    password_hash: Mapped[str] = mapped_column(String(255))
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    initials: Mapped[str] = mapped_column(String(10))
    position: Mapped[str] = mapped_column(String(50))
    bar_number: Mapped[Optional[str]] = mapped_column(String(50))
    is_admin: Mapped[Optional[bool]] = mapped_column(
        Boolean, server_default=text("false")
    )
    must_change_password: Mapped[Optional[bool]] = mapped_column(
        Boolean, server_default=text("true")
    )
    is_active: Mapped[Optional[bool]] = mapped_column(
        Boolean, server_default=text("true")
    )
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime, server_default=text("CURRENT_TIMESTAMP")
    )
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime, server_default=text("CURRENT_TIMESTAMP")
    )
    paralegal_id: Mapped[Optional[int]] = mapped_column(Integer)
    visible_features: Mapped[Optional[dict]] = mapped_column(JSONB)

    # Relationships
    paralegal: Mapped[Optional[User]] = relationship(
        remote_side=[id], back_populates="paralegals"
    )
    paralegals: Mapped[list[User]] = relationship(
        remote_side=[paralegal_id], back_populates="paralegal"
    )
    tasks: Mapped[list[Task]] = relationship(back_populates="assignee")


# ---------------------------------------------------------------------------
# Child tables (have FK dependencies on tables above)
# ---------------------------------------------------------------------------


class Event(Base):
    __tablename__ = "events"
    __table_args__ = (
        ForeignKeyConstraint(
            ["case_id"],
            ["cases.id"],
            ondelete="CASCADE",
            name="deadlines_case_id_fkey",
        ),
        PrimaryKeyConstraint("id", name="deadlines_pkey"),
        Index("idx_events_attendee_ids", "attendee_ids"),
        Index("idx_events_case_id", "case_id"),
        Index("idx_events_date", "date"),
    )

    id: Mapped[int] = mapped_column(
        Integer, Sequence("deadlines_id_seq"), primary_key=True
    )
    date: Mapped[datetime.date] = mapped_column(Date)
    description: Mapped[str] = mapped_column(Text)
    case_id: Mapped[Optional[int]] = mapped_column(Integer)
    time: Mapped[Optional[datetime.time]] = mapped_column(Time)
    location: Mapped[Optional[str]] = mapped_column(String(255))
    document_link: Mapped[Optional[str]] = mapped_column(Text)
    calculation_note: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime, server_default=text("CURRENT_TIMESTAMP")
    )
    starred: Mapped[Optional[bool]] = mapped_column(
        Boolean, server_default=text("false")
    )
    attendee_ids: Mapped[Optional[list[int]]] = mapped_column(
        ARRAY(Integer()), server_default=text("'{}'::integer[]")
    )

    # Relationships
    case: Mapped[Optional[Case]] = relationship(back_populates="events")
    tasks: Mapped[list[Task]] = relationship(back_populates="event")
    webhook_logs: Mapped[list[WebhookLog]] = relationship(back_populates="event")


class Judge(Base):
    __tablename__ = "judges"
    __table_args__ = (
        ForeignKeyConstraint(
            ["jurisdiction_id"],
            ["jurisdictions.id"],
            ondelete="SET NULL",
            name="judges_jurisdiction_id_fkey",
        ),
        PrimaryKeyConstraint("id", name="judges_pkey"),
        Index("idx_judges_jurisdiction_id", "jurisdiction_id"),
        Index("idx_judges_name", "name"),
        Index("idx_judges_status", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    title: Mapped[Optional[str]] = mapped_column(String(100))
    phones: Mapped[Optional[list[Any]]] = mapped_column(
        JSONB, server_default=text("'[]'::jsonb")
    )
    emails: Mapped[Optional[list[Any]]] = mapped_column(
        JSONB, server_default=text("'[]'::jsonb")
    )
    jurisdiction_id: Mapped[Optional[int]] = mapped_column(Integer)
    chambers: Mapped[Optional[str]] = mapped_column(Text)
    courtroom_number: Mapped[Optional[str]] = mapped_column(String(50))
    appointed_by: Mapped[Optional[str]] = mapped_column(String(255))
    appointed_date: Mapped[Optional[datetime.date]] = mapped_column(Date)
    initials: Mapped[Optional[str]] = mapped_column(String(10))
    status: Mapped[Optional[str]] = mapped_column(
        String(50), server_default=text("'Active'::character varying")
    )
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime, server_default=text("CURRENT_TIMESTAMP")
    )
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime, server_default=text("CURRENT_TIMESTAMP")
    )

    # Relationships
    jurisdiction: Mapped[Optional[Jurisdiction]] = relationship(
        back_populates="judges"
    )
    proceeding_judges: Mapped[list[ProceedingJudge]] = relationship(
        back_populates="judge"
    )


class Note(Base):
    __tablename__ = "notes"
    __table_args__ = (
        ForeignKeyConstraint(
            ["case_id"],
            ["cases.id"],
            ondelete="CASCADE",
            name="notes_case_id_fkey",
        ),
        PrimaryKeyConstraint("id", name="notes_pkey"),
        Index("idx_notes_case_id", "case_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    content: Mapped[str] = mapped_column(Text)
    case_id: Mapped[Optional[int]] = mapped_column(Integer)
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime, server_default=text("CURRENT_TIMESTAMP")
    )
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime, server_default=text("CURRENT_TIMESTAMP")
    )

    # Relationships
    case: Mapped[Optional[Case]] = relationship(back_populates="notes")


class PersonRole(Base):
    """Junction table linking persons to roles, optionally scoped to a case.

    The partial unique indexes enforce:
    - One person+role combo per case (when case_id IS NOT NULL)
    - One person+role combo globally for standalone roles (when case_id IS NULL)
    """

    __tablename__ = "person_roles"
    __table_args__ = (
        ForeignKeyConstraint(
            ["case_id"],
            ["cases.id"],
            ondelete="CASCADE",
            name="person_roles_case_id_fkey",
        ),
        ForeignKeyConstraint(
            ["grouped_under_id"],
            ["persons.id"],
            ondelete="SET NULL",
            name="person_roles_grouped_under_id_fkey",
        ),
        ForeignKeyConstraint(
            ["person_id"],
            ["persons.id"],
            ondelete="CASCADE",
            name="person_roles_person_id_fkey",
        ),
        ForeignKeyConstraint(
            ["role_id"],
            ["roles.id"],
            ondelete="RESTRICT",
            name="person_roles_role_id_fkey",
        ),
        PrimaryKeyConstraint("id", name="person_roles_pkey"),
        Index("idx_person_roles_attributes", "attributes"),
        Index("idx_person_roles_case_id", "case_id"),
        Index("idx_person_roles_person_id", "person_id"),
        Index("idx_person_roles_role_id", "role_id"),
        # Partial unique indexes — sqlacodegen misses the WHERE clauses
        Index(
            "uq_person_roles_case",
            "person_id",
            "role_id",
            "case_id",
            unique=True,
            postgresql_where=text("case_id IS NOT NULL"),
        ),
        Index(
            "uq_person_roles_standalone",
            "person_id",
            "role_id",
            unique=True,
            postgresql_where=text("case_id IS NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    person_id: Mapped[int] = mapped_column(Integer)
    role_id: Mapped[int] = mapped_column(Integer)
    case_id: Mapped[Optional[int]] = mapped_column(Integer)
    attributes: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb")
    )
    notes: Mapped[Optional[str]] = mapped_column(Text)
    is_primary: Mapped[Optional[bool]] = mapped_column(
        Boolean, server_default=text("false")
    )
    grouped_under_id: Mapped[Optional[int]] = mapped_column(Integer)
    assigned_date: Mapped[Optional[datetime.date]] = mapped_column(Date)
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime, server_default=text("CURRENT_TIMESTAMP")
    )

    # Relationships
    case: Mapped[Optional[Case]] = relationship(back_populates="person_roles")
    grouped_under: Mapped[Optional[Person]] = relationship(
        foreign_keys=[grouped_under_id], back_populates="grouped_dependents"
    )
    person: Mapped[Person] = relationship(
        foreign_keys=[person_id], back_populates="roles"
    )
    role: Mapped[Role] = relationship(back_populates="person_roles")


class Proceeding(Base):
    __tablename__ = "proceedings"
    __table_args__ = (
        ForeignKeyConstraint(
            ["case_id"],
            ["cases.id"],
            ondelete="CASCADE",
            name="proceedings_case_id_fkey",
        ),
        ForeignKeyConstraint(
            ["jurisdiction_id"],
            ["jurisdictions.id"],
            name="proceedings_jurisdiction_id_fkey",
        ),
        PrimaryKeyConstraint("id", name="proceedings_pkey"),
        Index("idx_proceedings_case_id", "case_id"),
        Index("idx_proceedings_courtlistener_docket_id", "courtlistener_docket_id"),
        Index("idx_proceedings_pacer_case_id", "pacer_case_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    case_number: Mapped[str] = mapped_column(String(100))
    case_id: Mapped[Optional[int]] = mapped_column(Integer)
    jurisdiction_id: Mapped[Optional[int]] = mapped_column(Integer)
    sort_order: Mapped[Optional[int]] = mapped_column(
        Integer, server_default=text("0")
    )
    is_primary: Mapped[Optional[bool]] = mapped_column(
        Boolean, server_default=text("false")
    )
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime, server_default=text("CURRENT_TIMESTAMP")
    )
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime, server_default=text("CURRENT_TIMESTAMP")
    )
    courtlistener_docket_id: Mapped[Optional[int]] = mapped_column(BigInteger)
    pacer_case_id: Mapped[Optional[str]] = mapped_column(String(100))

    # Relationships
    case: Mapped[Optional[Case]] = relationship(back_populates="proceedings")
    jurisdiction: Mapped[Optional[Jurisdiction]] = relationship(
        back_populates="proceedings"
    )
    proceeding_judges: Mapped[list[ProceedingJudge]] = relationship(
        back_populates="proceeding", cascade="all, delete-orphan"
    )
    webhook_logs: Mapped[list[WebhookLog]] = relationship(back_populates="proceeding")


class ProceedingJudge(Base):
    __tablename__ = "proceeding_judges"
    __table_args__ = (
        ForeignKeyConstraint(
            ["judge_id"],
            ["judges.id"],
            ondelete="CASCADE",
            name="proceeding_judges_judge_id_fkey",
        ),
        ForeignKeyConstraint(
            ["proceeding_id"],
            ["proceedings.id"],
            ondelete="CASCADE",
            name="proceeding_judges_proceeding_id_fkey1",
        ),
        PrimaryKeyConstraint("id", name="proceeding_judges_pkey1"),
        UniqueConstraint(
            "proceeding_id",
            "judge_id",
            name="proceeding_judges_proceeding_id_judge_id_key",
        ),
        Index("idx_proceeding_judges_judge_id", "judge_id"),
        Index("idx_proceeding_judges_proceeding_id", "proceeding_id"),
    )

    id: Mapped[int] = mapped_column(
        Integer, Sequence("proceeding_judges_id_seq1"), primary_key=True
    )
    proceeding_id: Mapped[int] = mapped_column(Integer)
    judge_id: Mapped[int] = mapped_column(Integer)
    role: Mapped[Optional[str]] = mapped_column(
        String(50), server_default=text("'Judge'::character varying")
    )
    sort_order: Mapped[Optional[int]] = mapped_column(
        Integer, server_default=text("0")
    )
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime, server_default=text("CURRENT_TIMESTAMP")
    )

    # Relationships
    judge: Mapped[Judge] = relationship(back_populates="proceeding_judges")
    proceeding: Mapped[Proceeding] = relationship(back_populates="proceeding_judges")


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint(
            "urgency::text = ANY (ARRAY['Low'::character varying, "
            "'Medium'::character varying, 'High'::character varying, "
            "'Urgent'::character varying]::text[])",
            name="tasks_urgency_check",
        ),
        ForeignKeyConstraint(
            ["assignee_id"],
            ["users.id"],
            ondelete="SET NULL",
            name="tasks_assignee_id_fkey",
        ),
        ForeignKeyConstraint(
            ["case_id"],
            ["cases.id"],
            ondelete="CASCADE",
            name="tasks_case_id_fkey",
        ),
        ForeignKeyConstraint(
            ["event_id"],
            ["events.id"],
            ondelete="SET NULL",
            name="tasks_deadline_id_fkey",
        ),
        PrimaryKeyConstraint("id", name="tasks_pkey"),
        Index("idx_tasks_assignee_id", "assignee_id"),
        Index("idx_tasks_case_id", "case_id"),
        Index("idx_tasks_sort_order", "sort_order"),
        Index("idx_tasks_status", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    description: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        String(50), server_default=text("'Pending'::character varying")
    )
    case_id: Mapped[Optional[int]] = mapped_column(Integer)
    event_id: Mapped[Optional[int]] = mapped_column(Integer)
    due_date: Mapped[Optional[datetime.date]] = mapped_column(Date)
    completion_date: Mapped[Optional[datetime.date]] = mapped_column(Date)
    urgency: Mapped[Optional[str]] = mapped_column(
        String(20), server_default=text("'Medium'::character varying")
    )
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime, server_default=text("CURRENT_TIMESTAMP")
    )
    sort_order: Mapped[Optional[int]] = mapped_column(
        Integer, server_default=text("0")
    )
    docket_category: Mapped[Optional[str]] = mapped_column(String(20))
    docket_order: Mapped[Optional[int]] = mapped_column(Integer)
    assignee_id: Mapped[Optional[int]] = mapped_column(Integer)
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime, server_default=text("CURRENT_TIMESTAMP")
    )

    # Relationships
    assignee: Mapped[Optional[User]] = relationship(back_populates="tasks")
    case: Mapped[Optional[Case]] = relationship(back_populates="tasks")
    event: Mapped[Optional[Event]] = relationship(back_populates="tasks")
    webhook_logs: Mapped[list[WebhookLog]] = relationship(back_populates="task")


class WebhookLog(Base):
    __tablename__ = "webhook_logs"
    __table_args__ = (
        ForeignKeyConstraint(
            ["event_id"],
            ["events.id"],
            ondelete="SET NULL",
            name="webhook_logs_event_id_fkey",
        ),
        ForeignKeyConstraint(
            ["proceeding_id"],
            ["proceedings.id"],
            ondelete="SET NULL",
            name="webhook_logs_proceeding_id_fkey",
        ),
        ForeignKeyConstraint(
            ["task_id"],
            ["tasks.id"],
            ondelete="SET NULL",
            name="webhook_logs_task_id_fkey",
        ),
        PrimaryKeyConstraint("id", name="webhook_logs_pkey"),
        UniqueConstraint("idempotency_key", name="webhook_logs_idempotency_key_key"),
        Index("idx_webhook_logs_created_at", "created_at"),
        Index("idx_webhook_logs_idempotency_key", "idempotency_key"),
        Index("idx_webhook_logs_proceeding_id", "proceeding_id"),
        Index("idx_webhook_logs_source", "source"),
        Index("idx_webhook_logs_status", "processing_status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source: Mapped[str] = mapped_column(String(50))
    payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb")
    )
    processing_status: Mapped[str] = mapped_column(
        String(20), server_default=text("'pending'::character varying")
    )
    event_type: Mapped[Optional[str]] = mapped_column(String(100))
    idempotency_key: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    headers: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb")
    )
    proceeding_id: Mapped[Optional[int]] = mapped_column(Integer)
    task_id: Mapped[Optional[int]] = mapped_column(Integer)
    event_id: Mapped[Optional[int]] = mapped_column(Integer)
    processing_error: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime, server_default=text("CURRENT_TIMESTAMP")
    )
    processed_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)

    # Relationships
    event: Mapped[Optional[Event]] = relationship(back_populates="webhook_logs")
    proceeding: Mapped[Optional[Proceeding]] = relationship(
        back_populates="webhook_logs"
    )
    task: Mapped[Optional[Task]] = relationship(back_populates="webhook_logs")
