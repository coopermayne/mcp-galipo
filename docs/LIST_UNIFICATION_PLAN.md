# List Component Unification Plan

## Goal

Rebuild all list rendering from the ground up using flexible, reusable compound components. This replaces the current scattered implementations with a unified system designed for our actual needs.

## Why Ground-Up Rebuild (Not Incremental Migration)

For a project this size, a clean rebuild is better than incremental migration:

- **Small codebase** - Only ~6-8 files to touch
- **No external consumers** - No API backwards compatibility needed
- **Cleaner result** - Design for actual needs, not legacy constraints
- **Faster total time** - No shimming, no maintaining two systems

## Current State (What We're Replacing)

### Files to Delete/Replace

| File | What It Does | Replacement |
|------|--------------|-------------|
| `components/common/ListPanel.tsx` | Basic card list | `List` compound component |
| `components/tasks/SortableTaskRow.tsx` | Full-featured sortable task row | `List.Row` + `TaskRowContent` |
| `components/tasks/DraggableTaskRow.tsx` | Drag-to-docket wrapper | `List.DraggableRow` |
| `components/tasks/UrgencyGroup.tsx` | Tasks grouped by urgency | `List.Group` |
| `components/tasks/CaseGroup.tsx` | Tasks grouped by case | `List.Group` |
| `components/tasks/DateGroup.tsx` | Tasks grouped by date | `List.Group` |
| `components/docket/TodayTaskList.tsx` | Docket task list | `List` + `List.SortableRow` |
| `pages/CaseDetail/components/DroppableTaskGroup.tsx` | Droppable container | `List.DroppableGroup` |

### Duplicated Code Being Eliminated

**`caseColorClasses` array** - Currently copy-pasted in 5+ files:
- `SortableTaskRow.tsx:15-24`
- `CaseGroup.tsx:7-16`
- `TodayTaskList.tsx:10-19`
- `Calendar.tsx:17-26`
- `Dashboard.tsx:34-43`

**Row styling** - Repeated padding/hover/border patterns everywhere.

**Group headers** - 4+ different implementations of collapsible sections.

**Empty/Loading states** - Reimplemented in every list.

## New Component Design

### Directory Structure

```
components/common/
├── list/
│   ├── index.ts              # Barrel export
│   ├── List.tsx              # Main compound component
│   ├── ListContext.tsx       # Size/spacing context
│   ├── ListRow.tsx           # Base row component
│   ├── ListGroup.tsx         # Collapsible group
│   ├── ListDraggable.tsx     # Drag wrappers (draggable, sortable, droppable)
│   └── ListStates.tsx        # Empty, Loading components
│
├── CaseBadge.tsx             # Consolidated case color badge
└── caseColors.ts             # Single source for color mapping
```

### API Design

#### Basic List

```tsx
<List size="standard">
  <List.Body>
    {cases.map(c => (
      <List.Row key={c.id} onClick={() => navigate(`/cases/${c.id}`)}>
        <span className="font-medium flex-1">{c.case_name}</span>
        <StatusBadge status={c.status} />
      </List.Row>
    ))}
  </List.Body>
  {cases.length === 0 && <List.Empty message="No cases found" />}
</List>
```

#### Grouped List

```tsx
<List size="standard">
  {[4, 3, 2, 1].map(urgency => (
    <List.Group
      key={urgency}
      title={urgencyLabels[urgency]}
      count={tasks[urgency].length}
      color={urgencyColors[urgency]}
    >
      {tasks[urgency].map(task => (
        <List.Row key={task.id}>
          <TaskRowContent task={task} />
        </List.Row>
      ))}
    </List.Group>
  ))}
</List>
```

#### Draggable List

```tsx
<DndContext onDragEnd={handleDragEnd}>
  <List size="compact">
    <List.DroppableGroup id="today" title="Today">
      <SortableContext items={todayTasks.map(t => t.id)}>
        {todayTasks.map(task => (
          <List.SortableRow key={task.id} id={task.id}>
            <CaseBadge caseId={task.case_id} />
            <span className="flex-1">{task.description}</span>
          </List.SortableRow>
        ))}
      </SortableContext>
    </List.DroppableGroup>
  </List>
</DndContext>
```

### Size Variants

