# Plan: Add Proceedings Table

## Overview

Currently, a single `cases` record represents both the client matter AND individual court cases. This doesn't model reality well when a matter spans multiple courts (e.g., state court → federal removal → appeal → separate public records case).

**Solution**: Add a `proceedings` table to represent individual court cases within a matter.

### What Changes

| Entity | Before | After |
|--------|--------|-------|
| Case numbers | JSONB array on `cases.case_numbers` | Separate `proceedings` rows |
| Jurisdiction | Single `cases.court_id` | Per-proceeding `proceedings.jurisdiction_id` |
| Judges | Linked via `case_persons` (role=Judge) | Per-proceeding `proceedings.judge_id` |

### What Stays the Same

- `cases` table name (not renaming to "matters")
- People (clients, defendants, opposing counsel) stay at case level via `case_persons`
- Events stay at case level
- Tasks stay at case level
- Notes stay at case level

---

## Database Schema

### New Table: `proceedings`

```sql
CREATE TABLE proceedings (
    id SERIAL PRIMARY KEY,
    case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    case_number VARCHAR(100) NOT NULL,
    jurisdiction_id INTEGER REFERENCES jurisdictions(id),
    judge_id INTEGER REFERENCES persons(id),
    sort_order INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(case_id, case_number)
);

-- Indexes
CREATE INDEX idx_proceedings_case_id ON proceedings(case_id);
CREATE INDEX idx_proceedings_jurisdiction ON proceedings(jurisdiction_id);
CREATE INDEX idx_proceedings_judge ON proceedings(judge_id);
```

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `case_id` | FK → cases | The parent matter |
| `case_number` | VARCHAR(100) | Court case number (e.g., "2:24-cv-01234-PAC") |
| `jurisdiction_id` | FK → jurisdictions | Which court (nullable for pre-filing) |
| `judge_id` | FK → persons | Assigned judge (nullable if TBD) |
| `sort_order` | INTEGER | Display order (0 = first) |
| `is_primary` | BOOLEAN | The "main" proceeding for this matter |
| `notes` | TEXT | Proceeding-specific notes (e.g., "Removed from state 3/15/24") |

### Trigger: Enforce Single Primary

```sql
CREATE OR REPLACE FUNCTION enforce_single_primary_proceeding()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_primary = TRUE THEN
        UPDATE proceedings
        SET is_primary = FALSE
        WHERE case_id = NEW.case_id
          AND id != NEW.id
          AND is_primary = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_single_primary_proceeding
    BEFORE INSERT OR UPDATE ON proceedings
    FOR EACH ROW
    WHEN (NEW.is_primary = TRUE)
    EXECUTE FUNCTION enforce_single_primary_proceeding();
```

### Changes to `cases` Table

After migration is complete and verified:
- Remove `case_numbers` JSONB column
- Remove `court_id` column (jurisdiction now lives on proceedings)

During migration, keep both for rollback safety.

---

## Migration Strategy

### Step 1: Create Table and Migrate Data

Add to `database.py` `migrate_db()` function:

