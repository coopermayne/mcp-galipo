# Database Schema

Entity-relationship diagram for the Galipo legal case management system.

> **Auto-generated** on 2026-02-06 14:53:36 by `scripts/generate_schema_diagram.py`
> (via [SchemaCrawler](https://www.schemacrawler.com/) Docker image)
>
> To regenerate: `python scripts/generate_schema_diagram.py`
>
> Requires Docker.

## ER Diagram

```mermaid
erDiagram

  cases {
    serial id PK
    varchar case_name
    varchar short_name
    varchar status
    varchar print_code
    text case_summary
    text result
    date date_of_injury
    varchar color
    _int4 attorney_ids
    _int4 paralegal_ids
    timestamptz created_at
    timestamptz updated_at
  }

  expertise_types {
    serial id PK
    varchar name UK
    text description
    timestamptz created_at
  }

  jurisdictions {
    serial id PK
    varchar name UK
    varchar long_name
    text local_rules_link
    text notes
    timestamptz created_at
  }

  persons {
    serial id PK
    varchar name
    jsonb phones
    jsonb emails
    text address
    varchar organization
    text notes
    timestamptz created_at
    timestamptz updated_at
    bool archived
  }

  roles {
    serial id PK
    varchar name UK
    varchar category
    int4 sort_order
    text description
    timestamptz created_at
  }

  schema_migrations {
    serial id PK
    varchar filename UK
    timestamptz applied_at
  }

  users {
    serial id PK
    varchar email UK
    varchar password_hash
    varchar first_name
    varchar last_name
    varchar initials
    varchar bar_number
    varchar position
    bool is_admin
    bool must_change_password
    bool is_active
    int4 paralegal_id FK
    timestamptz created_at
    timestamptz updated_at
  }

  activities {
    serial id PK
    int4 case_id FK
    date date
    text description
    varchar type
    int4 minutes
    timestamptz created_at
  }

  events {
    serial id PK
    int4 case_id FK
    date date
    time time
    varchar location
    text description
    text document_link
    text calculation_note
    bool starred
    _int4 attendee_ids
    timestamptz created_at
  }

  judges {
    serial id PK
    varchar name
    jsonb phones
    jsonb emails
    int4 jurisdiction_id FK
    text chambers
    varchar courtroom_number
    varchar appointed_by
    date appointed_date
    varchar initials
    varchar status
    text notes
    timestamptz created_at
    timestamptz updated_at
  }

  notes {
    serial id PK
    int4 case_id FK
    text content
    bool starred
    timestamptz created_at
    timestamptz updated_at
  }

  person_roles {
    serial id PK
    int4 person_id FK
    int4 role_id FK
    int4 case_id FK
    jsonb attributes
    text notes
    bool is_primary
    int4 grouped_under_id FK
    date assigned_date
    timestamptz created_at
  }

  proceedings {
    serial id PK
    int4 case_id FK
    varchar case_number
    int4 jurisdiction_id FK
    int4 sort_order
    bool is_primary
    text notes
    int8 courtlistener_docket_id
    varchar pacer_case_id
    timestamptz created_at
    timestamptz updated_at
  }

  proceeding_judges {
    serial id PK
    int4 proceeding_id FK
    int4 judge_id FK
    varchar role
    int4 sort_order
    timestamptz created_at
  }

  tasks {
    serial id PK
    int4 case_id FK
    int4 event_id FK
    date due_date
    date completion_date
    text description
    varchar status
    varchar urgency
    int4 sort_order
    int4 assignee_id FK
    timestamptz created_at
  }

  webhook_logs {
    serial id PK
    varchar source
    varchar event_type
    uuid idempotency_key UK
    jsonb payload
    jsonb headers
    int4 proceeding_id FK
    int4 task_id FK
    int4 event_id FK
    varchar processing_status
    text processing_error
    timestamptz created_at
    timestamptz processed_at
  }

  cases ||--o{ activities : ""
  cases ||--o{ events : ""
  cases ||--o{ notes : ""
  cases ||--o{ person_roles : ""
  cases ||--o{ proceedings : ""
  cases ||--o{ tasks : ""
  jurisdictions ||--o{ judges : ""
  jurisdictions ||--o{ proceedings : ""
  persons ||--o{ person_roles : ""
  roles ||--o{ person_roles : ""
  users ||--o{ tasks : ""
  users ||--o{ users : ""
  events ||--o{ tasks : ""
  events ||--o{ webhook_logs : ""
  judges ||--o{ proceeding_judges : ""
  proceedings ||--o{ proceeding_judges : ""
  proceedings ||--o{ webhook_logs : ""
  tasks ||--o{ webhook_logs : ""
```

## JSONB Column Details

### persons.phones / persons.emails / judges.phones / judges.emails
```json
[
  {"value": "+1-555-1234", "primary": true, "label": "Cell"},
  {"value": "+1-555-5678", "primary": false, "label": "Office"}
]
```

### person_roles.attributes
Flexible JSON for role-specific case data. For experts:
```json
{"expertises": ["Accident Reconstruction", "Biomechanics"], "hourly_rate": 450}
```

## Enum Values

### Case Statuses
- Signing Up, Prospective, Pre-Filing, Pleadings, Discovery
- Expert Discovery, Pre-trial, Trial, Post-Trial, Appeal
- Settl. Pend., Stayed, Closed

### Task Statuses
- Pending, Active, Done, Partially Done, Blocked, Awaiting Atty Review

### Task Urgency
- Low, Medium (default), High, Urgent

### Activity Types
- Meeting, Filing, Research, Drafting, Document Review
- Phone Call, Email, Court Appearance, Deposition, Other

### Role Categories (app-level validation via `db/validation.py`)
- client, counsel, defendant, expert, mediator, other

## Schema Design Notes

### Unified Roles System
The `roles` table defines role types with a `category` CHECK constraint. The `person_roles`
junction table links persons to roles, optionally scoped to a case via `case_id`. Role-specific
data is stored in the JSONB `attributes` column (e.g., expertises for expert roles).

### Standalone Judges
Judges are separate from persons — they have their own table with jurisdiction-specific
fields (chambers, courtroom_number, appointed_by). They are linked to proceedings
via the `proceeding_judges` junction table.

### Multi-Jurisdiction Support
Cases can have multiple proceedings in different jurisdictions. The `proceedings` table
links cases to jurisdictions with case numbers. A partial unique index enforces that
only one proceeding per case can be marked as primary.

### Soft Deletes
The `persons.archived` boolean flag is used for soft deletes rather than removing rows.
