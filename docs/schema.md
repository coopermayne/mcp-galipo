# Database Schema

Entity-relationship diagram for the Galipo legal case management system.

> **Auto-generated** on 2026-02-02 12:23:41 by `scripts/generate_schema_diagram.py`
>
> To regenerate: `python scripts/generate_schema_diagram.py`

## ER Diagram

```mermaid
erDiagram
    activities {
        int id PK
        int case_id FK
        date date
        text description
        varchar type
        int minutes
        timestamp created_at
    }

    case_persons {
        int id PK
        int case_id UK,FK
        int person_id UK,FK
        varchar role UK
        varchar side
        jsonb case_attributes
        text case_notes
        boolean is_primary
        int grouped_under_id FK
        date assigned_date
        timestamp created_at
    }

    cases {
        int id PK
        varchar case_name
        varchar short_name
        varchar status
        varchar print_code
        text case_summary
        text result
        date date_of_injury
        jsonb case_numbers
        timestamp created_at
        timestamp updated_at
        varchar color
    }

    events {
        int id PK
        int case_id FK
        date date
        time time
        varchar location
        text description
        text document_link
        text calculation_note
        boolean starred
        timestamp created_at
    }

    expertise_types {
        int id PK
        varchar name UK
        text description
        timestamp created_at
    }

    judges {
        int id PK
        int proceeding_id UK,FK
        int person_id UK,FK
        varchar role
        int sort_order
        timestamp created_at
    }

    jurisdictions {
        int id PK
        varchar name UK
        text local_rules_link
        text notes
        timestamp created_at
    }

    notes {
        int id PK
        int case_id FK
        text content
        timestamp created_at
        timestamp updated_at
    }

    person_types {
        int id PK
        varchar name UK
        text description
        timestamp created_at
    }

    persons {
        int id PK
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
        boolean archived
    }

    proceedings {
        int id PK
        int case_id FK
        varchar case_number
        int jurisdiction_id FK
        int sort_order
        boolean is_primary
        text notes
        timestamp created_at
        timestamp updated_at
        bigint courtlistener_docket_id
        varchar pacer_case_id
    }

    tasks {
        int id PK
        int case_id FK
        int event_id FK
        date due_date
        date completion_date
        text description
        varchar status
        int urgency
        int sort_order
        varchar docket_category
        int docket_order
        timestamp created_at
    }

    users {
        int id PK
        varchar email UK
        varchar password_hash
        varchar first_name
        varchar last_name
        varchar initials
        varchar bar_number
        varchar position
        boolean is_admin
        boolean must_change_password
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    %% Relationships
    cases ||--o{ activities : "has"
    cases ||--o{ case_persons : "has"
    persons ||--o{ case_persons : "grouped_under"
    cases ||--o{ events : "has"
    persons ||--o{ judges : "person"
    proceedings ||--o{ judges : "proceeding"
    cases ||--o{ notes : "has"
    cases ||--o{ proceedings : "has"
    jurisdictions ||--o{ proceedings : "filed in"
    cases ||--o{ tasks : "has"
    events ||--o{ tasks : "linked to"
```

## Table Relationships

| Parent | Child | FK Column | On Delete |
|--------|-------|-----------|-----------|
| cases | activities | case_id | CASCADE |
| cases | case_persons | case_id | CASCADE |
| persons | case_persons | grouped_under_id | NO ACTION |
| persons | case_persons | person_id | CASCADE |
| cases | events | case_id | CASCADE |
| persons | judges | person_id | CASCADE |
| proceedings | judges | proceeding_id | CASCADE |
| cases | notes | case_id | CASCADE |
| cases | proceedings | case_id | CASCADE |
| jurisdictions | proceedings | jurisdiction_id | NO ACTION |
| cases | tasks | case_id | CASCADE |
| events | tasks | event_id | SET NULL |

## JSONB Column Details

### cases.case_numbers
```json
["2023-CV-12345", "2025-APP-00001"]
```
Tracks case across multiple courts/proceedings.

### contacts.phones / contacts.emails
```json
[
  {"value": "+1-555-1234", "primary": true, "label": "Cell"},
  {"value": "+1-555-5678", "primary": false, "label": "Office"}
]
```

### case_other_contacts.case_attributes
Flexible JSON for role-specific case data:
```json
{"specialty_for_case": "Accident Reconstruction", "testimony_topic": "Speed analysis"}
```

## Enum Values

### Case Statuses
- Signing Up, Prospective, Pre-Filing, Pleadings, Discovery
- Expert Discovery, Pre-trial, Trial, Post-Trial, Appeal
- Settl. Pend., Stayed, Closed

### Task Statuses
- Pending, Active, Done, Partially Done, Blocked, Awaiting Atty Review

### Task Urgency
- 1 = Low
- 2 = Medium (default)
- 3 = High
- 4 = Urgent

### Activity Types
- Meeting, Filing, Research, Drafting, Document Review
- Phone Call, Email, Court Appearance, Deposition, Other

### Contact Types (Discriminator)
- client, attorney, expert, judge, mediator, defendant
- lien_holder, witness, client_contact, other

### Case Assignment Sides
- plaintiff, defendant, neutral

## Schema Design Notes

### Class Table Inheritance Pattern
The `contacts` table serves as a base table with a `contact_type` discriminator column.
Type-specific tables (clients, attorneys, experts, etc.) extend contacts via foreign key
to `contacts.id` with `ON DELETE CASCADE`.

### Case Assignments
Each contact type has its own junction table (`case_clients`, `case_attorneys`, etc.)
rather than a single unified `case_persons` table. This allows type-specific fields
on the assignment (e.g., `case_experts` has `hourly_rate_override`, `case_lien_holders`
has `lien_amount` and `lien_status`).

### Multi-Jurisdiction Support
Cases can have multiple proceedings in different jurisdictions. The `proceedings` table
links cases to jurisdictions with case numbers. Judges are assigned to proceedings
(not cases) to support multi-judge panels.

### Soft Deletes
The `contacts.archived` boolean flag is used for soft deletes rather than removing rows.
