# Global Day Planner (Trello-style Kanban)

## Overview
Add a global Trello-style kanban board as a slide-over panel. All 4 status columns (To Do, In Progress, Blocked, Done) are always visible. Users can add tasks from anywhere or create new ones directly in the planner. Drag cards between columns to change status.

## Visual Design

### Slide-over Panel (right side, ~80% width)
```
┌────────────────────────────────────────────────────────────────────────┐
│ ✕  Today's Planner                                      Cmd+Shift+P   │
├───────────────┬───────────────┬───────────────┬────────────────────────┤
│ To Do         │ In Progress   │ Blocked       │ Done                   │
│ ···           │ ···           │ ···           │ ···                    │
├───────────────┼───────────────┼───────────────┼────────────────────────┤
│ ┌───────────┐ │ ┌───────────┐ │ ┌───────────┐ │ ┌──────────────────┐   │
│ │ ▬▬ ▬▬     │ │ │ ▬▬        │ │ │ ▬▬        │ │ │ ✓ Task title     │   │
│ │ Task title │ │ │ Task title│ │ │ Task title│ │ │ ⏱ Jan 15, 2025   │   │
│ │ Case name  │ │ │ Case name │ │ │           │ │ │ Case name        │   │
│ └───────────┘ │ └───────────┘ │ └───────────┘ │ └──────────────────┘   │
│ ┌───────────┐ │ ┌───────────┐ │               │ ┌──────────────────┐   │
│ │ Task title │ │ │ Task title│ │               │ │ ✓ Task title     │   │
│ │ Due: Today │ │ │           │ │               │ │ ⏱ Jan 14, 2025   │   │
│ └───────────┘ │ └───────────┘ │               │ └──────────────────┘   │
│               │               │               │                        │
│ + Add a card  │ + Add a card  │ + Add a card  │ + Add a card           │
└───────────────┴───────────────┴───────────────┴────────────────────────┘
```

### Card Design
- White background with subtle shadow
- Optional: colored label bar(s) at top (for urgency or category)
- Task title (main text)
- Case name badge (small, muted)
- Due date if set
- Done cards: green checkmark + completion date

### Header
- Column title + count
- Menu (...) for bulk actions (clear all, etc.)

## Behavior

1. **Open/Close**: Header icon OR Cmd+Shift+P keyboard shortcut
2. **Drag & Drop**: Drag cards between any columns → status updates
3. **Add Card**: Click "+ Add a card" → inline input for quick task creation
4. **Done Cleanup**: Tasks in Done older than 24h auto-remove from planner
5. **Click Card**: Opens task detail sheet (existing component)

## Database Changes

**Add to `tasks` table:**
```sql
ALTER TABLE tasks ADD COLUMN in_planner BOOLEAN DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN planner_added_at TIMESTAMPTZ;
```

## Implementation

### 1. Database Migration
**File**: `migrations/NNNN_add_planner_columns.sql`

```sql
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS in_planner BOOLEAN DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS planner_added_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_tasks_in_planner ON tasks(in_planner) WHERE in_planner = TRUE;
```

### 2. Backend
**File**: `db/tasks.py`
- `get_planner_tasks()` - returns tasks where in_planner=True, filtering Done > 24h
- `add_to_planner(task_id)` - sets in_planner=True, planner_added_at=now
- `remove_from_planner(task_id)` - sets in_planner=False

**File**: `routes/tasks.py`
```python
@router.get("/tasks/planner")
@router.post("/tasks/{task_id}/planner")  # toggle in_planner
```

### 3. Frontend Types
**File**: `frontend/src/types/task.ts`
```typescript
interface Task {
  // ... existing fields
  in_planner?: boolean;
  planner_added_at?: string;
}
```

### 4. API Functions
**File**: `frontend/src/api/tasks.ts`
```typescript
export const getPlannerTasks = () => api.get('/tasks/planner');
export const togglePlanner = (taskId: number, inPlanner: boolean) =>
  api.post(`/tasks/${taskId}/planner`, { in_planner: inPlanner });
```

