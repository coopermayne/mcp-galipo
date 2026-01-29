#!/usr/bin/env python3
"""
Generate a Mermaid ER diagram from the PostgreSQL database schema.

Usage:
    python scripts/generate_schema_diagram.py

This script:
1. Connects to the database using DATABASE_URL from .env
2. Queries information_schema for tables, columns, and foreign keys
3. Generates a Mermaid ER diagram
4. Writes it to docs/schema.md

The script is designed to be run automatically via git hooks when
migration files change.
"""

import os
import sys
from pathlib import Path
from datetime import datetime

# Add project root to path for imports
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# Load environment variables from .env
from dotenv import load_dotenv
load_dotenv(project_root / ".env")

import psycopg2
from psycopg2.extras import RealDictCursor


# Tables to exclude from the diagram (internal/utility tables)
EXCLUDED_TABLES = {
    'webhook_logs',  # Infrastructure table
}

# Group tables by domain for visual organization
TABLE_GROUPS = {
    'Core': ['cases', 'jurisdictions', 'proceedings'],
    'Contacts (Base)': ['contacts'],
    'Contact Types': [
        'clients', 'attorneys', 'experts', 'judges', 'mediators',
        'defendants', 'lien_holders', 'witnesses', 'client_contacts', 'other_contacts'
    ],
    'Case Assignments': [
        'case_clients', 'case_attorneys', 'case_experts', 'case_mediators',
        'case_defendants', 'case_lien_holders', 'case_witnesses',
        'case_client_contacts', 'case_other_contacts'
    ],
    'Case Timeline': ['tasks', 'events', 'activities', 'notes'],
    'Lookups': ['expertise_types'],
    'Proceedings': ['proceeding_judges'],
}


def get_connection():
    """Get a database connection."""
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL not set in environment")
        sys.exit(1)
    return psycopg2.connect(database_url)