```python
# Check if proceedings table exists
cur.execute("""
    SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'proceedings'
    )
""")
proceedings_exists = cur.fetchone()[0]

if not proceedings_exists:
    print("Creating proceedings table...")

    # 1. Create table
    cur.execute("""
        CREATE TABLE proceedings (
            id SERIAL PRIMARY KEY,
            case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
            case_number VARCHAR(100) NOT NULL,
            jurisdiction_id INTEGER REFERENCES jurisdictions(id),
            judge_id INTEGER REFERENCES persons(id),
            sort_order INTEGER DEFAULT 0,
            is_primary BOOLEAN DEFAULT FALSE,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(case_id, case_number)
        )
    """)

    # 2. Create indexes
    cur.execute("CREATE INDEX idx_proceedings_case_id ON proceedings(case_id)")
    cur.execute("CREATE INDEX idx_proceedings_jurisdiction ON proceedings(jurisdiction_id)")
    cur.execute("CREATE INDEX idx_proceedings_judge ON proceedings(judge_id)")

    # 3. Create trigger
    cur.execute("""
        CREATE OR REPLACE FUNCTION enforce_single_primary_proceeding()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.is_primary = TRUE THEN
                UPDATE proceedings
                SET is_primary = FALSE
                WHERE case_id = NEW.case_id
                  AND id != NEW.id
                  AND is_primary = TRUE;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
    """)
    cur.execute("""
        CREATE TRIGGER trigger_single_primary_proceeding
            BEFORE INSERT OR UPDATE ON proceedings
            FOR EACH ROW
            WHEN (NEW.is_primary = TRUE)
            EXECUTE FUNCTION enforce_single_primary_proceeding()
    """)

    # 4. Migrate existing data
    cur.execute("""
        SELECT c.id, c.case_numbers, c.court_id,
               (SELECT cp.person_id FROM case_persons cp
                WHERE cp.case_id = c.id AND cp.role = 'Judge'
                LIMIT 1) as judge_id
        FROM cases c
        WHERE c.case_numbers IS NOT NULL
          AND c.case_numbers::text != '[]'
    """)

    for row in cur.fetchall():
        case_id, case_numbers_json, court_id, judge_id = row
        case_numbers = json.loads(case_numbers_json) if isinstance(case_numbers_json, str) else case_numbers_json

        for idx, cn in enumerate(case_numbers or []):
            case_num = cn.get('number') if isinstance(cn, dict) else cn
            is_primary = cn.get('primary', idx == 0) if isinstance(cn, dict) else (idx == 0)

            cur.execute("""
                INSERT INTO proceedings
                (case_id, case_number, jurisdiction_id, judge_id, sort_order, is_primary)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (case_id, case_number) DO NOTHING
            """, (case_id, case_num, court_id, judge_id, idx, is_primary))

    print("Proceedings table created and data migrated")
```

### Step 2: Verify Migration

Run verification query:

```sql
-- Check all case_numbers were migrated
SELECT c.id, c.case_name,
       jsonb_array_length(c.case_numbers) as old_count,
       (SELECT COUNT(*) FROM proceedings p WHERE p.case_id = c.id) as new_count
FROM cases c
WHERE c.case_numbers IS NOT NULL
  AND c.case_numbers::text != '[]'
  AND jsonb_array_length(c.case_numbers) !=
      (SELECT COUNT(*) FROM proceedings p WHERE p.case_id = c.id);
```

### Step 3: Remove Old Columns (after verification)

```sql
ALTER TABLE cases DROP COLUMN case_numbers;
ALTER TABLE cases DROP COLUMN court_id;
```

---

## Backend API Changes

### File: `database.py`

#### New Functions

