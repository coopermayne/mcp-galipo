import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, X, Loader2 } from 'lucide-react';
import { getEventTasks } from '../../api';

interface DeleteEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  eventId: number | null;
  eventDescription: string;
  isLoading?: boolean;
}

export function DeleteEventModal({
  isOpen,
  onClose,
  onConfirm,
  eventId,
  eventDescription,
  isLoading = false,
}: DeleteEventModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Fetch linked tasks when modal opens
  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['event-tasks', eventId],
    queryFn: () => getEventTasks(eventId!),
    enabled: isOpen && eventId !== null,
  });

  const linkedTasks = tasksData?.tasks || [];

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

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

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
          className="relative w-full max-w-md transform rounded-xl bg-bg-surface shadow-xl transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 text-text-muted hover:text-text-secondary rounded-lg hover:bg-bg-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="p-6">
            {/* Icon */}
            <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-6 h-6" />
            </div>

            {/* Title */}
            <h3 className="mt-4 text-lg font-semibold text-center text-text">
              Delete Event
            </h3>

            {/* Message */}
            <p className="mt-2 text-sm text-center text-text-secondary">
              Are you sure you want to delete "{eventDescription}"?
            </p>

            {/* Linked tasks warning */}
            {tasksLoading ? (
              <div className="mt-4 flex items-center justify-center gap-2 text-text-muted">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Checking for linked tasks...</span>
              </div>
            ) : linkedTasks.length > 0 ? (
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                  This will also delete {linkedTasks.length} linked task{linkedTasks.length > 1 ? 's' : ''}:
                </p>
                <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1 max-h-32 overflow-y-auto">
                  {linkedTasks.map((task: { id: number; description: string }, index: number) => (
                    <li key={task.id} className="truncate">
                      {index + 1}. {task.description}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Actions */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-text-secondary bg-bg-hover hover:bg-bg-hover rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={isLoading || tasksLoading}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                {isLoading ? 'Deleting...' : 'Delete Event'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