### 5. Planner Context
**File**: `frontend/src/context/PlannerContext.tsx`
```typescript
const PlannerContext = createContext<{
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}>();
```

### 6. KanbanBoard Component
**File**: `frontend/src/components/planner/KanbanBoard.tsx`

```typescript
const COLUMNS = [
  { id: 'Pending', label: 'To Do' },
  { id: 'Active', label: 'In Progress' },
  { id: 'Blocked', label: 'Blocked' },
  { id: 'Done', label: 'Done' },
] as const;
```

- Horizontal flexbox: `flex gap-4`
- Each column: `flex-1 min-w-[200px]`
- `DndContext` wrapping for cross-column drag
- On drag end → update task status

### 7. KanbanColumn Component
**File**: `frontend/src/components/planner/KanbanColumn.tsx`

```typescript
interface KanbanColumnProps {
  status: TaskStatus;
  label: string;
  tasks: Task[];
  onAddCard: (title: string) => void;
}
```

- Header with title, count, menu
- Droppable area (SortableContext)
- Scrollable task list
- "+ Add a card" button at bottom → inline input

### 8. PlannerCard Component
**File**: `frontend/src/components/planner/PlannerCard.tsx`

- Draggable via @dnd-kit
- Shows: title, case badge, due date
- Click → opens TaskDetailSheet
- Hover → show remove (X) button

### 9. PlannerPanel Component
**File**: `frontend/src/components/planner/PlannerPanel.tsx`

- Slide-in from right (80% width, or fixed ~900px)
- Header: title, close button, keyboard hint
- Contains KanbanBoard
- Backdrop click to close
- Animation: slide + fade

### 10. Header Integration
**File**: `frontend/src/components/layout/Header.tsx` (or AppLayout)

```tsx
<button onClick={planner.toggle}>
  <LayoutGrid className="w-5 h-5" />
</button>
```

### 11. "Add to Planner" on Tasks
**File**: `frontend/src/components/lab/TaskItem.tsx`

Add to hover actions:
```tsx
<button onClick={() => togglePlanner(task.id, !task.in_planner)}>
  {task.in_planner ? <Minus /> : <Plus />}
</button>
```

### 12. Keyboard Shortcut
**File**: `frontend/src/App.tsx`

```typescript
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'p') {
      e.preventDefault();
      planner.toggle();
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, []);
```

## Files Summary

| File | Action |
|------|--------|
| `migrations/NNNN_add_planner_columns.sql` | NEW |
| `db/tasks.py` | Add planner functions |
| `routes/tasks.py` | Add planner endpoints |
| `frontend/src/types/task.ts` | Add in_planner fields |
| `frontend/src/api/tasks.ts` | Add planner API calls |
| `frontend/src/context/PlannerContext.tsx` | NEW |
| `frontend/src/components/planner/KanbanBoard.tsx` | NEW |
| `frontend/src/components/planner/KanbanColumn.tsx` | NEW |
| `frontend/src/components/planner/PlannerCard.tsx` | NEW |
| `frontend/src/components/planner/PlannerPanel.tsx` | NEW |
| `frontend/src/components/planner/index.ts` | NEW |
| `frontend/src/components/lab/TaskItem.tsx` | Add "Add to Planner" |
| `frontend/src/App.tsx` | Add PlannerProvider, keyboard shortcut |
| Header component | Add planner icon |

## Verification

1. **Migration**: Run backend, verify in_planner column exists
2. **Add to Planner**: In Lab, hover task → click + → task gets in_planner=true
3. **Open Panel**: Click header icon → panel slides in from right
4. **Keyboard**: Press Cmd+Shift+P → panel toggles
5. **View Board**: See 4 columns with tasks grouped by status
6. **Drag**: Drag card from To Do to In Progress → status updates
7. **Add Card**: Click "+ Add a card" in any column → type title → creates task
8. **Click Card**: Click a card → TaskDetailSheet opens
9. **Remove**: Hover card, click X → removed from planner (task still exists)
10. **Auto-cleanup**: Mark Done, verify removed after 24h (test with short interval)
11. **Sync**: Changes in planner reflect in Lab and vice versa
