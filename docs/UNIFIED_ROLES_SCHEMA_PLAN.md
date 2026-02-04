# Unified Roles Schema Plan

> **Status**: Draft — not yet implemented
> **Date**: 2025-02-04
> **Goal**: Replace `person_type` + `case_persons` with a single `person_roles` table where `case_id` is nullable, backed by a managed `roles` lookup table.

---

## The Problem

The current schema has three overlapping concepts:

1. **`persons.person_type`** (VARCHAR) — "what kind of entity is this?" (client, attorney, expert...)
2. **`case_persons.role`** (VARCHAR) — "what's their role on this case?" (Opposing Counsel, Expert - Plaintiff...)
3. **`person_types`** table — dead lookup, not FK-referenced

The frontend only uses `role` for grouping. `person_type` is redundant — it's always inferred from role during import. The `person_types` table constrains nothing. Two JSONB columns (`persons.attributes` and `case_persons.case_attributes`) store the same kind of data split across two tables.

## The Solution

**One concept: roles.** A person is defined by their roles. Some roles are standalone (identity/contact-book roles with no case), some are case-bound (assigned to a specific case). Attributes live on the role entry, not the person.

---

## New Schema

### `roles` table (replaces `person_types`)

```sql
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL,     -- 'client','defendant','counsel','expert','mediator','judicial','other'
    default_side VARCHAR(20),          -- 'plaintiff','defendant','neutral', or NULL
    sort_order INTEGER DEFAULT 0,      -- UI ordering within category
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Seed data:**

| Name | Category | Default Side | Notes |
|------|----------|-------------|-------|
| Client | client | plaintiff | |
| Guardian Ad Litem | client | plaintiff | |
| Plaintiff Contact | client | plaintiff | |
| Decedent | client | plaintiff | |
| Defendant | defendant | defendant | |
| Attorney | counsel | NULL | Generic standalone role |
| Opposing Counsel | counsel | defendant | |
| Co-Counsel | counsel | plaintiff | |
| Referring Attorney | counsel | plaintiff | |
| Expert | expert | NULL | Generic standalone role |
| Expert - Plaintiff | expert | plaintiff | |
| Expert - Defendant | expert | defendant | |
| Mediator | mediator | neutral | |
| Judge | judicial | neutral | |
| Magistrate Judge | judicial | neutral | |
| Witness | other | neutral | |
| Interpreter | other | neutral | |
| Insurance Adjuster | other | defendant | |
| Lien Holder | other | neutral | |

Users can add/edit/delete roles through a "Manage Roles" UI (replaces current "Manage Types" modal).

### `person_roles` table (replaces `case_persons`)

```sql
CREATE TABLE person_roles (
    id SERIAL PRIMARY KEY,
    person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,  -- NULL = standalone identity role
    side VARCHAR(20),                   -- can override role's default_side
    attributes JSONB DEFAULT '{}',      -- role-specific attributes (replaces BOTH persons.attributes AND case_persons.case_attributes)
    notes TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    grouped_under_id INTEGER REFERENCES persons(id),
    assigned_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Partial unique indexes (needed because PostgreSQL NULLs are distinct in UNIQUE constraints)
CREATE UNIQUE INDEX uq_person_roles_case
    ON person_roles(person_id, role_id, case_id) WHERE case_id IS NOT NULL;
CREATE UNIQUE INDEX uq_person_roles_standalone
    ON person_roles(person_id, role_id) WHERE case_id IS NULL;

CREATE INDEX idx_person_roles_person_id ON person_roles(person_id);
CREATE INDEX idx_person_roles_role_id ON person_roles(role_id);
CREATE INDEX idx_person_roles_case_id ON person_roles(case_id);
CREATE INDEX idx_person_roles_attributes ON person_roles USING GIN (attributes);
```

### `persons` table (simplified)

Drop `person_type` and `attributes` columns. The table becomes pure identity + contact info:

```sql
-- After migration:
-- id, name, phones, emails, address, organization, notes, created_at, updated_at, archived
```

### Dropped tables

- `person_types` — dead lookup, never FK-referenced
- `case_persons` — replaced by `person_roles`

---

## How It Works

### Creating a standalone person (no case)

A paralegal adds an expert to the firm's contacts:

```
persons: {id: 5, name: "Dr. Smith", phones: [...], organization: "Smith Biomechanics"}
person_roles: {person_id: 5, role_id: <Expert>, case_id: NULL, attributes: {hourly_rate: 500, specialties: ["Biomechanics"]}}
```

The role determines what form fields to show (Expert → rates, specialties).

### Assigning to a case

That expert gets assigned to Smith v. Jones as Expert - Plaintiff:

```
person_roles: {person_id: 5, role_id: <Expert - Plaintiff>, case_id: 12, side: "plaintiff", attributes: {hourly_rate: 600}}
```

The case-bound entry overrides the standalone rate ($600 vs $500 default).

### Viewing a person

The person detail page shows ALL roles:

- **Expert** (standalone): hourly_rate: $500, specialties: [Biomechanics]
- **Expert - Plaintiff** on Smith v. Jones: hourly_rate: $600 (override)
- **Witness** on Doe v. Roe: testimony_topic: "accident scene"

### Attribute resolution

```python
# For a specific case context: case-bound overrides standalone
effective = {**standalone_role.attributes, **case_role.attributes}
```

### Case detail page grouping

Currently the OverviewTab hardcodes role grouping:
```js
const counselOrder = ['Opposing Counsel', 'Co-Counsel', 'Referring Attorney'];
```

With the roles table, this becomes data-driven:
```js
const counselRoles = roles.filter(r => r.category === 'counsel');
```

### Filtering the persons list

Currently: `WHERE person_type = 'attorney'`
New: `JOIN person_roles pr ON p.id = pr.person_id JOIN roles r ON pr.role_id = r.id WHERE r.category = 'counsel'`

### MCP import flow

1. AI sends role name string (e.g., "Defense Counsel")
2. `normalize_role()` maps to canonical name ("Opposing Counsel")
3. Look up in `roles` table by name → get `role_id`
4. Insert into `person_roles` with the case_id

---

## Key Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| FK to roles table | By `role_id` (integer) | Enables renaming roles without mass-updating rows |
| Nullable case_id constraint | Partial unique indexes | PostgreSQL NULLs are distinct in UNIQUE; need two partial indexes |
| Attributes location | On `person_roles`, not `persons` | One place for all role-specific data; standalone role = defaults, case role = overrides |
| Judges | Stay on `proceedings.judges` table | Different structural purpose; persons who are judges also get standalone person_roles for identity attributes |
| `normalize_role()` | Keep it | Still useful for MCP import alias matching before roles table lookup |
| Generic roles (Attorney, Expert) | Included in roles table | For standalone persons not yet assigned to a side |

---

## Migration Strategy

### Phase 1: Non-destructive (Migration 012)

1. Create `roles` table, seed canonical roles
2. Create `person_roles` table with indexes
3. Copy `case_persons` → `person_roles` (JOIN to match role name → role_id)
4. Create standalone `person_roles` from `persons.person_type` + `persons.attributes`
5. **Keep old columns/tables** as rollback safety net

### Phase 2: Cleanup (Migration 013, deploy separately after verification)

1. Drop `persons.person_type` and `persons.attributes` columns
2. Drop `case_persons` table
3. Drop `person_types` table

---

## Implementation Sequence

### Backend Database Layer

| # | File | Change |
|---|------|--------|
| 1 | `migrations/012_roles_and_person_roles.sql` | **New** — create tables, migrate data |
| 2 | `db/roles.py` | **New** — CRUD for roles table (get_roles, create_role, update_role, delete_role, get_roles_by_category) |
| 3 | `db/persons.py` | **Rewrite** — remove person_type, use person_roles instead of case_persons for all 6+ functions |
| 4 | `db/cases.py` | Update 4 queries — replace case_persons JOINs with person_roles+roles |
| 5 | `db/import_case.py` | **Rewrite** `_create_person_and_assign()` — lookup role by name, insert person_roles. Delete `_infer_person_type()` |
| 6 | `db/validation.py` | Delete `validate_person_type()`, `DEFAULT_PERSON_TYPES`. Keep `normalize_role()` |
| 7 | `db/types.py` | Delete person_type CRUD functions (keep expertise_types functions) |
| 8 | `db/__init__.py` | Update exports |
| 9 | `db/connection.py` | Update `init_db()` schema for fresh installs, replace `seed_person_types()` with `seed_roles()` |

### Backend API + MCP Layer

| # | File | Change |
|---|------|--------|
| 10 | `routes/persons.py` | Remove person_type from endpoints, use role/category filters |
| 11 | `routes/stats.py` | Replace `/api/v1/person-types` endpoints with `/api/v1/roles` |
| 12 | `routes/export.py` | Update batch query |
| 13 | `tools.py` | Update MCP tool docstrings, remove person_type references |
| 14 | `main.py`, `mcp_stdio.py` | Update system prompt guidance |
| 15 | `services/chat/presets.py` | Update 2 case context queries |
| 16 | `seed_dev_data.py` | Update person creation flow |

### Frontend

| # | File | Change |
|---|------|--------|
| 17 | `types/common.ts`, `types/person.ts` | Remove PersonType, add Role interface, update Person/CasePerson interfaces |
| 18 | `api/persons.ts` | Replace person-types API with roles API, update filters |
| 19 | `pages/CaseDetail/tabs/OverviewTab.tsx` | Use `roles.category` for grouping instead of hardcoded lists |
| 20 | `components/modals/PersonDetailContent.tsx` | **Rewrite** AttributesSection: iterate person's roles, show per-role attributes |
| 21 | `components/persons/PersonsFeed.tsx` | Group by role category instead of person_type |
| 22 | `components/persons/PersonItem.tsx` | Badge shows role(s) instead of person_type |
| 23 | `components/common/PersonAutocomplete.tsx` | Filter by role category instead of person_type |
| 24 | `components/common/AddPersonDropdown.tsx` | Update callback types |
| 25 | `pages/Persons.tsx` | Replace "Manage Types" modal with "Manage Roles" modal |
| 26 | **Delete** `utils/personRoleMapping.ts` | No longer needed |

### Cleanup

| # | File | Change |
|---|------|--------|
| 27 | `migrations/013_drop_old_person_columns.sql` | Drop person_type, attributes, case_persons, person_types |
| 28 | `CLAUDE.md` | Update schema docs, remove "Future Plans" section |

---

## Files Summary

**New (3):** `db/roles.py`, `migrations/012_*.sql`, `migrations/013_*.sql`

**Deleted (1):** `frontend/src/utils/personRoleMapping.ts`

**Major rewrites (5):** `db/persons.py`, `db/import_case.py`, `frontend/src/types/person.ts`, `PersonDetailContent.tsx`, `OverviewTab.tsx`

**Moderate changes (12):** `db/cases.py`, `db/validation.py`, `db/connection.py`, `db/__init__.py`, `routes/persons.py`, `routes/stats.py`, `tools.py`, `api/persons.ts`, `PersonsFeed.tsx`, `PersonItem.tsx`, `PersonAutocomplete.tsx`, `Persons.tsx`

**Minor changes (6):** `routes/export.py`, `services/chat/presets.py`, `main.py`, `mcp_stdio.py`, `seed_dev_data.py`, `types/common.ts`

---

## Verification Checklist

- [ ] Migration runs cleanly on dev database
- [ ] `SELECT COUNT(*) FROM person_roles WHERE case_id IS NOT NULL` matches old `SELECT COUNT(*) FROM case_persons`
- [ ] Every person has at least one standalone person_roles entry
- [ ] Server starts without errors
- [ ] `/api/v1/cases` and `/api/v1/persons` endpoints return correct data
- [ ] MCP `import_case` tool works (import a test case with persons)
- [ ] Case detail page: persons grouped correctly by category
- [ ] Persons page: filtering by role/category works
- [ ] Person detail modal: attributes display per-role
- [ ] "Manage Roles" modal works (add/edit/delete roles)
- [ ] `npm run type-check` passes
- [ ] `npm run build` succeeds
