import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Clock, CheckCircle, Trash2, Plus, ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { parseISO, isValid, format } from 'date-fns';
import { formatSmartDate } from '../../../utils/dateFormat';
import { ConfirmModal } from '../../../components/common';
import { createActivity, deleteActivity, getConstants } from '../../../api';
import type { Activity, Task, Constants } from '../../../types';
import type { TimelineItem } from '../../../types/timeline';

interface ActivityTabProps {
  caseId: number;
  activities: Activity[];
  tasks: Task[];
}

export function ActivityTab({ caseId, activities, tasks }: ActivityTabProps) {
  const queryClient = useQueryClient();
  const [description, setDescription] = useState('');
  const [activityType, setActivityType] = useState('');
  const [activityDate, setActivityDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [minutes, setMinutes] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; description: string } | null>(null);
  const [isFormExpanded, setIsFormExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when form expands
  useEffect(() => {
    if (isFormExpanded && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isFormExpanded]);

  const { data: constants } = useQuery<Constants>({
    queryKey: ['constants'],
    queryFn: getConstants,
  });

  const activityTypes = constants?.activity_types || [];

  const createMutation = useMutation({
    mutationFn: () =>
      createActivity({
        case_id: caseId,
        description: description.trim(),
        activity_type: activityType || 'Unspecified',
        date: activityDate,
        minutes: minutes ? parseInt(minutes, 10) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      setDescription('');
      setMinutes('');
      // Keep type and date for convenience when adding multiple activities
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteActivity(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      setDeleteTarget(null);
    },
  });

  const handleDelete = useCallback((activity: Activity) => {
    setDeleteTarget({ id: activity.id, description: activity.description });
  }, []);

  const confirmDelete = useCallback(() => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id);
    }
  }, [deleteTarget, deleteMutation]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim() && activityDate) {
      createMutation.mutate();
    }
  };

  // Build unified timeline from activities and completed tasks
  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];
    const query = searchQuery.toLowerCase().trim();

    // Add activities (with null safety)
    if (activities && Array.isArray(activities)) {
      for (const activity of activities) {
        if (activity && activity.date) {
          // Filter by search query
          if (query && !activity.description.toLowerCase().includes(query) &&
              !activity.type.toLowerCase().includes(query)) {
            continue;
          }
          items.push({
            type: 'activity',
            data: activity,
            sortDate: activity.date,
          });
        }
      }
    }

    // Add completed tasks (with null safety)
    if (tasks && Array.isArray(tasks)) {
      const completedTasks = tasks.filter((t) => t && t.status === 'Done');
      for (const task of completedTasks) {
        const sortDate = task.completion_date || task.created_at;
        if (sortDate) {
          // Filter by search query
          if (query && !task.description.toLowerCase().includes(query)) {
            continue;
          }
          items.push({
            type: 'completed_task',
            data: task,
            sortDate,
          });
        }
      }
    }

    // Sort by date descending (most recent first)
    items.sort((a, b) => {
      const dateA = parseISO(a.sortDate);
      const dateB = parseISO(b.sortDate);
      if (!isValid(dateA) || !isValid(dateB)) return 0;
      return dateB.getTime() - dateA.getTime();
    });

    return items;
  }, [activities, tasks, searchQuery]);

  const formatDateTime = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (!isValid(date)) return dateStr;
    return formatSmartDate(date, { numeric: false });
  };

  return (
    <div className="space-y-6">
      {/* Activity Creation Form */}
      <div className="bg-bg-surface rounded-lg border border-border" style={{ borderColor: 'var(--theme-border)' }}>
        <button
          onClick={() => setIsFormExpanded(!isFormExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between text-left border-b border-border"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-text-muted" />
            <h3 className="font-medium text-text">Add Activity</h3>
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
                placeholder="Describe the activity..."
                className="
                  w-full px-3 py-2 rounded-lg border border-border
                  bg-bg-surface text-text placeholder-text-muted
                  focus:border-primary-500 focus:ring-1 focus:ring-primary-500
                  outline-none text-sm resize-none min-h-[60px]
                "
              />
              <div className="flex flex-wrap gap-3">
                <select
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value)}
                  className="
                    px-3 py-2 rounded-lg border border-border
                    bg-bg-surface text-text
                    focus:border-primary-500 focus:ring-1 focus:ring-primary-500
                    outline-none text-sm flex-1 min-w-[140px]
                  "
                >
                  <option value="">Select type...</option>
                  {activityTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={activityDate}
                  onChange={(e) => setActivityDate(e.target.value)}
                  className="
                    px-3 py-2 rounded-lg border border-border
                    bg-bg-surface text-text
                    focus:border-primary-500 focus:ring-1 focus:ring-primary-500
                    outline-none text-sm
                  "
                />
                <input
                  type="number"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  placeholder="Minutes"
                  min="0"
                  className="
                    w-24 px-3 py-2 rounded-lg border border-border
                    bg-bg-surface text-text placeholder-text-muted
                    focus:border-primary-500 focus:ring-1 focus:ring-primary-500
                    outline-none text-sm
                  "
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="submit"
                disabled={createMutation.isPending || !description.trim() || !activityDate}
                className="
                  px-4 py-2 bg-primary-600 text-white rounded-lg
                  hover:bg-primary-700 transition-colors
                  disabled:opacity-50 text-sm font-medium
                  inline-flex items-center gap-2
                "
              >
                <Plus className="w-4 h-4" />
                Add Activity
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
              <h3 className="font-medium text-text">Timeline</h3>
              <p className="text-xs text-text-muted mt-1">
                Activities and completed tasks
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
                <>No results for "{searchQuery}"</>
              ) : (
                <>No activities or completed tasks yet</>
              )}
            </div>
          ) : (
            timeline.map((item, index) => (
              <div
                key={`${item.type}-${item.data.id}`}
                className={`px-4 py-3 hover:bg-bg-hover ${index > 0 ? 'border-t border-border' : ''}`}
                style={index > 0 ? { borderColor: 'var(--theme-border)' } : undefined}
              >
                {item.type === 'activity' ? (
                  <ActivityItem
                    activity={item.data as Activity}
                    onDelete={handleDelete}
                    formatDateTime={formatDateTime}
                  />
                ) : (
                  <CompletedTaskItem task={item.data as Task} formatDateTime={formatDateTime} />
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Activity"
        message="Are you sure you want to delete this activity? This action cannot be undone."
        confirmText="Delete Activity"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

interface ActivityItemProps {
  activity: Activity;
  onDelete: (activity: Activity) => void;
  formatDateTime: (dateStr: string) => string;
}

function ActivityItem({ activity, onDelete, formatDateTime }: ActivityItemProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 p-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30">
        <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-text">{activity.description}</p>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-xs text-text-muted">
                {formatDateTime(activity.date)}
              </span>
              <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                {activity.type}
              </span>
              {activity.minutes && (
                <span className="text-xs text-text-muted">
                  {activity.minutes} min
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => onDelete(activity)}
            className="p-1 text-text-muted hover:text-red-500 dark:hover:text-red-400"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface CompletedTaskItemProps {
  task: Task;
  formatDateTime: (dateStr: string) => string;
}

function CompletedTaskItem({ task, formatDateTime }: CompletedTaskItemProps) {
  const displayDate = task.completion_date || task.created_at;

  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 p-1.5 rounded-full bg-green-100 dark:bg-green-900/30">
        <CheckCircle className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text">{task.description}</p>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <span className="text-xs text-text-muted">
            {formatDateTime(displayDate)}
          </span>
          <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
            Task Completed
          </span>
        </div>
      </div>
    </div>
  );
}
