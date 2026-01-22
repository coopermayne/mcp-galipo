import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { ConfirmModal } from '../../../components/common';
import { createNote, deleteNote } from '../../../api';
import type { Note } from '../../../types';

interface NotesTabProps {
  caseId: number;
  notes: Note[];
}

export function NotesTab({ caseId, notes }: NotesTabProps) {
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; content: string } | null>(null);

  const createMutation = useMutation({
    mutationFn: (content: string) => createNote(caseId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      setNewNote('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteNote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      setDeleteTarget(null);
    },
  });

  const handleDelete = useCallback((note: Note) => {
    setDeleteTarget({ id: note.id, content: note.content });
  }, []);

  const confirmDelete = useCallback(() => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id);
    }
  }, [deleteTarget, deleteMutation]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newNote.trim()) {
      createMutation.mutate(newNote.trim());
    }
  };

  const formatDate = (dateStr: string) => {
    const date = parseISO(dateStr);
    return isValid(date) ? format(date, 'MMM d, yyyy h:mm a') : dateStr;
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
      {/* Add Note */}
      <form onSubmit={handleCreate} className="p-4 border-b border-slate-200 dark:border-slate-700">
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a note..."
          className="
            w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600
            bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400
            focus:border-primary-500 focus:ring-1 focus:ring-primary-500
            outline-none text-sm resize-none min-h-[80px]
          "
        />
        <div className="mt-2 flex justify-end">
          <button
            type="submit"
            disabled={createMutation.isPending || !newNote.trim()}
            className="
              px-4 py-2 bg-primary-600 text-white rounded-lg
              hover:bg-primary-700 transition-colors
              disabled:opacity-50 text-sm font-medium
              inline-flex items-center gap-2
            "
          >
            <Plus className="w-4 h-4" />
            Add Note
          </button>
        </div>
      </form>

      {/* Notes List */}
      <div className="divide-y divide-slate-200 dark:divide-slate-700">
        {notes.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No notes</div>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm text-slate-900 dark:text-slate-100 whitespace-pre-wrap">
                    {note.content}
                  </p>
                  <p className="text-xs text-slate-500 mt-2">{formatDate(note.created_at)}</p>
                </div>
                <button
                  onClick={() => handleDelete(note)}
                  className="p-1 text-slate-500 hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Note"
        message={`Are you sure you want to delete this note? This action cannot be undone.`}
        confirmText="Delete Note"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
