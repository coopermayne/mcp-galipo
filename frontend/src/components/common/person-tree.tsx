import { useMemo, useState, useId } from "react"
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
import type { CasePerson } from "@/types/case"
import { Badge } from "@/components/ui/badge"
import { HugeiconsIcon } from "@hugeicons/react"
import { Mail01Icon, SmartPhone01Icon, DragDropIcon } from "@hugeicons/core-free-icons"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getBadgeStyle } from "@/lib/badge-colors"

/** Map role names to colors from the badge-colors palette. */
const ROLE_COLORS: Record<string, string> = {
  // Counsel
  co_counsel: "green",
  referring_attorney: "teal",
  opposing_counsel: "red",
  defense_counsel: "orange",
  // Mediator
  mediator: "amber",
  // Client
  plaintiff: "blue",
  contact: "cyan",
  guardian_ad_litem: "indigo",
  decedent: "purple",
  // Defendant
  municipality_defendant: "orange",
  individual_defendant: "pink",
  // Expert
  plaintiff_expert: "emerald",
  defense_expert: "fuchsia",
  // Other
  lien_holder: "sky",
  witness: "lime",
  claims_adjuster: "yellow",
}

interface PersonTreeProps {
  persons: CasePerson[]
  onNest?: (assignmentId: number, groupedUnderId: number | null) => void
  onPersonClick?: (person: CasePerson) => void
}

interface TreeNode {
  person: CasePerson
  children: TreeNode[]
}

