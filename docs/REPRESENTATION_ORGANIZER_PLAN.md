# Representation Organizer — Implementation Plan

A casual, drag-and-drop table on the case detail page that lets users visually
group parties, attorneys, and experts into representation "rows" — e.g. which
plaintiff/defendants share which counsel and experts.

## Goals & Non-Goals

**Goals**
- Give users a single glance view of "who represents whom" on a case.
- Re-arrange existing case people into rows via drag-and-drop. No data entry.
- Allow an expert to live in multiple rows (shared experts across separately-represented defendants).
- Preserve the existing `grouped_under_id` person hierarchy — drag the lead, subordinates follow.

**Non-goals (for v1)**
- Adding new people to the case from within the organizer (closed picker only).
- Querying the layout from SQL ("who represents Defendant 1?"). Purely presentational.
- Row labels / group names. Add later if needed.
- Auto-routing by role. User drops where they want.

## Data Model

**One new column on `cases`:**

```python
# models.py — Case
representation_layout = Column(JSONB, nullable=True)
```

**Shape:**

```json
{
  "rows": [
    {
      "id": "uuid",
      "parties":   [person_id, ...],
      "attorneys": [person_id, ...],
      "experts":   [person_id, ...]
    }
  ]
}
```

- Stored `person_id`s are **lead** people only (those with `grouped_under_id IS NULL`).
- Subordinates are rendered inline under their lead by walking the tree at display time.
- Same `person_id` may appear in multiple rows' `experts` arrays (shared experts).
- `parties` and `attorneys` are exclusive: dragging a lead between rows moves it.
- `experts` are non-exclusive: `Alt`/`Option`-drag clones into the target row.

**Filtering on render:**
- If a stored `person_id` no longer exists on the case, drop it silently.
- If a stored `person_id` has gained a `grouped_under_id` (no longer a lead), drop it silently — it'll render under its new lead's row automatically.

**No new tables. No new junctions. No new constraints.**

## Backend

### Migration

```bash
alembic revision --autogenerate -m "add representation_layout to cases"
```

Review the generated file, then `alembic upgrade head`.

### Pydantic schemas (`schemas/inputs.py`, `schemas/outputs.py`)

```python
class RepresentationRow(BaseModel):
    id: str
    parties:   list[int] = []
    attorneys: list[int] = []
    experts:   list[int] = []

class RepresentationLayout(BaseModel):
    rows: list[RepresentationRow] = []
```

### Routes (`routes/cases.py` — extend existing module)

- `GET  /api/v1/cases/{case_id}/representation-layout` → `RepresentationLayout`
- `PUT  /api/v1/cases/{case_id}/representation-layout` body `RepresentationLayout`

Both are thin: read or write the JSONB column.

### MCP tools

No new tools. No `MCP_INSTRUCTIONS` change.

### Dockerfile

No new root-level files or directories — no changes.

## Frontend

### Stack & reuse

- DnD: `@dnd-kit/core` + `@dnd-kit/sortable` — **already installed**.
- Pattern: mirror `components/common/person-tree.tsx` (uses `DndContext`, `useDraggable`, `useDroppable`, `DragOverlay`, `PointerSensor`).
- Colors: reuse the `ROLE_COLORS` palette from `person-tree.tsx`.
- Types: `CasePerson` from `@/types/case`.

### New files

- `frontend/src/pages/cases/components/representation-organizer.tsx` — the section component.
- `frontend/src/services/representation.ts` — `getLayout(caseId)` / `updateLayout(caseId, layout)`.
- `frontend/src/hooks/use-representation-layout.ts` — TanStack Query wrapper (query + mutation with optimistic update + invalidate).

### Component structure

```
<RepresentationOrganizer caseId={...} casePersons={...}>
  <DndContext>
    <UnassignedTray />        // grouped by role: Parties / Counsel / Experts
    <Rows>
      <Row>
        <DropZone column="parties">   {lead chip + subordinates inline}
        <DropZone column="attorneys"> {lead chip + subordinates inline}
        <DropZone column="experts">   {lead chip + subordinates inline}
      </Row>
      ... more rows
      <AddRowButton />
    </Rows>
    <DragOverlay />
  </DndContext>
</RepresentationOrganizer>
```

