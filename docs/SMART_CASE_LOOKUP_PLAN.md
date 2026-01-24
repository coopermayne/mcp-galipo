# Smart Case Lookup Implementation Plan

## Overview

Implement a flexible, AI-powered case lookup system that lets users find cases naturally (by name, person, description, etc.) without building complex fuzzy search logic. Instead, give the AI enough context to reason about matches itself.

## Current Status

| Phase | Status | Notes |
|-------|--------|-------|
| Planning | Complete | This document |
| Phase 1: Compact Case Index | Not Started | |
| Phase 2: Tiered Loading | Not Started | |
| Phase 3: Person Duplicate Detection | Not Started | |

---

## Design Philosophy

**Key Insight**: For a small firm (~25 active cases), it's simpler and more flexible to give the AI a compact index of all cases and let it reason about matches, rather than building sophisticated fuzzy search infrastructure.

**AI is naturally good at**:
- Typo tolerance ("Martinex" → "Martinez")
- Semantic understanding ("my police brutality case")
- Cross-field reasoning ("case with Judge Gee" → scans persons)
- Disambiguation ("Did you mean Martinez v. City or Martinez v. County?")

**Token efficiency**: Use a tiered approach to avoid bloating every conversation with unnecessary data.

---

## Architecture

### Tiered Loading Strategy

```
┌─────────────────────────────────────────────────────────────────────┐
│                              AI                                      │
│                                                                      │
│  1. User names case clearly?                                        │
│     → get_case(case_name="Martinez") - exact match, cheap           │
│                                                                      │
│  2. User is vague/fuzzy ("my LAPD case")?                           │
│     → get_case_index() - compact index, ~2.5K tokens                │
│     → AI reasons over all cases to find match                       │
│                                                                      │
│  3. Need to act on tasks/events?                                    │
│     → get_case(case_id=42) - full details with IDs                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Token Economics

| Approach | Find Case | Get Details | 10-turn Conversation |
|----------|-----------|-------------|---------------------|
| Big dump (rejected) | 10K | included | 100K+ total |
| **Tiered (chosen)** | 2.5K | +500 | ~30K total |

---

## Implementation

### Tool 1: `get_case_index`

Compact index of all active cases - enough to FIND a case, not enough to ACT on specific tasks/events.

```python
@mcp.tool()
def get_case_index(
    context: Context,
    include_closed: bool = False
) -> dict:
    """
    Get compact index of all cases for AI-powered lookup.

    Use this when you need to FIND a case based on partial or fuzzy information
    (name fragments, person names, descriptions, etc.). Once you identify the
    case, use get_case(case_id) for full details including task/event IDs.

    Args:
        include_closed: Include closed/settled cases (default: active only)

    Returns:
        Compact case list with key identifying information.
    """
```

**Response format** (~100 tokens per case):

```json
{
  "cases": [
    {
      "id": 42,
      "name": "Martinez v. City of Los Angeles",
      "short_name": "Martinez",
      "status": "Discovery",
      "summary": "Police excessive force during traffic stop",
      "clients": ["Juan Martinez"],
      "defendants": ["City of LA", "LAPD", "Officer Smith"],
      "judge": "Hon. Tammy Chung",
      "pending_task_count": 3,
      "next_event": "2024-02-15: Deposition of Officer Smith"
    }
  ],
  "total": 25,
  "showing": "active"
}
```

**What's included**:
- Case identifiers (id, name, short_name)
- Status
- Abbreviated summary
- Key persons (clients, defendants, judge) - names only
- Task count (not full list)
- Next upcoming event (not full list)

**What's excluded** (get via `get_case(id)`):
- Full task list with IDs
- Full event list with IDs
- Person IDs and contact details
- Notes
- Activity logs
- Full case summary

### Tool 2: Enhanced `get_case`

Existing tool, but ensure it returns all IDs needed for subsequent operations.

```python
@mcp.tool()
def get_case(
    context: Context,
    case_id: Optional[int] = None,
    case_name: Optional[str] = None
) -> dict:
    """
    Get full details for a specific case by ID or exact name.

    Use get_case_index() first if you need to search/find a case.
    Use this tool when you know the case and need:
    - Task IDs (to mark complete, edit, delete)
    - Event IDs (to edit, delete)
    - Person IDs (to edit assignments)
    - Full notes and details
    """
```

### Tool 3: `search_persons` (for duplicate detection)

Persons accumulate across cases and need duplicate detection when adding new ones.

```python
@mcp.tool()
def search_persons(
    context: Context,
    query: str,
    person_type: Optional[str] = None,
    limit: int = 10
) -> dict:
    """
    Search for existing persons to avoid creating duplicates.

    Call this BEFORE creating a new person to check if they already exist.
    Uses fuzzy matching on name and organization.

    Args:
        query: Name or organization to search for
        person_type: Filter by type (Judge, Expert, Attorney, etc.)
        limit: Max results

    Returns:
        Matching persons with similarity scores.
    """