```python
def get_proceedings(case_id: int) -> List[dict]:
    """Get all proceedings for a case, ordered by primary then sort_order."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT p.*,
                   j.name as jurisdiction_name,
                   j.local_rules_link,
                   per.name as judge_name
            FROM proceedings p
            LEFT JOIN jurisdictions j ON p.jurisdiction_id = j.id
            LEFT JOIN persons per ON p.judge_id = per.id
            WHERE p.case_id = %s
            ORDER BY p.is_primary DESC, p.sort_order ASC, p.created_at ASC
        """, (case_id,))
        return cur.fetchall()


def add_proceeding(case_id: int, case_number: str,
                   jurisdiction_id: int = None, judge_id: int = None,
                   is_primary: bool = False, notes: str = None) -> dict:
    """Add a proceeding to a case."""
    with get_cursor() as cur:
        # Get next sort_order
        cur.execute(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM proceedings WHERE case_id = %s",
            (case_id,)
        )
        sort_order = cur.fetchone()['max'] or 0

        # If this is first proceeding, make it primary
        cur.execute("SELECT COUNT(*) as count FROM proceedings WHERE case_id = %s", (case_id,))
        if cur.fetchone()['count'] == 0:
            is_primary = True

        cur.execute("""
            INSERT INTO proceedings
            (case_id, case_number, jurisdiction_id, judge_id, sort_order, is_primary, notes)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        """, (case_id, case_number, jurisdiction_id, judge_id, sort_order, is_primary, notes))
        return cur.fetchone()


def update_proceeding(proceeding_id: int, **kwargs) -> dict:
    """Update a proceeding."""
    allowed_fields = ['case_number', 'jurisdiction_id', 'judge_id',
                      'sort_order', 'is_primary', 'notes']
    updates = {k: v for k, v in kwargs.items() if k in allowed_fields}

    if not updates:
        return get_proceeding_by_id(proceeding_id)

    with get_cursor() as cur:
        set_clause = ", ".join(f"{k} = %s" for k in updates.keys())
        values = list(updates.values()) + [proceeding_id]

        cur.execute(f"""
            UPDATE proceedings
            SET {set_clause}, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING *
        """, values)
        return cur.fetchone()


def delete_proceeding(proceeding_id: int) -> bool:
    """Delete a proceeding."""
    with get_cursor() as cur:
        cur.execute("DELETE FROM proceedings WHERE id = %s RETURNING case_id", (proceeding_id,))
        row = cur.fetchone()
        if row:
            # If deleted was primary, make first remaining proceeding primary
            cur.execute("""
                UPDATE proceedings
                SET is_primary = TRUE
                WHERE case_id = %s AND id = (
                    SELECT id FROM proceedings
                    WHERE case_id = %s
                    ORDER BY sort_order LIMIT 1
                )
            """, (row['case_id'], row['case_id']))
        return row is not None


def reorder_proceedings(case_id: int, proceeding_ids: List[int]) -> None:
    """Reorder proceedings by updating sort_order."""
    with get_cursor() as cur:
        for idx, proc_id in enumerate(proceeding_ids):
            cur.execute(
                "UPDATE proceedings SET sort_order = %s WHERE id = %s AND case_id = %s",
                (idx, proc_id, case_id)
            )
```

#### Modify `get_case_by_id`

```python
def get_case_by_id(case_id: int) -> Optional[dict]:
    # ... existing code ...

    # Add proceedings to result
    result["proceedings"] = get_proceedings(case_id)

    # Keep case_numbers temporarily for backwards compatibility
    # result["case_numbers"] = ...  # Remove this after frontend migration

    return result
```

#### Modify `get_all_cases` (for list view)

Update the query to get primary proceeding info:

```python
def get_all_cases(...):
    # Add to SELECT:
    # (SELECT p.jurisdiction_id FROM proceedings p WHERE p.case_id = c.id AND p.is_primary LIMIT 1) as court_id,
    # (SELECT j.name FROM proceedings p JOIN jurisdictions j ON p.jurisdiction_id = j.id WHERE p.case_id = c.id AND p.is_primary LIMIT 1) as court,
    # (SELECT per.name FROM proceedings p JOIN persons per ON p.judge_id = per.id WHERE p.case_id = c.id AND p.is_primary LIMIT 1) as judge,
```

### File: `main.py` (API Routes)

Add new endpoints:

```python
@app.get("/api/v1/cases/{case_id}/proceedings")
def get_case_proceedings(case_id: int):
    return get_proceedings(case_id)


@app.post("/api/v1/cases/{case_id}/proceedings")
def create_proceeding(case_id: int, data: ProceedingCreate):
    return add_proceeding(
        case_id=case_id,
        case_number=data.case_number,
        jurisdiction_id=data.jurisdiction_id,
        judge_id=data.judge_id,
        is_primary=data.is_primary,
        notes=data.notes
    )


@app.put("/api/v1/proceedings/{proceeding_id}")
def update_proceeding_route(proceeding_id: int, data: ProceedingUpdate):
    return update_proceeding(proceeding_id, **data.dict(exclude_unset=True))


@app.delete("/api/v1/proceedings/{proceeding_id}")
def delete_proceeding_route(proceeding_id: int):
    if delete_proceeding(proceeding_id):
        return {"success": True}
    raise HTTPException(status_code=404, detail="Proceeding not found")


@app.put("/api/v1/cases/{case_id}/proceedings/reorder")
def reorder_proceedings_route(case_id: int, data: ReorderRequest):
    reorder_proceedings(case_id, data.proceeding_ids)
    return {"success": True}
```