function buildTree(persons: CasePerson[]): TreeNode[] {
  const byAssignment = new Map<number, TreeNode>()
  const byPersonId = new Map<number, TreeNode>()
  const roots: TreeNode[] = []

  for (const p of persons) {
    const node = { person: p, children: [] as TreeNode[] }
    byAssignment.set(p.assignment_id, node)
    byPersonId.set(p.id, node)
  }
  for (const p of persons) {
    const node = byAssignment.get(p.assignment_id)!
    const parent = p.grouped_under_id ? byPersonId.get(p.grouped_under_id) : undefined
    if (parent) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

function formatRoleName(name: string): string {
  return name
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

function PersonNodeContent({ person, isDragOverlay, onClick }: { person: CasePerson; isDragOverlay?: boolean; onClick?: (person: CasePerson) => void }) {
  const hasPhone = Array.isArray(person.phones) && person.phones.length > 0
  const hasEmail = Array.isArray(person.emails) && person.emails.length > 0
  const badgeStyle = getBadgeStyle(ROLE_COLORS[person.role.name])

  return (
    <div
      className={`flex items-center gap-2 py-1 text-sm group/person ${isDragOverlay ? "bg-background shadow-md px-2" : ""} ${onClick ? "cursor-pointer hover:bg-accent/50 transition-colors" : ""}`}
      onClick={onClick ? () => onClick(person) : undefined}
    >
      <span className="font-medium truncate">{person.name}</span>
      <Badge
        variant="outline"
        className="text-[10px] px-1.5 py-0 shrink-0 font-normal border-transparent"
        style={badgeStyle}
      >
        {formatRoleName(person.role.name)}
      </Badge>
      {person.organization && (
        <span className="text-xs text-muted-foreground truncate hidden sm:inline">
          {person.organization}
        </span>
      )}
      {!isDragOverlay && (
        <div className="flex items-center gap-1 ml-auto shrink-0 opacity-0 group-hover/person:opacity-100 transition-opacity">
          {hasEmail && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground">
                  <HugeiconsIcon icon={Mail01Icon} className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {(person.emails as { address: string }[]).map((e) => e.address).join(", ")}
              </TooltipContent>
            </Tooltip>
          )}
          {hasPhone && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground">
                  <HugeiconsIcon icon={SmartPhone01Icon} className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {(person.phones as { number: string }[]).map((ph) => ph.number).join(", ")}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      )}
    </div>
  )
}

/** A root-level person: can be a drop target (to nest children under it). */
function DraggableRootNode({
  node,
  prefix,
  onPersonClick,
}: {
  node: TreeNode
  prefix: string
  onPersonClick?: (person: CasePerson) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: `${prefix}-drag-${node.person.assignment_id}`,
    data: { assignmentId: node.person.assignment_id },
  })

  const {
    setNodeRef: setDropRef,
    isOver,
  } = useDroppable({
    id: `${prefix}-drop-${node.person.assignment_id}`,
    data: { assignmentId: node.person.assignment_id, isRoot: true },
  })

  return (
    <div
      ref={(el) => {
        setDragRef(el)
        setDropRef(el)
      }}
      className={`${isDragging ? "opacity-30" : ""} ${isOver ? "bg-accent" : ""} transition-colors`}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0 touch-none"
          {...listeners}
          {...attributes}
        >
          <HugeiconsIcon icon={DragDropIcon} className="size-3.5" />
        </button>
        <div className="flex-1 min-w-0">
          <PersonNodeContent person={node.person} onClick={onPersonClick} />
        </div>
      </div>
      {node.children.length > 0 && (
        <div className="ml-3 border-l border-border pl-3">
          {node.children.map((child) => (
            <DraggableChildNode
              key={child.person.assignment_id}
              node={child}
              prefix={prefix}
              onPersonClick={onPersonClick}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** A child-level person: draggable but NOT a drop target (one level only). */
function DraggableChildNode({
  node,
  prefix,
  onPersonClick,
}: {
  node: TreeNode
  prefix: string
  onPersonClick?: (person: CasePerson) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useDraggable({
    id: `${prefix}-drag-${node.person.assignment_id}`,
    data: { assignmentId: node.person.assignment_id },
  })

  return (
    <div ref={setNodeRef} className={isDragging ? "opacity-30" : ""}>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0 touch-none"
          {...listeners}
          {...attributes}
        >
          <HugeiconsIcon icon={DragDropIcon} className="size-3.5" />
        </button>
        <div className="flex-1 min-w-0">
          <PersonNodeContent person={node.person} onClick={onPersonClick} />
        </div>
      </div>
    </div>
  )
}

function StaticPersonNode({ node, onPersonClick }: { node: TreeNode; onPersonClick?: (person: CasePerson) => void }) {
  return (
    <div>
      <PersonNodeContent person={node.person} onClick={onPersonClick} />
      {node.children.length > 0 && (
        <div className="ml-3 border-l border-border pl-3">
          {node.children.map((child) => (
            <StaticPersonNode key={child.person.assignment_id} node={child} onPersonClick={onPersonClick} />
          ))}
        </div>
      )}
    </div>
  )
}

/** Root-level drop zone to un-nest a person (move to top level). */
function RootDropZone({ isVisible, prefix }: { isVisible: boolean; prefix: string }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${prefix}-drop-root`,
    data: { assignmentId: null },
  })

  if (!isVisible) return null

  return (
    <div
      ref={setNodeRef}
      className={`h-6 border border-dashed flex items-center justify-center text-[10px] text-muted-foreground transition-colors ${
        isOver ? "border-foreground bg-accent text-foreground" : "border-muted-foreground/30"
      }`}
    >
      Drop here to un-nest
    </div>
  )
}

export function PersonTree({ persons, onNest, onPersonClick }: PersonTreeProps) {
  const tree = useMemo(() => buildTree(persons), [persons])
  const [activeId, setActiveId] = useState<number | null>(null)
  const prefix = useId()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  )

  const activePerson = useMemo(() => {
    if (activeId == null) return null
    return persons.find((p) => p.assignment_id === activeId) ?? null
  }, [activeId, persons])

  if (tree.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-1">No persons assigned.</p>
    )
  }

  // If no onNest callback, render static (no drag-and-drop)
  if (!onNest) {
    return (
      <div className="space-y-0.5">
        {tree.map((node) => (
          <StaticPersonNode key={node.person.assignment_id} node={node} onPersonClick={onPersonClick} />
        ))}
      </div>
    )
  }

  function handleDragStart(event: DragStartEvent) {
    const id = event.active.data.current?.assignmentId as number
    setActiveId(id)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over || !onNest) return

    const draggedId = active.data.current?.assignmentId as number
    const targetId = over.data.current?.assignmentId as number | null

    // Don't nest under self
    if (draggedId === targetId) return

    // Only allow dropping on root-level persons or the root zone
    if (targetId !== null && !over.data.current?.isRoot) return

    // Don't nest if already under this parent
    const dragged = persons.find((p) => p.assignment_id === draggedId)
    if (!dragged) return
    if (targetId === null && !dragged.grouped_under_id) return
    const target = targetId !== null ? persons.find((p) => p.assignment_id === targetId) : null
    if (target && target.id === dragged.grouped_under_id) return

    // Don't allow nesting a parent that has children (would create multi-level)
    if (targetId !== null) {
      const draggedNode = tree.find((n) => n.person.assignment_id === draggedId)
      if (draggedNode && draggedNode.children.length > 0) return
    }

    onNest(draggedId, targetId)
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-0.5">
        {tree.map((node) => (
          <DraggableRootNode
            key={node.person.assignment_id}
            node={node}
            prefix={prefix}
            onPersonClick={onPersonClick}
          />
        ))}
        <RootDropZone isVisible={activeId != null} prefix={prefix} />
      </div>
      <DragOverlay>
        {activePerson ? (
          <PersonNodeContent person={activePerson} isDragOverlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