| Variant | Row Padding | Gap | Use Case |
|---------|-------------|-----|----------|
| `compact` | `px-3 py-2` | `gap-2` | Docket panel, OverviewTab, embedded lists |
| `standard` | `px-4 py-3` | `gap-3` | Main pages (Tasks, Calendar, Cases) |

Size is set on `<List>` and inherited via context.

### Props Reference

```tsx
// List - container
interface ListProps {
  size?: 'compact' | 'standard';
  className?: string;
  children: React.ReactNode;
}

// List.Row - basic row
interface ListRowProps {
  onClick?: () => void;
  highlight?: boolean;
  className?: string;
  children: React.ReactNode;
}

// List.Group - collapsible section
interface ListGroupProps {
  title: string;
  count?: number;
  color?: string;        // Tailwind color class
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

// List.DraggableRow - drag-only (no sorting)
interface ListDraggableRowProps {
  id: string | number;
  data?: Record<string, unknown>;
  children: React.ReactNode;
}

// List.SortableRow - sortable within container
interface ListSortableRowProps {
  id: string | number;
  disabled?: boolean;
  children: React.ReactNode;
}

// List.DroppableGroup - accepts drops
interface ListDroppableGroupProps {
  id: string;
  title: string;
  count?: number;
  children: React.ReactNode;
}
```

## Implementation Plan

### Phase 1: Build New Components

Build the new `List` system from scratch:

- [ ] Create `components/common/list/` directory
- [ ] Create `caseColors.ts` with shared color mapping
- [ ] Create `CaseBadge.tsx` component
- [ ] Create `ListContext.tsx` with size variants
- [ ] Create `List.tsx` main component with compound children
- [ ] Create `ListRow.tsx` with hover/active states
- [ ] Create `ListGroup.tsx` with collapsible header
- [ ] Create `ListStates.tsx` (Empty, Loading)
- [ ] Create `ListDraggable.tsx` (DraggableRow, SortableRow, DroppableGroup)
- [ ] Create barrel export `index.ts`

### Phase 2: Replace Page by Page

Replace existing lists with new components:

- [ ] **Cases.tsx** - Simple list, good first test
- [ ] **Calendar.tsx** - List with groups (overdue, today, etc.)
- [ ] **Dashboard.tsx** - Both tasks and events lists
- [ ] **Tasks.tsx** - Grouped + sortable (by urgency, date, case views)
- [ ] **TasksTab.tsx** - Case detail tasks with drag/sort
- [ ] **OverviewTab.tsx** - Compact embedded lists
- [ ] **DocketPanel.tsx** - Sortable sections

### Phase 3: Delete Old Code

Remove all replaced components:

- [ ] Delete `ListPanel.tsx`
- [ ] Delete `SortableTaskRow.tsx`
- [ ] Delete `DraggableTaskRow.tsx`
- [ ] Delete `UrgencyGroup.tsx`
- [ ] Delete `CaseGroup.tsx`
- [ ] Delete `DateGroup.tsx`
- [ ] Delete `TodayTaskList.tsx`
- [ ] Delete `DroppableTaskGroup.tsx`
- [ ] Remove duplicate `caseColorClasses` from all files
- [ ] Update barrel exports (`components/common/index.ts`, `components/tasks/index.ts`)

## Design Decisions

### Compound Components Pattern

Using the compound component pattern (like Radix UI, ShadCN) because:
- Flexible composition without prop explosion
- Parent manages shared state via context
- Children are semantically grouped

### Context for Size

Size is set once at `<List>` level and flows down via context. This avoids passing `size` to every row and keeps the API clean.

### Separate Content from Container

The `List.Row` handles layout (padding, hover, borders). Content inside is up to the consumer. This means we don't need separate `TaskRow`, `EventRow`, `CaseRow` - just different content inside `List.Row`.

### Drag Integration is Opt-In

`List.DraggableRow` and `List.SortableRow` are separate components. If you don't need drag, just use `List.Row`. No unnecessary dnd-kit overhead.

## References

- [Compound Components Pattern](https://www.patterns.dev/react/compound-pattern) - patterns.dev
- [Advanced React Component Composition](https://frontendmastery.com/posts/advanced-react-component-composition-guide/) - Frontend Mastery
- [ShadCN UI](https://ui.shadcn.com/) - Reference implementation
- [Radix UI](https://www.radix-ui.com/) - Accessible compound components

---

*Created: 2026-01-28*