### Behavior

- **Draggable units**: lead people only (no `grouped_under_id`). Subordinates render inline but are not independently draggable in this view.
- **Drop zones**: 3 per row + the unassigned tray. Drop targets light up on drag-over.
- **Move vs. copy**: plain drag = move; `Alt`/`Option`-drag = copy (UX only meaningful for the `experts` column).
  - Detect via `event.activatorEvent.altKey` or track key state with a `keydown`/`keyup` listener during drag.
- **Add row**: `+ Add row` button appends `{ id: uuid(), parties: [], attorneys: [], experts: [] }`.
- **Delete row**: small `⋯` menu on each row → "Delete row" (only available when empty, or with a confirm if not).
- **Remove from row**: chip has an `x` on hover.
- **Unassigned tray**: shows leads not currently placed in any row. Grouped by role family (Parties / Counsel / Experts) for findability. Drag from tray → row places them; drag from row → tray removes.
- **Persistence**: every mutation triggers an optimistic local update + debounced `PUT`. Failure rolls back and toasts.

### Visual

- Square corners (project convention).
- Use semantic status tokens for the colored chips (`--info`, `--success`, etc.) only if mapping by role family; otherwise reuse `ROLE_COLORS` per-role colors.
- Each cell is a `useDroppable` container with a subtle border. Empty cells show "Drop here" placeholder text.
- Lead chip with subordinates indented underneath (mimic `person-tree.tsx` nesting style).

### Integration

Mount as a new section on the case detail page. Likely place: alongside `case-counsel-card.tsx` / `case-summary-section.tsx` — a collapsible card titled "Representation". Default-collapsed for cases with no layout yet; default-open once a layout exists.

## Edge cases

| Case | Behavior |
|------|----------|
| Person removed from case | Silently filtered out on render. |
| Lead becomes a subordinate (re-parented via PersonTree) | Filtered from layout on render; they now render under their new lead's row. |
| Layout references a `person_id` that no longer exists | Silently filtered out. |
| Empty layout (`null` or `{rows: []}`) | Organizer shows just the unassigned tray + "Add row" button. |
| Two rows have the same `experts` entry | Both render it — that's the feature. |
| User Alt-drags a *party* or *attorney* | Treat as a normal move (copy only applies to experts column). |
| Row with no people | Allowed; user can delete via menu. |

## Build sequence

1. **Backend**
   - [ ] Add `representation_layout` JSONB column to `Case` in `models.py`.
   - [ ] Generate + apply Alembic migration.
   - [ ] Add `RepresentationRow` / `RepresentationLayout` schemas.
   - [ ] Add `GET` and `PUT` routes in `routes/cases.py`.
2. **Frontend plumbing**
   - [ ] `services/representation.ts`.
   - [ ] `hooks/use-representation-layout.ts` (TanStack Query).
3. **Frontend UI**
   - [ ] `representation-organizer.tsx` skeleton (read-only render).
   - [ ] Drag-and-drop wiring (`DndContext`, droppables, draggables).
   - [ ] Alt-drag clone behavior for experts.
   - [ ] Add row / delete row / remove chip controls.
   - [ ] Optimistic update + debounced save.
4. **Integration**
   - [ ] Mount section in case detail page.
   - [ ] Verify with cases that have nested people (lead atty + associates, plaintiff + GAL).
5. **Polish**
   - [ ] Empty states.
   - [ ] Drag overlay styling matches `person-tree.tsx`.

## Open follow-ups (post-v1)

- Row labels.
- Open picker (add new people from inside the organizer).
- Make shared experts a first-class concept (chip menu / "Assign to other rows") instead of relying on Alt-drag discoverability.
- Querying the layout from the backend (e.g. for document generation: "who represents Defendant 1?").
