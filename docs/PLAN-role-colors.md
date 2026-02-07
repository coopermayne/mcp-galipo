# Plan: Data-Driven Role Colors

## Problem

Role names are hardcoded throughout the codebase for styling and grouping. If a role is renamed, added, or removed, the code breaks silently. The hardcoded places:

- **`OverviewTab.tsx`** — filters persons into sections by matching role names (`'opposing_counsel'`, `'plaintiff_expert'`, etc.), maps role names to color variants (`getCounselVariant`, `getExpertVariant`, `getOtherVariant`)
- **`PersonDetailContent.tsx`** — shows different attribute fields based on role name substrings (`'expert'`, `'attorney'`, `'mediator'`, `'client'`)
- **`roleFormat.ts`** — hardcoded display name mapping (snake_case → "Human Readable")
- **`pdf_generator.py`** — hardcoded role ordering list, role-to-color-variant dict
- **`docx_generator.py`** — hardcoded role name comparisons for counsel grouping

## Solution

Put `color` on the `roles` table. The role record itself carries everything the UI needs — no name-matching in code.

- **Grouping** → use `role.category` (client, counsel, defendant, expert, mediator, other)
- **Sort order within group** → use `role.sort_order` (already exists)
- **Per-role color** → use new `role.color` column (a `BADGE_PALETTE` key from `colors.ts`)
- **Display name** → use `role.name` from DB (already works; `roleFormat.ts` mapping becomes unnecessary)
- **Attribute fields** (expert fields, bar number, etc.) → use `role.category` instead of name substrings

Custom/new roles just work — they get a category, a color, a sort_order, and show up in the right section with the right styling. No code changes needed.

## Steps

### 1. Schema: add `color` column to `roles`

- Add `color: Mapped[Optional[str]]` to the `Role` model in `models.py` (nullable `String(30)`)
- Generate Alembic migration
- Migration sets colors for existing roles:

| role | category | color |
|------|----------|-------|
| plaintiff | client | blue |
| contact | client | sky |
| guardian_ad_litem | client | cyan |
| decedent | client | slate |
| co_counsel | counsel | emerald |
| referring_attorney | counsel | amber |
| opposing_counsel | counsel | red |
| criminal_defense_attorney | counsel | orange |
| prosecutor | counsel | rose |
| public_defender | counsel | violet |
| municipality_defendant | defendant | red |
| individual_defendant | defendant | orange |
| plaintiff_expert | expert | blue |
| defense_expert | expert | rose |
| mediator | mediator | amber |
| lien_holder | other | red |
| witness | other | blue |
| claims_adjuster | other | teal |
| special_needs_consultant | other | purple |

### 2. Backend: expose `color` in API responses

- Add `color: Optional[str] = None` to `RoleBriefOut` and `RoleOut` in `schemas/outputs.py`
- The `from_attributes=True` config means it auto-populates from the ORM — no serializer changes needed in `db/persons.py` or `db/roles.py`

### 3. Frontend: use `role.color` instead of hardcoded mappings

**`OverviewTab.tsx`:**
- Replace all role-name filtering with `role.category` filtering:
  - `clients` → `p.role?.category === 'client'`
  - `defendants` → `p.role?.category === 'defendant'`
  - `counsel` → `p.role?.category === 'counsel'`
  - `experts` → `p.role?.category === 'expert'`
  - `mediators` → `p.role?.category === 'mediator'`
  - `others` → category not in the above set
- Remove `coveredRoles` list entirely
- Sort within each section by `role.sort_order` (from DB) instead of hardcoded arrays
- Replace `getCounselVariant()`, `getExpertVariant()`, `getOtherVariant()` with a single helper that reads `role.color` and maps it to a badge palette color, falling back to category color
- Remove hardcoded `clientRoleOptions`, `counselRoleOptions`, etc. — fetch role options from `/api/v1/roles?category=X` or filter the already-fetched roles list

**`PersonDetailContent.tsx`:**
- Replace role name substring checks with category checks:
  - `roleName.includes('expert')` → `role.category === 'expert'`
  - `roleName.includes('attorney') || roleName.includes('counsel')` → `role.category === 'counsel'`
  - `roleName.includes('mediator')` → `role.category === 'mediator'`
  - `roleName === 'client'` → `role.category === 'client'`

**`roleFormat.ts`:**
- Delete the `ROLE_DISPLAY_NAMES` hardcoded mapping
- `formatRoleName()` can stay as a generic snake_case → Title Case formatter (or just use `role.name` from DB which is already the display name... check if names are stored as snake_case or display-friendly)

### 4. Backend PDF/DOCX: use role data instead of hardcoded dicts

**`pdf_generator.py`:**
- Remove hardcoded `role_order` list — sort by `(category_order, sort_order)` from role data
- Remove hardcoded `role_variant` dict — use `role['color']` from the data
- Replace `_get_persons_by_role(persons, 'Client')` with filtering by category

**`docx_generator.py`:**
- Replace `_get_persons_by_role(persons, "Client")` with category filter
- Replace hardcoded counsel name matching in `_get_counsel_groups()` with category-based grouping

### 5. Frontend types

- Update `CasePerson.role` type (or whatever TS interface holds the role) to include `color?: string`

### 6. Cleanup

- Remove `ROLE_CATEGORY_COLORS` from `colors.ts` if no longer needed (since individual roles now carry their own color). Or keep it as a fallback for roles with no color set.
- Remove any remaining hardcoded role name references found in the audit
