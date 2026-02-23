import { useState, useEffect, useCallback } from "react"
import { Link } from "react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  Add01Icon,
  Delete02Icon,
  DragDropIcon,
  FloppyDiskIcon,
  Cancel01Icon,
  Loading03Icon,
  AlertCircleIcon,
  PencilEdit01Icon,
} from "@hugeicons/core-free-icons"
import {
  getObjections,
  createObjection,
  updateObjection,
  deleteObjection,
  reorderObjections,
} from "@/services/templates"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { Objection } from "@/types/template"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

function toShortName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_")
}

interface EditingState {
  id: number | "new"
  name: string
  formal_language: string
  ai_notes: string
}

function SortableObjectionRow({
  objection,
  onEdit,
  onDelete,
}: {
  objection: Objection
  onEdit: (obj: Objection) => void
  onDelete: (id: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: objection.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-card group flex items-start gap-3 border p-3"
    >
      <button
        {...attributes}
        {...listeners}
        className="text-muted-foreground hover:text-foreground mt-1 shrink-0 cursor-grab p-1 active:cursor-grabbing"
      >
        <HugeiconsIcon icon={DragDropIcon} className="size-4" strokeWidth={2} />
      </button>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-sm font-medium">{objection.name}</span>
          <span className="bg-muted text-muted-foreground px-1.5 py-0.5 font-mono text-xs">
            {objection.short_name}
          </span>
        </div>
        <p className="text-muted-foreground line-clamp-2 text-xs">
          {objection.formal_language}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={() => onEdit(objection)}
          className="text-muted-foreground hover:text-foreground hover:bg-muted p-1.5 transition-colors"
          title="Edit"
        >
          <HugeiconsIcon
            icon={PencilEdit01Icon}
            className="size-3.5"
            strokeWidth={2}
          />
        </button>
        <button
          onClick={() => onDelete(objection.id)}
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 p-1.5 transition-colors"
          title="Delete"
        >
          <HugeiconsIcon
            icon={Delete02Icon}
            className="size-3.5"
            strokeWidth={2}
          />
        </button>
      </div>
    </div>
  )
}

export function ObjectionsPage() {
  const [objections, setObjections] = useState<Objection[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<EditingState | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const fetchObjections = useCallback(async () => {
    try {
      const data = await getObjections()
      setObjections(data)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load objections"
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchObjections()
  }, [fetchObjections])

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = objections.findIndex((o) => o.id === active.id)
      const newIndex = objections.findIndex((o) => o.id === over.id)
      const reordered = arrayMove(objections, oldIndex, newIndex)
      setObjections(reordered)

      try {
        await reorderObjections(reordered.map((o) => o.id))
      } catch {
        fetchObjections()
      }
    },
    [objections, fetchObjections]
  )

  const handleEdit = useCallback((obj: Objection) => {
    setEditing({
      id: obj.id,
      name: obj.name,
      formal_language: obj.formal_language,
      ai_notes: obj.ai_notes || "",
    })
  }, [])

  const handleNew = useCallback(() => {
    setEditing({
      id: "new",
      name: "",
      formal_language: "",
      ai_notes: "",
    })
  }, [])

  const handleSave = useCallback(async () => {
    if (!editing) return
    if (!editing.name.trim() || !editing.formal_language.trim()) {
      setError("Name and formal language are required")
      return
    }

    const short_name = toShortName(editing.name)
    if (!short_name) {
      setError("Name must contain at least one letter or number")
      return
    }

    setSaving(true)
    setError(null)
    try {
      if (editing.id === "new") {
        await createObjection({
          name: editing.name,
          short_name,
          formal_language: editing.formal_language,
          ai_notes: editing.ai_notes || undefined,
          position: objections.length,
        })
      } else {
        await updateObjection(editing.id, {
          name: editing.name,
          short_name,
          formal_language: editing.formal_language,
          ai_notes: editing.ai_notes || undefined,
        })
      }
      setEditing(null)
      fetchObjections()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save objection"
      )
    } finally {
      setSaving(false)
    }
  }, [editing, objections.length, fetchObjections])

  const handleDelete = useCallback(async (id: number) => {
    try {
      await deleteObjection(id)
      setObjections((prev) => prev.filter((o) => o.id !== id))
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete objection"
      )
    }
  }, [])

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Manage Objections
        </h1>
        <p className="text-muted-foreground text-sm">
          Legal objections for RFP responses
        </p>
      </div>

      <div className="mx-auto w-full max-w-3xl space-y-3">
        {/* Back link + Add button */}
        <div className="flex items-center justify-between">
          <Link
            to="/templates/rfp"
            className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
          >
            <HugeiconsIcon
              icon={ArrowLeft01Icon}
              className="size-4"
              strokeWidth={2}
            />
            Back to RFP
          </Link>
          <Button size="sm" onClick={handleNew}>
            <HugeiconsIcon
              icon={Add01Icon}
              className="size-4"
              strokeWidth={2}
            />
            Add Objection
          </Button>
        </div>

        {error && (
          <div className="bg-destructive/10 border-destructive/20 flex items-center gap-2 border p-3 text-sm">
            <HugeiconsIcon
              icon={AlertCircleIcon}
              className="text-destructive size-4 shrink-0"
              strokeWidth={2}
            />
            <span className="text-destructive">{error}</span>
          </div>
        )}

        {/* Edit form */}
        {editing && (
          <div className="border-primary/30 space-y-3 border p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                {editing.id === "new" ? "New Objection" : "Edit Objection"}
              </h3>
              <button
                onClick={() => setEditing(null)}
                className="text-muted-foreground hover:bg-muted p-1"
              >
                <HugeiconsIcon
                  icon={Cancel01Icon}
                  className="size-4"
                  strokeWidth={2}
                />
              </button>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input
                value={editing.name}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
                placeholder="Vague and Ambiguous"
              />
              {editing.name.trim() && (
                <p className="text-muted-foreground font-mono text-xs">
                  ID: {toShortName(editing.name)}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Formal Language</Label>
              <Textarea
                value={editing.formal_language}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    formal_language: e.target.value,
                  })
                }
                rows={3}
                className="resize-none"
                placeholder="Responding Party objects to this request on the grounds that..."
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">AI Guidance Notes</Label>
              <Textarea
                value={editing.ai_notes}
                onChange={(e) =>
                  setEditing({ ...editing, ai_notes: e.target.value })
                }
                rows={2}
                className="resize-none"
                placeholder="When to apply: broad time ranges, 'all documents' language, no date limits. When NOT to apply: narrowly scoped requests with specific date ranges."
              />
              <p className="text-muted-foreground text-xs">
                These notes help the AI decide when to apply this objection
                during analysis.
              </p>
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <HugeiconsIcon
                    icon={Loading03Icon}
                    className="size-4 animate-spin"
                    strokeWidth={2}
                  />
                ) : (
                  <HugeiconsIcon
                    icon={FloppyDiskIcon}
                    className="size-4"
                    strokeWidth={2}
                  />
                )}
                Save
              </Button>
            </div>
          </div>
        )}

        {/* Objection list */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : objections.length === 0 ? (
          <div className="text-muted-foreground py-12 text-center text-sm">
            No objections yet. Click "Add Objection" to create one.
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={objections.map((o) => o.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1.5">
                {objections.map((obj) => (
                  <SortableObjectionRow
                    key={obj.id}
                    objection={obj}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  )
}
