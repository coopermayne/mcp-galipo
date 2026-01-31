import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, ListTodo } from 'lucide-react';
import { createTask, getCases } from '../../api';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-selected case ID (if provided, case selector is hidden) */
  caseId?: number;
  /** Pre-filled due date */
  dueDate?: string;
  /** Additional query keys to invalidate on success */
  invalidateKeys?: string[][];
}

export function CreateTaskModal({
  isOpen,
  onClose,
  caseId: preselectedCaseId,
  dueDate: prefilledDueDate,
  invalidateKeys = [],
}: CreateTaskModalProps) {
  const queryClient = useQueryClient();
  const modalRef = useRef<HTMLDivElement>(null);
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(prefilledDueDate || '');
  const [urgency, setUrgency] = useState(2);
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(preselectedCaseId || null);

  // Fetch cases for dropdown (only when no preselected case)
  const { data: casesData } = useQuery({
    queryKey: ['cases-for-create'],
    queryFn: () => getCases({ limit: 100 }),
    enabled: isOpen && !preselectedCaseId,
  });
  // Filter out closed cases client-side
  const cases = (casesData?.cases || []).filter(c => c.status !== 'Closed');

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setDescription('');
      setDueDate(prefilledDueDate || '');
      setUrgency(2);
      setSelectedCaseId(preselectedCaseId || null);
    }
  }, [isOpen, prefilledDueDate, preselectedCaseId]);

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
    mutationFn: () => {
      const caseIdToUse = preselectedCaseId || selectedCaseId;
      if (!caseIdToUse) throw new Error('Case is required');
      return createTask({
        case_id: caseIdToUse,
        description,
        due_date: dueDate || undefined,
        urgency,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['lab-tasks'] });
      // Invalidate case-specific queries if we have a case ID
      const caseIdToUse = preselectedCaseId || selectedCaseId;
      if (caseIdToUse) {
        queryClient.invalidateQueries({ queryKey: ['case', caseIdToUse] });
      }
      // Invalidate any additional keys
      invalidateKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const caseIdToUse = preselectedCaseId || selectedCaseId;
    if (description.trim() && caseIdToUse) {
      createMutation.mutate();
    }
  };

  const caseIdToUse = preselectedCaseId || selectedCaseId;
  const canSubmit = description.trim() && caseIdToUse;

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
              Create Task
            </h3>

            {/* Form fields */}
            <div className="mt-6 space-y-4">
              {/* Case selector (only show if no preselected case) */}
              {!preselectedCaseId && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Case *
                  </label>
                  <select
                    value={selectedCaseId || ''}
                    onChange={(e) => setSelectedCaseId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                  >
                    <option value="">Select a case...</option>
                    {cases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.short_name || c.case_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
                disabled={createMutation.isPending || !canSubmit}
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