Add Pydantic models:

```python
class ProceedingCreate(BaseModel):
    case_number: str
    jurisdiction_id: Optional[int] = None
    judge_id: Optional[int] = None
    is_primary: bool = False
    notes: Optional[str] = None


class ProceedingUpdate(BaseModel):
    case_number: Optional[str] = None
    jurisdiction_id: Optional[int] = None
    judge_id: Optional[int] = None
    is_primary: Optional[bool] = None
    notes: Optional[str] = None


class ReorderRequest(BaseModel):
    proceeding_ids: List[int]
```

---

## Frontend Changes

### File: `frontend/src/types/index.ts`

Add new type:

```typescript
export interface Proceeding {
  id: number;
  case_id: number;
  case_number: string;
  jurisdiction_id?: number;
  jurisdiction_name?: string;
  local_rules_link?: string;
  judge_id?: number;
  judge_name?: string;
  sort_order: number;
  is_primary: boolean;
  notes?: string;
  created_at: string;
  updated_at?: string;
}
```

Update `Case` interface:

```typescript
export interface Case {
  // ... existing fields ...

  // NEW
  proceedings: Proceeding[];

  // DEPRECATED - remove after migration
  // case_numbers: CaseNumber[];
  // court_id?: number;
  // court?: string;
}
```

Update `CaseSummary` interface:

```typescript
export interface CaseSummary {
  // ... existing fields ...
  court?: string;        // From primary proceeding
  judge?: string;        // From primary proceeding
  proceeding_count?: number;
}
```

### File: `frontend/src/api/client.ts`

Add API functions:

```typescript
// Proceedings
export const getProceedings = (caseId: number): Promise<Proceeding[]> =>
  api.get(`/cases/${caseId}/proceedings`).then(r => r.data);

export const createProceeding = (caseId: number, data: Partial<Proceeding>): Promise<Proceeding> =>
  api.post(`/cases/${caseId}/proceedings`, data).then(r => r.data);

export const updateProceeding = (proceedingId: number, data: Partial<Proceeding>): Promise<Proceeding> =>
  api.put(`/proceedings/${proceedingId}`, data).then(r => r.data);

export const deleteProceeding = (proceedingId: number): Promise<void> =>
  api.delete(`/proceedings/${proceedingId}`);

export const reorderProceedings = (caseId: number, proceedingIds: number[]): Promise<void> =>
  api.put(`/cases/${caseId}/proceedings/reorder`, { proceeding_ids: proceedingIds });
```

### File: `frontend/src/pages/CaseDetail.tsx`

#### Replace `CaseNumbersSection` with `ProceedingsSection`

The new component should:

1. Display proceedings as expandable cards
2. Show: case number, jurisdiction, judge, notes
3. Mark primary with star icon
4. Allow inline editing of all fields
5. Support add/remove/reorder

```
Proceedings (3)  [+ Add Proceeding]
┌─────────────────────────────────────────────────┐
│ ⭐ 2:24-cv-01234-PAC                    [Edit]  │
│    C.D. Cal. • Hon. Patricia Collins            │
│    Notes: Lead case after removal               │
├─────────────────────────────────────────────────┤
│ 24-STCV-12345                           [Edit]  │
│    LA Superior • Hon. Michael Chen              │
│    Notes: Removed to federal 3/15/24            │
├─────────────────────────────────────────────────┤
│ 24-56789                                [Edit]  │
│    9th Circuit • (No judge assigned)            │
└─────────────────────────────────────────────────┘
```

#### Component Structure

