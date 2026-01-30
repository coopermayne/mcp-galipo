import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, ListTodo } from 'lucide-react';
import { createTask } from '../../api';
import type { Event } from '../../types';

interface CreateTaskFromEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: Event | null;
  caseId: number;
}

export function CreateTaskFromEventModal({
  isOpen,
  onClose,
  event,
  caseId,
}: CreateTaskFromEventModalProps) {
  const queryClient = useQueryClient();
  const modalRef = useRef<HTMLDivElement>(null);
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [urgency, setUrgency] = useState(2);

  // Pre-fill form when event changes
  useEffect(() => {
    if (event) {
      setDescription(event.description);
      setDueDate(event.date);
      setUrgency(2);
    }
  }, [event]);

  // Handle body scroll lock and focus
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      modalRef.current?.focus();
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const createMutation = useMutation({
    mutationFn: () =>
      createTask({
        case_id: caseId,
        description,
        due_date: dueDate || undefined,
        urgency,
        event_id: event?.id,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim()) {
      createMutation.mutate();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          ref={modalRef}
          tabIndex={-1}
          className="relative w-full max-w-md transform rounded-xl bg-white dark:bg-slate-800 shadow-xl transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <form onSubmit={handleSubmit} className="p-6">
            {/* Icon */}
            <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400">
              <ListTodo className="w-6 h-6" />
            </div>

            {/* Title */}
            <h3 className="mt-4 text-lg font-semibold text-center text-slate-900 dark:text-slate-100">
              Create Task from Event
            </h3>

            {/* Form fields */}
            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description *
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Task description"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Urgency
                </label>
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                >
                  <option value={1}>1 - Low</option>
                  <option value={2}>2 - Normal</option>
                  <option value={3}>3 - High</option>
                  <option value={4}>4 - Urgent</option>
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={createMutation.isPending}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || !description.trim()}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-slate-800"
              >
                {createMutation.isPending ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
