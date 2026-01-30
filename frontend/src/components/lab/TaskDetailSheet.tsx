/**
 * TaskDetailSheet - Mobile-first full-screen task editor
 *
 * Slides up from bottom on mobile, shows as a sheet/modal.
 * Matches Todoist mobile task editing UX.
 */
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  X,
  ChevronUp,
  ChevronDown,
  MoreHorizontal,
  Calendar,
  Flag,
  Briefcase,
  AlignLeft,
  Paperclip,
} from 'lucide-react';
import type { Task } from '../../types';

// Priority config matching TaskItem
const PRIORITY_CONFIG = {
  4: { label: 'Priority 1', color: 'text-red-500', borderColor: 'border-red-500' },
  3: { label: 'Priority 2', color: 'text-orange-500', borderColor: 'border-orange-500' },
  2: { label: 'Priority 3', color: 'text-blue-500', borderColor: 'border-blue-500' },
  1: { label: 'Priority 4', color: 'text-slate-400', borderColor: 'border-slate-300' },
} as const;

interface TaskDetailSheetProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onMarkDone?: (taskId: number) => void;
  onUpdate?: (taskId: number, updates: Partial<Task>) => void;
  onPrevTask?: () => void;
  onNextTask?: () => void;
  hasPrevTask?: boolean;
  hasNextTask?: boolean;
}

/**
 * Format date for display
 */
function formatDateDisplay(dateStr: string | undefined): { text: string; color: string } {
  if (!dateStr) {
    return { text: 'No due date', color: 'text-slate-400' };
  }

  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      color: 'text-red-500',
    };
  } else if (diffDays === 0) {
    return { text: 'Today', color: 'text-green-600' };
  } else if (diffDays === 1) {
    return { text: 'Tomorrow', color: 'text-orange-500' };
  } else {
    return {
      text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      color: 'text-slate-700 dark:text-slate-300',
    };
  }
}

export function TaskDetailSheet({
  task,
  isOpen,
  onClose,
  onMarkDone,
  onUpdate,
  onPrevTask,
  onNextTask,
  hasPrevTask = false,
  hasNextTask = false,
}: TaskDetailSheetProps) {
  const [editedTitle, setEditedTitle] = useState(task?.description || '');
  const sheetRef = useRef<HTMLDivElement>(null);

  // Sync title when task changes
  useEffect(() => {
    setEditedTitle(task?.description || '');
  }, [task?.description]);

  // Prevent body scroll when open
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

  if (!isOpen || !task) return null;

  const priorityConfig = PRIORITY_CONFIG[task.urgency as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG[1];
  const dateDisplay = formatDateDisplay(task.due_date);
  const isDone = task.status === 'Done';

  const handleCheckboxClick = () => {
    if (onMarkDone) {
      onMarkDone(task.id);
    }
  };

  const handleTitleBlur = () => {
    if (editedTitle !== task.description && onUpdate) {
      onUpdate(task.id, { description: editedTitle });
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Sheet - slides up from bottom on mobile, centered on desktop */}
      <div
        ref={sheetRef}
        className="fixed inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2
                   bg-white dark:bg-slate-900
                   rounded-t-2xl sm:rounded-2xl
                   shadow-xl
                   max-h-[90vh] sm:max-h-[80vh] sm:w-full sm:max-w-lg
                   flex flex-col
                   animate-slide-up sm:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          {/* Project/Case link */}
          <Link
            to={`/cases/${task.case_id}`}
            className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          >
            <Briefcase className="w-4 h-4" />
            <span>{task.short_name || task.case_name || `Case #${task.case_id}`}</span>
          </Link>

          {/* Nav + actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={onPrevTask}
              disabled={!hasPrevTask}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
            <button
              onClick={onNextTask}
              disabled={!hasNextTask}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
            <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <MoreHorizontal className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Task title section */}
          <div className="px-4 py-4">
            <div className="flex items-start gap-3">
              {/* Checkbox */}
              <button
                onClick={handleCheckboxClick}
                className={`
                  w-6 h-6 mt-0.5 flex-shrink-0 rounded-full border-2
                  transition-all duration-150
                  ${isDone
                    ? 'bg-slate-400 border-slate-400'
                    : priorityConfig.borderColor + ' hover:bg-slate-50 dark:hover:bg-slate-800'
                  }
                `}
              >
                {isDone && (
                  <svg className="w-full h-full text-white p-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>

              {/* Title input */}
              <div className="flex-1">
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onBlur={handleTitleBlur}
                  className={`
                    w-full text-lg font-medium bg-transparent border-none outline-none
                    ${isDone ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-slate-100'}
                  `}
                  placeholder="Task name"
                />

                {/* Description placeholder */}
                <div className="flex items-center gap-2 mt-2 text-slate-400">
                  <AlignLeft className="w-4 h-4" />
                  <span className="text-sm">Description</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action rows */}
          <div className="border-t border-slate-100 dark:border-slate-800">
            {/* Case/Project */}
            <Link
              to={`/cases/${task.case_id}`}
              className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800"
            >
              <Briefcase className="w-5 h-5 text-slate-400" />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                {task.short_name || task.case_name || `Case #${task.case_id}`}
              </span>
            </Link>

            {/* Due date */}
            <button className="flex items-center gap-4 px-4 py-3 w-full text-left hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800">
              <Calendar className={`w-5 h-5 ${dateDisplay.color}`} />
              <span className={`text-sm ${dateDisplay.color}`}>
                {dateDisplay.text}
              </span>
            </button>

            {/* Priority */}
            <button className="flex items-center gap-4 px-4 py-3 w-full text-left hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800">
              <Flag className={`w-5 h-5 ${priorityConfig.color}`} />
              <span className={`text-sm ${priorityConfig.color}`}>
                {priorityConfig.label}
              </span>
            </button>
          </div>
        </div>

        {/* Comment input at bottom */}
        <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
            <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-full">
              <input
                type="text"
                placeholder="Comment"
                className="flex-1 bg-transparent border-none outline-none text-sm text-slate-700 dark:text-slate-300 placeholder-slate-400"
              />
              <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <Paperclip className="w-4 h-4" />
              </button>
            </div>
          </div>
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