```tsx
function ProceedingsSection({ caseData, onUpdate }: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Mutations
  const createMutation = useMutation({ mutationFn: createProceeding });
  const updateMutation = useMutation({ mutationFn: updateProceeding });
  const deleteMutation = useMutation({ mutationFn: deleteProceeding });

  return (
    <div>
      <SectionHeader
        title="Proceedings"
        count={caseData.proceedings.length}
        onAdd={() => setIsAdding(true)}
      />

      {caseData.proceedings.map(proc => (
        <ProceedingCard
          key={proc.id}
          proceeding={proc}
          isEditing={editingId === proc.id}
          onEdit={() => setEditingId(proc.id)}
          onSave={(data) => updateMutation.mutate({ id: proc.id, ...data })}
          onDelete={() => deleteMutation.mutate(proc.id)}
          onSetPrimary={() => updateMutation.mutate({ id: proc.id, is_primary: true })}
        />
      ))}

      {isAdding && (
        <AddProceedingForm
          caseId={caseData.id}
          onSave={(data) => createMutation.mutate(data)}
          onCancel={() => setIsAdding(false)}
        />
      )}
    </div>
  );
}
```

#### Remove Old Judges Section

Currently there's a separate "Judges" section showing case-level judges. This should be removed since judges now live on proceedings.

Update the persons filter to exclude judges:

```typescript
// Before
const judges = caseData.persons.filter(p => p.role === 'Judge' || p.role === 'Magistrate Judge');

// After - remove this section entirely, judges shown in ProceedingsSection
```

### File: `frontend/src/pages/Cases.tsx`

Update columns to reflect primary proceeding:

```typescript
const columns = [
  // ... existing columns ...
  {
    accessorKey: "court",
    header: "Court",
    // Now comes from primary proceeding
  },
  {
    accessorKey: "judge",
    header: "Judge",
    // Now comes from primary proceeding
  },
];
```

No major changes needed if backend returns these fields from primary proceeding.

---

## Testing Checklist

### Database
- [ ] Migration creates table correctly
- [ ] Existing case_numbers data migrates to proceedings
- [ ] Existing judges migrate to proceedings
- [ ] Unique constraint prevents duplicate case numbers per case
- [ ] Trigger enforces single primary per case
- [ ] Cascade delete removes proceedings when case deleted

### API
- [ ] GET /cases/{id} returns proceedings array
- [ ] GET /cases/{id}/proceedings returns proceedings
- [ ] POST /cases/{id}/proceedings creates proceeding
- [ ] PUT /proceedings/{id} updates proceeding
- [ ] DELETE /proceedings/{id} deletes proceeding
- [ ] PUT /cases/{id}/proceedings/reorder works
- [ ] First proceeding auto-set as primary
- [ ] Setting new primary unsets old primary

### Frontend
- [ ] Proceedings display in correct order (primary first)
- [ ] Can add new proceeding
- [ ] Can edit proceeding (case number, jurisdiction, judge, notes)
- [ ] Can delete proceeding
- [ ] Can set different primary
- [ ] Can reorder proceedings (if implementing drag/drop)
- [ ] Cases list shows primary proceeding's court/judge
- [ ] Judge dropdown shows existing judges
- [ ] Jurisdiction dropdown shows existing jurisdictions

---

## Rollback Plan

If issues arise:

1. Keep `case_numbers` JSONB column during migration
2. Backend can fall back to reading from `case_numbers` if `proceedings` is empty
3. To fully rollback:
   ```sql
   -- Regenerate case_numbers from proceedings
   UPDATE cases c SET case_numbers = (
     SELECT jsonb_agg(jsonb_build_object(
       'number', p.case_number,
       'primary', p.is_primary
     ) ORDER BY p.sort_order)
     FROM proceedings p WHERE p.case_id = c.id
   );

   -- Drop proceedings table
   DROP TABLE proceedings;
   ```

---

## Implementation Order

1. **Phase 1: Backend** (no UI impact)
   - Add proceedings table and migration
   - Add new API functions
   - Update get_case_by_id to include proceedings
   - Keep old case_numbers working

2. **Phase 2: Frontend Types**
   - Add Proceeding type
   - Add API client functions
   - Update Case type to include proceedings

3. **Phase 3: Frontend UI**
   - Build ProceedingsSection component
   - Replace CaseNumbersSection
   - Remove standalone Judges section
   - Update Cases list if needed

4. **Phase 4: Cleanup**
   - Remove case_numbers JSONB column
   - Remove court_id from cases table
   - Remove old CaseNumber type
   - Remove backwards-compat code
