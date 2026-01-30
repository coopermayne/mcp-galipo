# Plan: Dynamic Defense Section with Drag-and-Drop Pairing

## Context
- Typically, one set of opposing counsel represents ALL defendants
- Occasionally, one defendant has separate counsel
- Need a UI that defaults to simple but allows exceptions via drag-and-drop

---

## Design: Side-by-Side Boxes with Drag-to-Separate

### Default State (Common Case)
Two boxes side by side - all defendants share all opposing counsel:

```
┌─────────────────────┐  ┌─────────────────────┐
│ Defendants      [+] │  │ Opposing Counsel [+]│
│ [ABC] [XYZ] [123]   │  │ [Smith] [Doe]       │
└─────────────────────┘  └─────────────────────┘
```

### After Separating a Defendant
User drags XYZ down → new row appears with empty counsel drop zone:

```
┌─────────────────────┐  ┌─────────────────────┐
│ Defendants      [+] │  │ Opposing Counsel [+]│
│ [ABC] [123]         │  │ [Smith] [Doe]       │
└─────────────────────┘  └─────────────────────┘

┌─────────────────────┐  ┌─────────────────────┐
│ [XYZ]               │  │ (drop counsel) [+]  │
└─────────────────────┘  └─────────────────────┘
        ↑ drag back to merge       ↑ drop zone + add button
```

### Interaction Details
1. **Drag defendant down** → Creates new row below, counsel box has drop zone + add button
2. **Drag defendant back up** → Merges back into main row (counsel stays or moves with?)
3. **Drag counsel to separated row** → Links counsel to that specific defendant
4. **New rows always append** at bottom (no inserting between)

---

## Data Model

Uses existing `contact_via_person_id` field + new `case_attributes.separated` flag:

| State | Defendant | Opposing Counsel |
|-------|-----------|------------------|
| Main row | `separated: false` (default) | `contact_via_person_id: null` |
| Separated row | `separated: true` | `contact_via_person_id: <defendant_id>` |

### Rendering Logic
```tsx
// Main row defendants (not separated)
const mainDefendants = defendants.filter(d => !d.case_attributes?.separated);

// Main row counsel (not linked to specific defendant)
const mainCounsel = opposingCounsel.filter(c => !c.contact_via_person_id);

// Separated defendants
const separatedDefendants = defendants.filter(d => d.case_attributes?.separated);

// For each separated defendant, find their linked counsel
const getCounselForDefendant = (defId: number) =>
  opposingCounsel.filter(c => c.contact_via_person_id === defId);
```

---

## Implementation

### File: `frontend/src/pages/CaseDetail/tabs/OverviewTab.tsx`

### 1. Create new DefenseSection component

