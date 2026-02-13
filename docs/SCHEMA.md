# Database Schema

Entity-relationship diagram for the Galipo legal case management system.

> **Auto-generated** on 2026-02-12 17:26:16 by `scripts/generate_schema_diagram.py`
> (via [SchemaCrawler](https://www.schemacrawler.com/) Docker image)
>
> To regenerate: `python scripts/generate_schema_diagram.py`
>
> Requires Docker.

## ER Diagram

```mermaid
erDiagram

  alembic_version {
    varchar version_num PK
  }

  cases {
    serial id PK
    varchar case_name
    varchar short_name
    varchar status
    varchar print_code
    text case_summary
    text result
    date date_of_injury
    timestamp created_at
    timestamp updated_at
    varchar color
    _int4 attorney_ids
    _int4 paralegal_ids
  }

  clients {
    serial id PK
    varchar name
    varchar phone
    varchar email
    text address
    text notes
    timestamp created_at
  }

  contacts {
    serial id PK
    varchar name
    varchar firm
    varchar phone
    varchar email
    text address
    text notes
    timestamp created_at
  }

  defendants {
    serial id PK
    varchar name UK
  }

  expertise_types {
    serial id PK
    varchar name UK
    text description
    timestamp created_at
  }

  jurisdictions {
    serial id PK
    varchar name UK
    text local_rules_link
    text notes
    timestamp created_at
  }

  objections {
    serial id PK
    varchar name
    varchar short_name UK
    text formal_language
    text argument_template
    int4 position
    timestamp created_at
    timestamp updated_at
  }

  person_types_backup {
    serial id PK
    varchar name UK
    text description
    timestamp created_at
  }

  persons {
    serial id PK
    varchar name
    jsonb phones
    jsonb emails
    text address
    varchar organization
    text notes
    timestamp created_at
    timestamp updated_at
    bool archived
  }

  persons_backup {
    serial id PK
    varchar person_type
    varchar name
    jsonb phones
    jsonb emails
    text address
    varchar organization
    jsonb attributes
    text notes
    timestamp created_at
    timestamp updated_at
    bool archived
  }

  roles {
    serial id PK
    varchar name UK
    varchar category
    int4 sort_order
    text description
    timestamp created_at
  }

  schema_migrations {
    serial id PK
    varchar filename UK
    timestamp applied_at
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
    timestamp created_at
    timestamp updated_at
    int4 paralegal_id FK
  }

  activities {
    serial id PK
    int4 case_id FK
    date date
    text description
    varchar type
    int4 minutes
    timestamp created_at
  }

  case_clients {
    serial id PK
    int4 case_id UK
    int4 client_id FK
    bool contact_directly
    int4 contact_via_id FK
    varchar contact_via_relationship
    bool is_primary
    text notes
  }

  case_contacts {
    serial id PK
    int4 case_id UK
    int4 contact_id FK
    varchar role UK
    text notes
  }

  case_defendants {
    serial id PK
    int4 case_id UK
    int4 defendant_id FK
  }

  case_persons_backup {
    serial id PK
    int4 case_id FK
    int4 person_id FK
    varchar role UK
    varchar side
    jsonb case_attributes
    text case_notes
    bool is_primary
    int4 grouped_under_id FK
    date assigned_date
    timestamp created_at
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
    timestamp created_at
    bool starred
    _int4 attendee_ids
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
    timestamp created_at
    timestamp updated_at
    varchar title
  }

  notes {
    serial id PK
    int4 case_id FK
    text content
    timestamp created_at
    timestamp updated_at
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
    timestamp created_at
  }

  proceedings {
    serial id PK
    int4 case_id FK
    varchar case_number
    int4 jurisdiction_id FK
    int4 sort_order
    bool is_primary
    text notes
    timestamp created_at
    timestamp updated_at
    int8 courtlistener_docket_id
    varchar pacer_case_id
  }

  judges_backup {
    serial id PK
    int4 proceeding_id FK
    int4 person_id FK
    varchar role
    int4 sort_order
    timestamp created_at
  }

  proceeding_judges {
    serial id PK
    int4 proceeding_id FK
    int4 judge_id FK
    varchar role
    int4 sort_order
    timestamp created_at
  }

  tasks {
    serial id PK
    int4 case_id FK
    int4 event_id FK
    date due_date
    date completion_date
    text description
    varchar status
    timestamp created_at
    int4 sort_order
    varchar docket_category
    int4 docket_order
    int4 assignee_id FK
    varchar urgency
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
    timestamp created_at
    timestamp processed_at
  }

  cases ||--o{ activities : ""
  cases ||--o{ case_persons_backup : ""
  cases ||--o{ events : ""
  cases ||--o{ notes : ""
  cases ||--o{ person_roles : ""
  cases ||--o{ proceedings : ""
  cases ||--o{ tasks : ""
  clients ||--o{ case_clients : ""
  contacts ||--o{ case_clients : ""
  contacts ||--o{ case_contacts : ""
  defendants ||--o{ case_defendants : ""
  jurisdictions ||--o{ judges : ""
  jurisdictions ||--o{ proceedings : ""
  persons ||--o{ person_roles : ""
  persons_backup ||--o{ case_persons_backup : ""
  persons_backup ||--o{ judges_backup : ""
  roles ||--o{ person_roles : ""
  users ||--o{ tasks : ""
  users ||--o{ users : ""
  events ||--o{ tasks : ""
  events ||--o{ webhook_logs : ""
  judges ||--o{ proceeding_judges : ""
  proceedings ||--o{ judges_backup : ""
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

### Role Categories (CHECK constraint)
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
