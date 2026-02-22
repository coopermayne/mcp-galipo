import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Plus, ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { parseISO, isValid, format } from 'date-fns';
import { formatSmartDate } from '../../../utils/dateFormat';
import { ConfirmModal } from '../../../components/common';
import { createTask, deleteTask } from '../../../api';
import { getStatusColor } from '../../../config/colors';
import type { Task } from '../../../types';
import type { TimelineItem } from '../../../types/timeline';

interface ActivityTabProps {
  caseId: number;
  tasks: Task[];
}

export function ActivityTab({ caseId, tasks }: ActivityTabProps) {
  const queryClient = useQueryClient();
  const [description, setDescription] = useState('');
  const [logDate, setLogDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; description: string } | null>(null);
  const [isFormExpanded, setIsFormExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isFormExpanded && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isFormExpanded]);

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
      setDescription('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setDeleteTarget(null);
    },
  });

  const handleDelete = useCallback((task: Task) => {
    setDeleteTarget({ id: task.id, description: task.description });
  }, []);

  const confirmDelete = useCallback(() => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id);
    }
  }, [deleteTarget, deleteMutation]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim() && logDate) {
      createMutation.mutate();
    }
  };

  // Build timeline from all tasks except Pending
  // Sort by updated_at (full timestamp) so we get true chronological order
  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];
    const query = searchQuery.toLowerCase().trim();

    if (tasks && Array.isArray(tasks)) {
      for (const task of tasks) {
        if (!task || task.status === 'Pending') continue;

        if (query && !task.description.toLowerCase().includes(query)) continue;

        // Always sort by updated_at (has time precision), fall back to created_at
        const sortDate = task.updated_at || task.created_at;

        if (sortDate) {
          items.push({ data: task, sortDate });
        }
      }
    }

    items.sort((a, b) => {
      const dateA = parseISO(a.sortDate);
      const dateB = parseISO(b.sortDate);
      if (!isValid(dateA) || !isValid(dateB)) return 0;
      return dateB.getTime() - dateA.getTime();
    });

    return items;
  }, [tasks, searchQuery]);

  const formatDateTime = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (!isValid(date)) return dateStr;
    const datePart = formatSmartDate(date, { numeric: false });
    // Include time if the string has time info (not just a date)
    if (dateStr.includes('T') || dateStr.includes(' ')) {
      const timePart = format(date, 'h:mm a');
      return `${datePart} at ${timePart}`;
    }
    return datePart;
  };

  return (
    <div className="space-y-6">
      {/* Add to Log Form */}
      <div className="bg-bg-surface rounded-lg border border-border" style={{ borderColor: 'var(--theme-border)' }}>
        <button
          onClick={() => setIsFormExpanded(!isFormExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between text-left border-b border-border"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-text-muted" />
            <h3 className="font-medium text-text">Add to Log</h3>
          </div>
          {isFormExpanded ? (
            <ChevronUp className="w-4 h-4 text-text-muted" />
          ) : (
            <ChevronDown className="w-4 h-4 text-text-muted" />
          )}
        </button>

        {isFormExpanded && (
          <form onSubmit={handleCreate} className="p-4">
            <div className="space-y-3">
              <textarea
                ref={textareaRef}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What was done..."
                className="
                  w-full px-3 py-2 rounded-lg border border-border
                  bg-bg-surface text-text placeholder-text-muted
                  focus:border-primary-500 focus:ring-1 focus:ring-primary-500
                  outline-none text-sm resize-none min-h-[60px]
                "
              />
              <div className="flex items-center gap-3">
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
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="submit"
                disabled={createMutation.isPending || !description.trim() || !logDate}
                className="
                  px-4 py-2 bg-primary-600 text-white rounded-lg
                  hover:bg-primary-700 transition-colors
                  disabled:opacity-50 text-sm font-medium
                  inline-flex items-center gap-2
                "
              >
                <Plus className="w-4 h-4" />
                Add to Log
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Timeline */}
      <div className="bg-bg-surface rounded-lg border border-border" style={{ borderColor: 'var(--theme-border)' }}>
        <div className="px-4 py-3 border-b border-border" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-medium text-text">Activity Log</h3>
              <p className="text-xs text-text-muted mt-1">
                Tasks in progress, completed, and logged
              </p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="
                  pl-9 pr-8 py-1.5 w-48 rounded-lg border border-border
                  bg-bg-surface text-text placeholder-text-muted
                  focus:border-primary-500 focus:ring-1 focus:ring-primary-500
                  outline-none text-sm
                "
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-text-muted hover:text-text-secondary"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div>
          {timeline.length === 0 ? (
            <div className="p-8 text-center text-text-muted">
              {searchQuery ? (
                <>No results for &ldquo;{searchQuery}&rdquo;</>
              ) : (
                <>No activity yet</>
              )}
            </div>
          ) : (
            timeline.map((item, index) => {
              const task = item.data;
              const statusColor = getStatusColor(task.status);
              const displayDate = task.updated_at || task.created_at;

              return (
                <div
                  key={task.id}
                  className={`px-4 py-3 hover:bg-bg-hover ${index > 0 ? 'border-t border-border' : ''}`}
                  style={index > 0 ? { borderColor: 'var(--theme-border)' } : undefined}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-text">{task.description}</p>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-xs text-text-muted">
                              {formatDateTime(displayDate)}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded ${statusColor.bg} ${statusColor.text}`}>
                              {task.status}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDelete(task)}
                          className="p-1 text-text-muted hover:text-red-500 dark:hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Entry"
        message="Are you sure you want to delete this entry? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