def get_tables(cursor) -> list[dict]:
    """Get all user tables from the database."""
    cursor.execute("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
    """)
    return [row['table_name'] for row in cursor.fetchall()]


def get_columns(cursor, table_name: str) -> list[dict]:
    """Get columns for a specific table."""
    cursor.execute("""
        SELECT
            column_name,
            data_type,
            udt_name,
            is_nullable,
            column_default,
            character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = %s
        ORDER BY ordinal_position
    """, (table_name,))
    return cursor.fetchall()


def get_primary_keys(cursor, table_name: str) -> set[str]:
    """Get primary key columns for a table."""
    cursor.execute("""
        SELECT a.attname
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        JOIN pg_class c ON c.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE i.indisprimary
          AND n.nspname = 'public'
          AND c.relname = %s
    """, (table_name,))
    return {row['attname'] for row in cursor.fetchall()}


def get_unique_constraints(cursor, table_name: str) -> set[str]:
    """Get unique constraint columns for a table."""
    cursor.execute("""
        SELECT a.attname
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        JOIN pg_class c ON c.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE i.indisunique
          AND NOT i.indisprimary
          AND n.nspname = 'public'
          AND c.relname = %s
    """, (table_name,))
    return {row['attname'] for row in cursor.fetchall()}


def get_foreign_keys(cursor) -> list[dict]:
    """Get all foreign key relationships."""
    cursor.execute("""
        SELECT
            tc.table_name AS from_table,
            kcu.column_name AS from_column,
            ccu.table_name AS to_table,
            ccu.column_name AS to_column,
            rc.delete_rule
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        JOIN information_schema.referential_constraints rc
            ON rc.constraint_name = tc.constraint_name
            AND rc.constraint_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
        ORDER BY tc.table_name, kcu.column_name
    """)
    return cursor.fetchall()


def format_column_type(col: dict) -> str:
    """Format a column type for Mermaid display."""
    udt_name = col['udt_name']

    # Map PostgreSQL types to shorter display names
    type_map = {
        'int4': 'int',
        'int8': 'bigint',
        'varchar': 'varchar',
        'text': 'text',
        'bool': 'boolean',
        'timestamp': 'timestamp',
        'timestamptz': 'timestamptz',
        'date': 'date',
        'time': 'time',
        'jsonb': 'jsonb',
        'json': 'json',
        'numeric': 'numeric',
        'float8': 'float',
    }

    return type_map.get(udt_name, udt_name)


def generate_mermaid_diagram(tables: list[str], columns_by_table: dict,
                              primary_keys: dict, unique_keys: dict,
                              foreign_keys: list[dict]) -> str:
    """Generate Mermaid ER diagram syntax."""
    lines = ["erDiagram"]

    # Generate table definitions
    for table in tables:
        if table in EXCLUDED_TABLES:
            continue

        lines.append(f"    {table} {{")

        pks = primary_keys.get(table, set())
        uks = unique_keys.get(table, set())

        for col in columns_by_table.get(table, []):
            col_name = col['column_name']
            col_type = format_column_type(col)

            # Build constraints string
            constraints = []
            if col_name in pks:
                constraints.append("PK")
            if col_name in uks:
                constraints.append("UK")
            # Check if this column is a foreign key
            for fk in foreign_keys:
                if fk['from_table'] == table and fk['from_column'] == col_name:
                    constraints.append("FK")
                    break

            constraint_str = ",".join(constraints)
            if constraint_str:
                lines.append(f"        {col_type} {col_name} {constraint_str}")
            else:
                lines.append(f"        {col_type} {col_name}")

        lines.append("    }")
        lines.append("")

    # Generate relationships
    lines.append("    %% Relationships")

    # Track relationships to avoid duplicates
    seen_relationships = set()

    for fk in foreign_keys:
        from_table = fk['from_table']
        to_table = fk['to_table']

        if from_table in EXCLUDED_TABLES or to_table in EXCLUDED_TABLES:
            continue

        rel_key = (from_table, to_table)
        if rel_key in seen_relationships:
            continue
        seen_relationships.add(rel_key)

        # Determine relationship label based on table names
        label = get_relationship_label(from_table, to_table, fk['from_column'])

        # Use ||--o{ for one-to-many relationships
        lines.append(f"    {to_table} ||--o{{ {from_table} : \"{label}\"")

    return "\n".join(lines)


def get_relationship_label(from_table: str, to_table: str, column: str) -> str:
    """Generate a meaningful relationship label."""
    # Handle class inheritance (contacts -> type tables)
    if to_table == 'contacts' and from_table in [
        'clients', 'attorneys', 'experts', 'judges', 'mediators',
        'defendants', 'lien_holders', 'witnesses', 'client_contacts', 'other_contacts'
    ]:
        return "extends"

    # Handle case assignment junction tables
    if from_table.startswith('case_') and to_table == 'cases':
        return "has"

    # Handle case assignment to contact types
    case_to_type = {
        'case_clients': 'clients',
        'case_attorneys': 'attorneys',
        'case_experts': 'experts',
        'case_mediators': 'mediators',
        'case_defendants': 'defendants',
        'case_lien_holders': 'lien_holders',
        'case_witnesses': 'witnesses',
        'case_client_contacts': 'client_contacts',
        'case_other_contacts': 'other_contacts',
    }
    if from_table in case_to_type and to_table == case_to_type[from_table]:
        return "assigned"

    # Handle proceedings
    if from_table == 'proceedings' and to_table == 'cases':
        return "has"
    if from_table == 'proceedings' and to_table == 'jurisdictions':
        return "filed in"
    if from_table == 'proceeding_judges' and to_table == 'proceedings':
        return "has"
    if from_table == 'proceeding_judges' and to_table == 'contacts':
        return "serves as"

    # Handle case timeline
    if from_table in ['tasks', 'events', 'activities', 'notes'] and to_table == 'cases':
        return "has"
    if from_table == 'tasks' and to_table == 'events':
        return "linked to"

    # Default: use column name without _id suffix
    if column.endswith('_id'):
        return column[:-3]
    return column


def generate_relationships_table(foreign_keys: list[dict]) -> str:
    """Generate a markdown table of relationships."""
    lines = [
        "## Table Relationships",
        "",
        "| Parent | Child | FK Column | On Delete |",
        "|--------|-------|-----------|-----------|",
    ]

    for fk in foreign_keys:
        if fk['from_table'] in EXCLUDED_TABLES or fk['to_table'] in EXCLUDED_TABLES:
            continue
        lines.append(
            f"| {fk['to_table']} | {fk['from_table']} | {fk['from_column']} | {fk['delete_rule']} |"
        )

    return "\n".join(lines)


def generate_enum_values_section() -> str:
    """Generate documentation for enum values used in the schema."""
    return """## Enum Values

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
- plaintiff, defendant, neutral"""


def generate_jsonb_section() -> str:
    """Generate documentation for JSONB column structures."""
    return """## JSONB Column Details

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
```"""


def generate_schema_notes() -> str:
    """Generate notes about the schema design."""
    return """## Schema Design Notes

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
The `contacts.archived` boolean flag is used for soft deletes rather than removing rows."""


def main():
    """Main entry point."""
    print("Generating schema diagram...")

    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Gather schema information
            tables = get_tables(cur)
            print(f"Found {len(tables)} tables")

            columns_by_table = {}
            primary_keys_by_table = {}
            unique_keys_by_table = {}

            for table in tables:
                columns_by_table[table] = get_columns(cur, table)
                primary_keys_by_table[table] = get_primary_keys(cur, table)
                unique_keys_by_table[table] = get_unique_constraints(cur, table)

            foreign_keys = get_foreign_keys(cur)
            print(f"Found {len(foreign_keys)} foreign key relationships")

            # Generate Mermaid diagram
            mermaid = generate_mermaid_diagram(
                tables, columns_by_table,
                primary_keys_by_table, unique_keys_by_table,
                foreign_keys
            )

            # Generate full markdown document
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            markdown = f"""# Database Schema

Entity-relationship diagram for the Galipo legal case management system.

> **Auto-generated** on {timestamp} by `scripts/generate_schema_diagram.py`
>
> To regenerate: `python scripts/generate_schema_diagram.py`

## ER Diagram

```mermaid
{mermaid}
```

{generate_relationships_table(foreign_keys)}

{generate_jsonb_section()}

{generate_enum_values_section()}

{generate_schema_notes()}
"""

            # Write to docs/schema.md
            output_path = project_root / "docs" / "schema.md"
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(markdown)
            print(f"Written to {output_path}")

    finally:
        conn.close()

    print("Done!")


if __name__ == "__main__":
    main()