```

**This tool uses pg_trgm** for fuzzy matching since:
- Persons accumulate (could be 200+ across all cases)
- Duplicate detection needs precise similarity scoring
- Need to search across closed cases too

---

## Database Changes

### Migration: Enable pg_trgm (for person search)

```sql
-- migrations/XXX_enable_fuzzy_search.sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Index for person name fuzzy search
CREATE INDEX IF NOT EXISTS idx_persons_name_trgm
ON persons USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_persons_org_trgm
ON persons USING GIN (organization gin_trgm_ops);
```

### New Query: `db/cases.py`

```python
def get_case_index(include_closed: bool = False) -> list[dict]:
    """
    Get compact case index for AI-powered lookup.

    Returns minimal but searchable info for all cases.
    """
    # Query cases with aggregated person info, task counts, next event
    ...
```

### New Query: `db/persons.py`

```python
def search_persons_fuzzy(query: str, person_type: str = None,
                         limit: int = 10) -> list[dict]:
    """
    Fuzzy search persons using pg_trgm similarity.

    Returns matches with similarity scores.
    """
    # Use similarity() function from pg_trgm
    ...
```

---

## Example Flows

### Flow 1: Finding a case by vague description

```
User: "What's happening with my LAPD case?"

AI: [calls get_case_index()]
    → 2,500 tokens, sees all 25 cases
    → Finds Martinez (id=42) has "LAPD" in defendants

AI: "The Martinez v. City of LA case involves LAPD. It's in Discovery
     with 3 pending tasks. The next event is a deposition on Feb 15.
     Would you like more details?"

User: "Show me the tasks"

AI: [calls get_case(case_id=42)]
    → Gets full case with task IDs

AI: "Pending tasks for Martinez:
     1. Prepare deposition outline (due Feb 10)
     2. Review medical records (due Feb 12)
     3. File motion to compel (due Feb 20)"

User: "Mark the deposition one done"

AI: [calls update_task(task_id=101, status="Completed")]
    → Has task ID from previous response
```

### Flow 2: Adding a person with duplicate check

```
User: "Add Judge Tammy Chung to the Martinez case"

AI: [calls search_persons(query="Tammy Chung", person_type="Judge")]
    → Found: "Hon. Tammy Chung" (id=55, similarity=0.94)

AI: "Judge Tammy Chung is already in the system. Should I assign
     the existing record to the Martinez case?"

User: "Yes"

AI: [calls assign_person_to_case(case_id=42, person_id=55, role="Judge")]
```

### Flow 3: Direct case lookup (no index needed)

```
User: "Show me the Martinez case"

AI: [calls get_case(case_name="Martinez")]
    → Exact match found, returns full case
    → No need for get_case_index()
```

---

## Implementation Phases

### Phase 1: Compact Case Index

**Files to modify/create**:
- `db/cases.py` - Add `get_case_index()` query
- `tools/cases.py` - Add `get_case_index` MCP tool

**Effort**: Small

### Phase 2: Tiered Loading

**Files to modify**:
- `services/chat/tools.py` - Ensure new tool is available
- Update tool descriptions to guide AI on when to use each

**Effort**: Small

### Phase 3: Person Duplicate Detection

**Files to modify/create**:
- `db/search.py` - New file for fuzzy search infrastructure
- `db/persons.py` - Add `search_persons_fuzzy()`
- `tools/persons.py` - Add `search_persons` MCP tool
- `migrations/XXX_enable_fuzzy_search.sql` - Enable pg_trgm

**Effort**: Medium

---

## Future Enhancements

### Synonym/Alias Table (Optional)

If fuzzy matching on organization names proves insufficient:

```sql
CREATE TABLE aliases (
    id SERIAL PRIMARY KEY,
    canonical VARCHAR(255) NOT NULL,  -- "Los Angeles Police Department"
    alias VARCHAR(255) NOT NULL,      -- "LAPD"
    UNIQUE(canonical, alias)
);
```

AI or `search_persons` could expand "LAPD" → "Los Angeles Police Department".

**Decision**: Start without this. AI can usually figure it out from context. Add if needed.

### Task/Event Duplicate Detection (Optional)

Same pattern as person search:

```python
@mcp.tool()
def check_duplicate_event(
    context: Context,
    case_id: int,
    description: str,
    date: str
) -> dict:
    """Check if a similar event already exists on this case."""
```

**Decision**: Defer until we see duplicate events becoming a problem.

---

## Notes

- The "load everything" approach works because the firm has ~25 active cases
- If case volume grows significantly (100+), may need to add fuzzy search for cases too
- Person search uses pg_trgm because persons accumulate and need precise duplicate detection
- Task/event IDs are only loaded when needed (via `get_case`), keeping conversations lean
