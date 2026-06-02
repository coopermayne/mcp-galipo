import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  DragDropIcon,
  Cancel01Icon,
  Add01Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons"
import type { CasePerson, RepresentationLayout, RepresentationRow } from "@/types/case"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ROLE_COLORS } from "@/components/common/person-tree"
import { getBadgeStyle } from "@/lib/badge-colors"
import { useRepresentationLayoutMutation } from "@/hooks/use-representation-layout"

type Column = "parties" | "attorneys" | "experts"
type Family = Column | "other"

const COLUMNS: { key: Column; label: string }[] = [
  { key: "parties", label: "Parties" },
  { key: "attorneys", label: "Counsel" },
  { key: "experts", label: "Experts" },
]

const FAMILY_LABELS: Record<Family, string> = {
  parties: "Parties",
  attorneys: "Counsel",
  experts: "Experts",
  other: "Other",
}

function familyOf(person: CasePerson): Family {
  switch (person.role.category) {
    case "client":
    case "defendant":
      return "parties"
    case "counsel":
    case "mediator":
      return "attorneys"
    case "expert":
      return "experts"
    default:
      return "other"
  }
}

function formatRoleName(name: string): string {
  return name
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

function newRow(): RepresentationRow {
  return { id: crypto.randomUUID(), parties: [], attorneys: [], experts: [] }
}

interface DragData {
  personId: number
  fromRowId: string | null // null = unassigned tray
  fromColumn: Column | null
}

interface DropData {
  rowId: string | null // null = tray
  column: Column | null
  isTray: boolean
}

/** Name + role badge, optionally with subordinates rendered inline beneath. */
function PersonChipContent({
  person,
  subordinates,
  isOverlay,
}: {
  person: CasePerson
  subordinates?: CasePerson[]
  isOverlay?: boolean
}) {
  return (
    <div className={isOverlay ? "bg-background border px-2 py-1 shadow-md" : ""}>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-sm font-medium truncate">{person.name}</span>
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 shrink-0 font-normal border-transparent"
          style={getBadgeStyle(ROLE_COLORS[person.role.name])}
        >
          {formatRoleName(person.role.name)}
        </Badge>
      </div>
      {subordinates && subordinates.length > 0 && (
        <div className="mt-0.5 ml-2 border-l border-border pl-2 space-y-0.5">
          {subordinates.map((sub) => (
            <div key={sub.id} className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs text-muted-foreground truncate">{sub.name}</span>
              <span className="text-[10px] text-muted-foreground/70 shrink-0">
                {formatRoleName(sub.role.name)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** A draggable person chip placed in a cell or the tray. */
function PersonChip({
  person,
  subordinates,
  fromRowId,
  fromColumn,
  onRemove,
}: {
  person: CasePerson
  subordinates: CasePerson[]
  fromRowId: string | null
  fromColumn: Column | null
  onRemove?: () => void
}) {
  const dragId = `drag:${fromRowId ?? "tray"}:${fromColumn ?? "tray"}:${person.id}`
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
    data: { personId: person.id, fromRowId, fromColumn } satisfies DragData,
  })

  return (
    <div
      ref={setNodeRef}
      className={`group/chip flex items-start gap-1 border bg-card px-1.5 py-1 ${
        isDragging ? "opacity-30" : ""
      }`}
    >
      <button
        type="button"
        className="mt-0.5 text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0 touch-none"
        {...listeners}
        {...attributes}
      >
        <HugeiconsIcon icon={DragDropIcon} className="size-3.5" />
      </button>
      <div className="flex-1 min-w-0">
        <PersonChipContent person={person} subordinates={subordinates} />
      </div>
      {onRemove && (
        <button
          type="button"
          className="mt-0.5 text-muted-foreground/30 hover:text-destructive shrink-0 opacity-0 group-hover/chip:opacity-100 transition-opacity"
          onClick={onRemove}
        >
          <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
        </button>
      )}
    </div>
  )
}

/** A single droppable column cell within a row. */
function ColumnCell({
  rowId,
  column,
  children,
  empty,
}: {
  rowId: string
  column: Column
  children: React.ReactNode
  empty: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop:${rowId}:${column}`,
    data: { rowId, column, isTray: false } satisfies DropData,
  })
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-1 border p-1.5 min-h-16 transition-colors ${
        isOver ? "border-foreground bg-accent" : "border-border/60"
      }`}
    >
      {empty ? (
        <span className="text-[10px] text-muted-foreground/50 m-auto">Drop here</span>
      ) : (
        children
      )}
    </div>
  )
}

/** The unassigned tray — a droppable that removes a person from all rows. */
function UnassignedTray({
  children,
  empty,
}: {
  children: React.ReactNode
  empty: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: "drop:tray",
    data: { rowId: null, column: null, isTray: true } satisfies DropData,
  })
  return (
    <div
      ref={setNodeRef}
      className={`border border-dashed p-2 transition-colors ${
        isOver ? "border-foreground bg-accent" : "border-border"
      }`}
    >
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
        Unassigned
      </div>
      {empty ? (
        <span className="text-xs text-muted-foreground/60">
          Everyone is placed. Drag a chip here to unassign.
        </span>
      ) : (
        children
      )}
    </div>
  )
}

interface RepresentationOrganizerProps {
  caseId: number
  casePersons: CasePerson[]
  initialLayout: RepresentationLayout | null
}

export function RepresentationOrganizer({
  caseId,
  casePersons,
  initialLayout,
}: RepresentationOrganizerProps) {
  // Lead people (no grouped_under_id), deduped by person id — these are the
  // draggable units. Subordinates render inline under their lead.
  const { leadsById, subordinatesByLead } = useMemo(() => {
    const leads = new Map<number, CasePerson>()
    const subs = new Map<number, CasePerson[]>()
    for (const p of casePersons) {
      if (p.grouped_under_id == null) {
        if (!leads.has(p.id)) leads.set(p.id, p)
      } else {
        const arr = subs.get(p.grouped_under_id) ?? []
        arr.push(p)
        subs.set(p.grouped_under_id, arr)
      }
    }
    return { leadsById: leads, subordinatesByLead: subs }
  }, [casePersons])

  // Drop any stored id that's no longer a valid lead on this case.
  const normalize = useCallback(
    (raw: RepresentationLayout | null): RepresentationLayout => {
      const rows = (raw?.rows ?? []).map((r) => ({
        id: r.id,
        parties: (r.parties ?? []).filter((id) => leadsById.has(id)),
        attorneys: (r.attorneys ?? []).filter((id) => leadsById.has(id)),
        experts: (r.experts ?? []).filter((id) => leadsById.has(id)),
      }))
      return { rows }
    },
    [leadsById]
  )

  const [layout, setLayout] = useState<RepresentationLayout>(() => normalize(initialLayout))
  const [activeId, setActiveId] = useState<number | null>(null)
  const altRef = useRef(false)

  // Re-initialize when navigating to a different case.
  useEffect(() => {
    setLayout(normalize(initialLayout))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId])

  // Track Alt/Option to distinguish clone (experts) from move during a drag.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      altRef.current = e.altKey
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("keyup", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("keyup", onKey)
    }
  }, [])

  const save = useRepresentationLayoutMutation(caseId)
  const commit = useCallback(
    (next: RepresentationLayout) => {
      setLayout(next)
      save.mutate(next)
    },
    [save]
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const placedIds = useMemo(() => {
    const set = new Set<number>()
    for (const r of layout.rows) {
      for (const id of r.parties) set.add(id)
      for (const id of r.attorneys) set.add(id)
      for (const id of r.experts) set.add(id)
    }
    return set
  }, [layout])

  // Unplaced leads, grouped by their natural role family for findability.
  const trayGroups = useMemo(() => {
    const groups: Record<Family, CasePerson[]> = {
      parties: [],
      attorneys: [],
      experts: [],
      other: [],
    }
    for (const [id, person] of leadsById) {
      if (!placedIds.has(id)) groups[familyOf(person)].push(person)
    }
    return groups
  }, [leadsById, placedIds])

  const trayEmpty = useMemo(
    () => (Object.values(trayGroups) as CasePerson[][]).every((g) => g.length === 0),
    [trayGroups]
  )

  const activePerson = activeId != null ? leadsById.get(activeId) ?? null : null

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as DragData | undefined
    if (data) setActiveId(data.personId)
    const activator = event.activatorEvent as { altKey?: boolean }
    if (activator?.altKey) altRef.current = true
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    const alt = altRef.current
    altRef.current = false
    if (!over) return

    const from = active.data.current as DragData
    const to = over.data.current as DropData

    // Dropped on the tray → remove from its source cell only.
    if (to.isTray) {
      if (from.fromRowId == null || from.fromColumn == null) return
      commit(removeFromCell(layout, from.fromRowId, from.fromColumn, from.personId))
      return
    }

    if (to.rowId == null || to.column == null) return

    // No-op if dropped back into the same cell.
    if (from.fromRowId === to.rowId && from.fromColumn === to.column) return

    // Clone only when targeting the experts column (shared experts). Any other
    // column is always a move, even with Alt held.
    const isClone = alt && to.column === "experts"

    let next = layout
    if (!isClone) {
      // Move: remove the person from every cell first, then place at target.
      next = removeEverywhere(next, from.personId)
    }
    next = addToCell(next, to.rowId, to.column, from.personId)
    commit(next)
  }

  function handleAddRow() {
    commit({ rows: [...layout.rows, newRow()] })
  }

  function handleDeleteRow(rowId: string) {
    commit({ rows: layout.rows.filter((r) => r.id !== rowId) })
  }

  function handleRemoveChip(rowId: string, column: Column, personId: number) {
    commit(removeFromCell(layout, rowId, column, personId))
  }

  if (leadsById.size === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Add people to this case to organize their representation.
      </p>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col gap-3">
        <UnassignedTray empty={trayEmpty}>
          <div className="flex flex-col gap-2">
            {(Object.keys(trayGroups) as Family[]).map((fam) =>
              trayGroups[fam].length > 0 ? (
                <div key={fam}>
                  <div className="text-[10px] text-muted-foreground/70 mb-1">
                    {FAMILY_LABELS[fam]}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {trayGroups[fam].map((person) => (
                      <PersonChip
                        key={person.id}
                        person={person}
                        subordinates={subordinatesByLead.get(person.id) ?? []}
                        fromRowId={null}
                        fromColumn={null}
                      />
                    ))}
                  </div>
                </div>
              ) : null
            )}
          </div>
        </UnassignedTray>

        {layout.rows.map((row, idx) => (
          <div key={row.id} className="border">
            <div className="flex items-center justify-between border-b bg-muted/30 px-2 py-1">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Row {idx + 1}
              </span>
              <button
                type="button"
                className="text-muted-foreground/40 hover:text-destructive"
                onClick={() => handleDeleteRow(row.id)}
                title="Delete row"
              >
                <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5 p-1.5">
              {COLUMNS.map(({ key, label }) => {
                const ids = row[key]
                return (
                  <div key={key} className="flex flex-col gap-1">
                    <div className="text-[10px] text-muted-foreground/70">{label}</div>
                    <ColumnCell rowId={row.id} column={key} empty={ids.length === 0}>
                      {ids.map((id) => {
                        const person = leadsById.get(id)
                        if (!person) return null
                        return (
                          <PersonChip
                            key={`${row.id}:${key}:${id}`}
                            person={person}
                            subordinates={subordinatesByLead.get(id) ?? []}
                            fromRowId={row.id}
                            fromColumn={key}
                            onRemove={() => handleRemoveChip(row.id, key, id)}
                          />
                        )
                      })}
                    </ColumnCell>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={handleAddRow}>
            <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
            Add row
          </Button>
          <span className="text-[10px] text-muted-foreground/60">
            Hold {altLabel()} while dragging an expert to share across rows
          </span>
        </div>
      </div>

      <DragOverlay>
        {activePerson ? <PersonChipContent person={activePerson} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  )
}

function altLabel() {
  if (typeof navigator !== "undefined" && /Mac/i.test(navigator.platform)) return "⌥ Option"
  return "Alt"
}

// --- pure layout transforms -------------------------------------------------

function removeFromCell(
  layout: RepresentationLayout,
  rowId: string,
  column: Column,
  personId: number
): RepresentationLayout {
  return {
    rows: layout.rows.map((r) =>
      r.id === rowId ? { ...r, [column]: r[column].filter((id) => id !== personId) } : r
    ),
  }
}

function removeEverywhere(
  layout: RepresentationLayout,
  personId: number
): RepresentationLayout {
  return {
    rows: layout.rows.map((r) => ({
      ...r,
      parties: r.parties.filter((id) => id !== personId),
      attorneys: r.attorneys.filter((id) => id !== personId),
      experts: r.experts.filter((id) => id !== personId),
    })),
  }
}

function addToCell(
  layout: RepresentationLayout,
  rowId: string,
  column: Column,
  personId: number
): RepresentationLayout {
  return {
    rows: layout.rows.map((r) =>
      r.id === rowId && !r[column].includes(personId)
        ? { ...r, [column]: [...r[column], personId] }
        : r
    ),
  }
}
