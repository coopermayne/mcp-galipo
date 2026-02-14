import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, Trash2, GripVertical, Save, X, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Header, PageContent } from '../../components/layout';
import { getObjections, createObjection, updateObjection, deleteObjection, reorderObjections } from '../../api/objections';
import type { Objection } from '../../types/rfp';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function toShortName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

interface EditingState {
  id: number | 'new';
  name: string;
  formal_language: string;
}

function SortableObjectionRow({
  objection,
  onEdit,
  onDelete,
}: {
  objection: Objection;
  onEdit: (obj: Objection) => void;
  onDelete: (id: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: objection.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-3 p-3 bg-bg-surface border border-border rounded-lg group"
    >
      <button
        {...attributes}
        {...listeners}
        className="mt-1 p-1 text-text-muted hover:text-text cursor-grab active:cursor-grabbing flex-shrink-0"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-text">{objection.name}</span>
          <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-bg-hover text-text-muted">
            {objection.short_name}
          </span>
        </div>
        <p className="text-xs text-text-muted line-clamp-2">{objection.formal_language}</p>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(objection)}
          className="p-1.5 rounded hover:bg-bg-hover text-text-muted hover:text-text transition-colors"
          title="Edit"
        >
          <Save className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onDelete(objection.id)}
          className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-text-muted hover:text-red-600 dark:hover:text-red-400 transition-colors"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function ObjectionsManager() {
  const [objections, setObjections] = useState<Objection[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const fetchObjections = useCallback(async () => {
    try {
      const data = await getObjections();
      setObjections(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load objections');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchObjections();
  }, [fetchObjections]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = objections.findIndex(o => o.id === active.id);
    const newIndex = objections.findIndex(o => o.id === over.id);
    const reordered = arrayMove(objections, oldIndex, newIndex);
    setObjections(reordered);

    try {
      await reorderObjections(reordered.map(o => o.id));
    } catch {
      // Revert on error
      fetchObjections();
    }
  }, [objections, fetchObjections]);

  const handleEdit = useCallback((obj: Objection) => {
    setEditing({
      id: obj.id,
      name: obj.name,
      formal_language: obj.formal_language,
    });
  }, []);

  const handleNew = useCallback(() => {
    setEditing({
      id: 'new',
      name: '',
      formal_language: '',
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!editing) return;
    if (!editing.name.trim() || !editing.formal_language.trim()) {
      setError('Name and formal language are required');
      return;
    }

    const short_name = toShortName(editing.name);
    if (!short_name) {
      setError('Name must contain at least one letter or number');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (editing.id === 'new') {
        await createObjection({
          name: editing.name,
          short_name,
          formal_language: editing.formal_language,
          position: objections.length,
        });
      } else {
        await updateObjection(editing.id, {
          name: editing.name,
          short_name,
          formal_language: editing.formal_language,
        });
      }
      setEditing(null);
      fetchObjections();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save objection');
    } finally {
      setSaving(false);
    }
  }, [editing, objections.length, fetchObjections]);

  const handleDelete = useCallback(async (id: number) => {
    try {
      await deleteObjection(id);
      setObjections(prev => prev.filter(o => o.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete objection');
    }
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-bg-base">
      <Header title="Manage Objections" subtitle="Legal objections for RFP responses" />

      <PageContent variant="full" className="space-y-3 scrollbar-hide">
        {/* Back link + Add button */}
        <div className="flex items-center justify-between">
          <Link
            to="/templates/rfp"
            className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to RFP
          </Link>
          <button
            onClick={handleNew}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-primary-600 hover:bg-primary-700 text-white transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Objection
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Edit form */}
        {editing && (
          <div className="bg-bg-surface border border-primary-300 dark:border-primary-700 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text">
                {editing.id === 'new' ? 'New Objection' : 'Edit Objection'}
              </h3>
              <button onClick={() => setEditing(null)} className="p-1 rounded hover:bg-bg-hover text-text-muted">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">Name</label>
              <input
                type="text"
                value={editing.name}
                onChange={e => setEditing({ ...editing, name: e.target.value })}
                className="w-full px-2.5 py-1.5 bg-bg border border-border rounded text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                placeholder="Vague and Ambiguous"
              />
              {editing.name.trim() && (
                <p className="text-xs text-text-muted font-mono">ID: {toShortName(editing.name)}</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">Formal Language</label>
              <textarea
                value={editing.formal_language}
                onChange={e => setEditing({ ...editing, formal_language: e.target.value })}
                rows={3}
                className="w-full px-2.5 py-1.5 bg-bg border border-border rounded text-sm text-text resize-none focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                placeholder="Responding Party objects to this request on the grounds that..."
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-lg bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </button>
            </div>
          </div>
        )}

        {/* Objection list */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
          </div>
        ) : objections.length === 0 ? (
          <div className="text-center py-12 text-sm text-text-muted">
            No objections yet. Click "Add Objection" to create one.
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={objections.map(o => o.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1.5">
                {objections.map(obj => (
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
      </PageContent>
    </div>
  );
}
