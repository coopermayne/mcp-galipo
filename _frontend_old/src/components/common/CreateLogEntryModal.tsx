/**
 * CreateLogEntryModal - Quick log entry creation sheet
 *
 * Matches CreateTaskModal UX: slides up from bottom, minimal fields.
 * Creates a task with status=Done and the given completion_date.
 */
import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { createTask } from '../../api';

interface CreateLogEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: number;
}

export function CreateLogEntryModal({
  isOpen,
  onClose,
  caseId,
}: CreateLogEntryModalProps) {
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [description, setDescription] = useState('');
  const [logDate, setLogDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setDescription('');
      setLogDate(format(new Date(), 'yyyy-MM-dd'));
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
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
        description: description.trim(),
        status: 'Done',
        completion_date: logDate,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onClose();
    },
  });

  const handleSubmit = () => {
    if (description.trim() && logDate) {
      createMutation.mutate();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2
                   bg-bg-surface
                   rounded-t-2xl sm:rounded-2xl
                   shadow-xl
                   max-h-[90vh] sm:max-h-[80vh] sm:w-full sm:max-w-lg
                   flex flex-col
                   animate-slide-up sm:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-base font-semibold text-text">
            Log Activity
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-text-muted hover:text-text"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          <textarea
            ref={textareaRef}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What was done..."
            className="
              w-full px-3 py-2 rounded-lg border border-border
              bg-bg-surface text-text placeholder-text-muted
              focus:border-primary-500 focus:ring-1 focus:ring-primary-500
              outline-none text-sm resize-none min-h-[80px]
            "
          />
          <input
            type="date"
            value={logDate}
            onChange={(e) => setLogDate(e.target.value)}
            className="
              px-3 py-2 rounded-lg border border-border
              bg-bg-surface text-text
              focus:border-primary-500 focus:ring-1 focus:ring-primary-500
              outline-none text-sm
            "
          />
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-3 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={createMutation.isPending}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-text-secondary bg-bg-hover hover:bg-bg-hover/80 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={createMutation.isPending || !description.trim() || !logDate}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {createMutation.isPending ? 'Adding...' : 'Add to Log'}
          </button>
        </div>
      </div>

      {/* CSS for slide-up animation */}
      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
