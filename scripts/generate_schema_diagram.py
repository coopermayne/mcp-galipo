#!/usr/bin/env python3
"""
Generate a Mermaid ER diagram from the PostgreSQL database schema using SchemaCrawler.

Usage:
    python scripts/generate_schema_diagram.py

Requires Docker to be running. Uses the schemacrawler/schemacrawler Docker image
to introspect the database and produce Mermaid ER output.

The script is designed to be run automatically via git hooks when
migration files change, or manually when needed.
"""

import os
import re
import sys
import platform
import subprocess
from pathlib import Path
from datetime import datetime
from urllib.parse import urlparse

# Add project root to path for imports
project_root = Path(__file__).parent.parent

# Load environment variables from .env
from dotenv import load_dotenv
load_dotenv(project_root / ".env")

IMAGE = "schemacrawler/schemacrawler"


def parse_database_url() -> dict:
    """Parse DATABASE_URL into components."""
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("ERROR: DATABASE_URL not set in environment")
        sys.exit(1)

    parsed = urlparse(url)
    return {
        "host": parsed.hostname or "localhost",
        "port": str(parsed.port or 5432),
        "dbname": parsed.path.lstrip("/"),
        "user": parsed.username or "",
        "password": parsed.password or "",
    }


def docker_host(host: str) -> str:
    """Swap localhost for host.docker.internal on macOS so Docker can reach the host DB."""
    if host in ("localhost", "127.0.0.1") and platform.system() == "Darwin":
        return "host.docker.internal"
    return host


def check_docker():
    """Verify Docker is running."""
    try:
        subprocess.run(
            ["docker", "info"],
            capture_output=True, check=True, timeout=10,
        )
    except FileNotFoundError:
        print("ERROR: Docker is not installed")
        sys.exit(1)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
        print("ERROR: Docker is not running")
        sys.exit(1)


def run_schemacrawler(db: dict) -> str:
    """Run SchemaCrawler in Docker and return the Mermaid output."""
    host = docker_host(db["host"])
    jdbc_url = f"jdbc:postgresql://{host}:{db['port']}/{db['dbname']}"

    cmd = [
        "docker", "run", "--rm",
        IMAGE,
        "/opt/schemacrawler/bin/schemacrawler.sh",
        f"--url={jdbc_url}",
        f"--user={db['user']}",
        f"--password={db['password']}",
        "--schemas=public",
        "--info-level=standard",
        "--command=script",
        "--script-language=python",
        "--script=mermaid.py",
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)

    if result.returncode != 0:
        stderr = result.stderr.strip()
        print(f"ERROR: SchemaCrawler failed (exit {result.returncode})")
        if stderr:
            # Print last few lines of stderr for context
            for line in stderr.splitlines()[-10:]:
                print(f"  {line}")
        sys.exit(1)

    return result.stdout


def extract_mermaid(output: str) -> str:
    """Extract just the Mermaid diagram from SchemaCrawler output.

    SchemaCrawler may print log lines before the actual diagram.
    The Mermaid content starts with 'erDiagram'.
    """
    lines = output.splitlines()
    start = None
    for i, line in enumerate(lines):
        if line.strip().startswith("erDiagram"):
            start = i
            break

    if start is None:
        print("ERROR: No erDiagram found in SchemaCrawler output")
        print("Raw output:")
        print(output[:2000])
        sys.exit(1)

    mermaid = "\n".join(lines[start:])
    return cleanup_mermaid(mermaid)


def cleanup_mermaid(mermaid: str) -> str:
    """Clean up SchemaCrawler's Mermaid output.

    - Strip 'public' schema prefix from table names (publiccases -> cases)
    - Replace generic "foreign key" labels with column-based labels
    """
    # Strip the schema prefix from table names
    mermaid = re.sub(r'\bpublic(\w+)', r'\1', mermaid)

    # Replace generic "foreign key" relationship labels with the FK column name.
    # SchemaCrawler emits: parent ||--o{ child : "foreign key"
    # We want:             parent ||--o{ child : "has"
    # For self-refs like users->users, keep a meaningful label.
    mermaid = re.sub(
        r': "foreign key"',
        ': ""',
        mermaid,
    )

    return mermaid


def static_sections() -> str:
    """Return the static prose sections appended after the ER diagram."""
    return """## JSONB Column Details

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
The `persons.archived` boolean flag is used for soft deletes rather than removing rows."""


def main():
    print("Generating schema diagram via SchemaCrawler...")

    db = parse_database_url()
    check_docker()

    print(f"Connecting to {db['dbname']} on {db['host']}:{db['port']}...")
    raw_output = run_schemacrawler(db)
    mermaid = extract_mermaid(raw_output)

    table_count = mermaid.count("{")
    print(f"Generated diagram with ~{table_count} tables")

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    markdown = f"""# Database Schema

Entity-relationship diagram for the Galipo legal case management system.

> **Auto-generated** on {timestamp} by `scripts/generate_schema_diagram.py`
> (via [SchemaCrawler](https://www.schemacrawler.com/) Docker image)
>
> To regenerate: `python scripts/generate_schema_diagram.py`
>
> Requires Docker.

## ER Diagram

```mermaid
{mermaid}
```

{static_sections()}
"""

    output_path = project_root / "docs" / "SCHEMA.md"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(markdown)
    print(f"Written to {output_path}")
    print("Done!")


if __name__ == "__main__":
    main()
