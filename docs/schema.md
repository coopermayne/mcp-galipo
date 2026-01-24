# Database Schema

Entity-relationship diagram for the Galipo legal case management system.

## ER Diagram

```mermaid
erDiagram
    jurisdictions {
        serial id PK
        varchar name UK
        text local_rules_link
        text notes
        timestamp created_at
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
        jsonb case_numbers "Array of court case numbers"
        timestamp created_at
        timestamp updated_at
    }

    persons {
        serial id PK
        varchar person_type
        varchar name
        jsonb phones "Array of phone objects"
        jsonb emails "Array of email objects"
        text address
        varchar organization
        jsonb attributes "Type-specific fields"
        text notes
        boolean archived
        timestamp created_at
        timestamp updated_at
    }

    case_persons {
        serial id PK
        integer case_id FK
        integer person_id FK
        varchar role
        varchar side "plaintiff|defendant|neutral"
        jsonb case_attributes
        text case_notes
        boolean is_primary
        integer contact_via_person_id FK
        date assigned_date
        timestamp created_at
    }

    proceedings {
        serial id PK
        integer case_id FK
        varchar case_number
        integer jurisdiction_id FK
        integer sort_order
        boolean is_primary
        text notes
        timestamp created_at
        timestamp updated_at
    }

    proceeding_judges {
        serial id PK
        integer proceeding_id FK
        integer person_id FK
        varchar role
        integer sort_order
        timestamp created_at
    }

    tasks {
        serial id PK
        integer case_id FK
        integer event_id FK
        date due_date
        date completion_date
        text description
        varchar status
        integer urgency "1-4"
        integer sort_order
        timestamp created_at
    }

    events {
        serial id PK
        integer case_id FK
        date date
        time time
        varchar location
        text description
        text document_link
        text calculation_note
        boolean starred
        timestamp created_at
    }

    activities {
        serial id PK
        integer case_id FK
        date date
        text description
        varchar type
        integer minutes
        timestamp created_at
    }

    notes {
        serial id PK
        integer case_id FK
        text content
        timestamp created_at
        timestamp updated_at
    }

    person_types {
        serial id PK
        varchar name UK
        text description
        timestamp created_at
    }

    expertise_types {
        serial id PK
        varchar name UK
        text description
        timestamp created_at
    }

    %% Relationships
    cases ||--o{ case_persons : "has participants"
    persons ||--o{ case_persons : "assigned to"
    case_persons }o--o| persons : "contact via"

    cases ||--o{ proceedings : "has proceedings"
    jurisdictions ||--o{ proceedings : "filed in"
    proceedings ||--o{ proceeding_judges : "has judges"
    persons ||--o{ proceeding_judges : "serves as judge"

    cases ||--o{ tasks : "has tasks"
    cases ||--o{ events : "has events"
    events ||--o{ tasks : "task linked to"

    cases ||--o{ activities : "has activities"
    cases ||--o{ notes : "has notes"
```

## Table Relationships

| Parent | Child | Relationship | On Delete |
|--------|-------|--------------|-----------|
| cases | case_persons | 1:many | CASCADE |
| persons | case_persons | 1:many | CASCADE |
| cases | proceedings | 1:many | CASCADE |
| jurisdictions | proceedings | 1:many | SET NULL |
| proceedings | proceeding_judges | 1:many | CASCADE |
| persons | proceeding_judges | 1:many | CASCADE |
| cases | tasks | 1:many | CASCADE |
| cases | events | 1:many | CASCADE |
| events | tasks | 1:many (optional) | SET NULL |
| cases | activities | 1:many | CASCADE |
| cases | notes | 1:many | CASCADE |

## JSONB Column Details

### cases.case_numbers
```json
["2023-CV-12345", "2025-APP-00001"]
```
Tracks case across multiple courts/proceedings.

### persons.phones / persons.emails
```json
[
  {"value": "+1-555-1234", "primary": true, "label": "Cell"},
  {"value": "+1-555-5678", "primary": false, "label": "Office"}
]
```

### persons.attributes
Type-specific fields stored as flexible JSON:

| Person Type | Example Attributes |
|-------------|-------------------|
| attorney | `{hourly_rate: 350, bar_number: "CA123456"}` |
| expert | `{hourly_rate: 500, deposition_rate: 600, expertises: ["Biomechanics"]}` |
| judge | `{courtroom_number: "4B", chambers: "Room 123"}` |
| mediator | `{half_day_rate: 2500, full_day_rate: 4500, style: "evaluative"}` |

### case_persons.case_attributes
Case-specific data for the assignment:
```json
{"fee_agreement": "contingency", "insurance_info": "Policy #XYZ"}
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

### Person Types
- client, attorney, judge, expert, mediator, defendant
- witness, lien_holder, interpreter, court_reporter
- process_server, investigator, insurance_adjuster, guardian

### Case Person Sides
- plaintiff, defendant, neutral