```tsx
function DefenseSection({
  defendants,
  opposingCounsel,
  caseId,
  assignedPersonIds,
  onOpenPersonModal
}: DefenseSectionProps) {
  // Separate main vs separated defendants
  const mainDefendants = useMemo(() =>
    defendants.filter(d => !d.case_attributes?.separated), [defendants]);
  const separatedDefendants = useMemo(() =>
    defendants.filter(d => d.case_attributes?.separated), [defendants]);

  // Separate main vs linked counsel
  const mainCounsel = useMemo(() =>
    opposingCounsel.filter(c => !c.contact_via_person_id), [opposingCounsel]);

  const getCounselForDefendant = useCallback((defId: number) =>
    opposingCounsel.filter(c => c.contact_via_person_id === defId), [opposingCounsel]);

  // Drag handlers
  const handleDefendantDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    if (over.id === 'new-row-zone') {
      // Mark defendant as separated
      updateCaseAssignment(caseId, active.id, {
        case_attributes: { separated: true }
      });
    } else if (over.id === 'main-defendants') {
      // Merge back - clear separated flag
      updateCaseAssignment(caseId, active.id, {
        case_attributes: { separated: false }
      });
    }
  };

  const handleCounselDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const defendantId = over.id.toString().startsWith('counsel-zone-')
      ? parseInt(over.id.toString().replace('counsel-zone-', ''))
      : null;

    // Link counsel to defendant (or null for main row)
    updateCaseAssignment(caseId, active.id, {
      contact_via_person_id: defendantId
    });
  };

  return (
    <div className="space-y-2">
      {/* Main row */}
      <div className="grid grid-cols-2 gap-2">
        <DroppableBox id="main-defendants" label="Defendants">
          {mainDefendants.map(d => <DraggablePersonChip key={d.id} person={d} />)}
          <AddDefendantButton />
        </DroppableBox>
        <DroppableBox id="main-counsel" label="Opposing Counsel">
          {mainCounsel.map(c => <DraggablePersonChip key={c.id} person={c} variant="danger" />)}
          <AddCounselButton />
        </DroppableBox>
      </div>

      {/* Separated rows */}
      {separatedDefendants.map(def => (
        <div key={def.id} className="grid grid-cols-2 gap-2">
          <div className="bg-slate-50 rounded p-2">
            <DraggablePersonChip person={def} />
          </div>
          <DroppableBox id={`counsel-zone-${def.id}`}>
            {getCounselForDefendant(def.id).map(c =>
              <DraggablePersonChip key={c.id} person={c} variant="danger" />
            )}
            <AddCounselButton defendantId={def.id} />
          </DroppableBox>
        </div>
      ))}

      {/* Drop zone for creating new separated row */}
      {mainDefendants.length > 0 && (
        <DropZone id="new-row-zone" label="Drop defendant here to separate" />
      )}
    </div>
  );
}
```

### 2. Update API to support `case_attributes` updates

The `updateCaseAssignment` API already supports `case_attributes`, but need to ensure it does a merge (not replace):

**File: `db/persons.py`** - Verify the update merges case_attributes:
```python
# Should merge, not replace
cur.execute("""
  UPDATE case_persons
  SET case_attributes = case_attributes || %s::jsonb
  WHERE ...
""")
```

### 3. Remove Opposing Counsel from Case Details section

**Lines ~538-558**: Update counsel filter to only show Co-Counsel and Referring Attorney:
```tsx
const plaintiffCounsel = useMemo(() => {
  return (caseData.persons || [])
    .filter(p => ['Co-Counsel', 'Referring Attorney'].includes(p.role || ''));
}, [caseData.persons]);
```

### 4. Replace Defendants card in grid

**Lines ~683-714**: Replace with `<DefenseSection ... />`

### 5. Update grid layout

Change from 4 equal columns to accommodate wider Defense section:
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* Clients - 1 col */}
  {/* Defense - 2 cols on lg */}
  {/* Experts - 1 col */}
  {/* Other - 1 col */}
</div>
```

Or keep 4 columns and make Defense section span 2:
```tsx
<div className="lg:col-span-2"> {/* Defense */}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `frontend/src/pages/CaseDetail/tabs/OverviewTab.tsx` | Add DefenseSection, update grid, remove opposing counsel from Case Details |
| `frontend/src/api/persons.ts` | May need to ensure `case_attributes` merge works |
| `db/persons.py` | Verify case_attributes update does JSONB merge |

---

## Edge Cases

1. **Dragging last defendant out of main row**: Main row shows "None" or empty state
2. **Counsel in separated row, defendant dragged back**: **Auto-move counsel to main row** (clear their `contact_via_person_id`)
3. **Adding counsel when defendants are separated**: Show dropdown to pick main or specific defendant

---

## Verification

1. Default state shows all defendants + counsel in main row
2. Drag defendant down → new row appears with drop zone + add button
3. Drag counsel to separated row → counsel moves there
4. Drag defendant back up → merges back (and linked counsel moves to main)
5. Add new defendant → appears in main row
6. Add new counsel → can choose main or specific defendant
7. Co-Counsel/Referring Attorney still in Case Details section
