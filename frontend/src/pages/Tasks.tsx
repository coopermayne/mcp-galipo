import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Header } from '../components/layout';
import {
  EditableText,
  EditableSelect,
  EditableDate,
  StatusBadge,
  UrgencyBadge,
} from '../components/common';
import { getTasks, getConstants, updateTask, deleteTask } from '../api/client';
import type { Task } from '../types';
import { Loader2, Trash2, ExternalLink, Filter } from 'lucide-react';

export function Tasks() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('');

  const { data: tasksData, isLoading } = useQuery({
    queryKey: ['tasks', { status: statusFilter || undefined, urgency: urgencyFilter ? parseInt(urgencyFilter) : undefined }],
    queryFn: () =>
      getTasks({
        status: statusFilter || undefined,
        urgency: urgencyFilter ? parseInt(urgencyFilter) : undefined,
      }),
  });

  const { data: constants } = useQuery({
    queryKey: ['constants'],
    queryFn: getConstants,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Task> }) =>
      updateTask(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const taskStatusOptions = useMemo(
    () =>
      (constants?.task_statuses || []).map((s) => ({
        value: s,
        label: s,
      })),
    [constants]
  );

  const urgencyOptions = [
    { value: '1', label: '1 - Low' },
    { value: '2', label: '2' },
    { value: '3', label: '3 - Medium' },
    { value: '4', label: '4' },
    { value: '5', label: '5 - Critical' },
  ];

  const handleUpdate = useCallback(
    async (taskId: number, field: string, value: any) => {
      await updateMutation.mutateAsync({ id: taskId, data: { [field]: value } });
    },
    [updateMutation]
  );

  const handleDelete = useCallback(
    (taskId: number) => {
      if (confirm('Are you sure you want to delete this task?')) {
        deleteMutation.mutate(taskId);
      }
    },
    [deleteMutation]
  );

  // Group tasks by date
  const groupedTasks = useMemo(() => {
    if (!tasksData?.tasks) return {};

    const groups: Record<string, Task[]> = {
      overdue: [],
      today: [],
      tomorrow: [],
      thisWeek: [],
      later: [],
      noDueDate: [],
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);

    tasksData.tasks.forEach((task) => {
      if (!task.due_date) {
        groups.noDueDate.push(task);
        return;
      }

      const dueDate = new Date(task.due_date);
      dueDate.setHours(0, 0, 0, 0);

      if (dueDate < today) {
        groups.overdue.push(task);
      } else if (dueDate.getTime() === today.getTime()) {
        groups.today.push(task);
      } else if (dueDate.getTime() === tomorrow.getTime()) {
        groups.tomorrow.push(task);
      } else if (dueDate < weekEnd) {
        groups.thisWeek.push(task);
      } else {
        groups.later.push(task);
      }
    });

    return groups;
  }, [tasksData?.tasks]);

  const groupLabels: Record<string, string> = {
    overdue: 'Overdue',
    today: 'Today',
    tomorrow: 'Tomorrow',
    thisWeek: 'This Week',
    later: 'Later',
    noDueDate: 'No Due Date',
  };

  const groupColors: Record<string, string> = {
    overdue: 'text-red-600',
    today: 'text-amber-600',
    tomorrow: 'text-blue-600',
    thisWeek: 'text-slate-600',
    later: 'text-slate-500',
    noDueDate: 'text-slate-400',
  };

  return (
    <>
      <Header
        title="Tasks"
        subtitle={`${tasksData?.total ?? 0} tasks`}
      />

      <div className="flex-1 overflow-auto p-6">
        {/* Filters */}
        <div className="mb-6 flex items-center gap-4 bg-white rounded-lg border border-slate-200 p-4">
          <Filter className="w-4 h-4 text-slate-400" />
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm bg-white"
            >
              <option value="">All</option>
              {constants?.task_statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">Min Urgency:</label>
            <select
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm bg-white"
            >
              <option value="">All</option>
              {urgencyOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Task List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : tasksData?.tasks.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-500">
            No tasks found
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedTasks).map(
              ([group, tasks]) =>
                tasks.length > 0 && (
                  <div key={group}>
                    <h2 className={`text-sm font-semibold mb-2 ${groupColors[group]}`}>
                      {groupLabels[group]} ({tasks.length})
                    </h2>
                    <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
                      {tasks.map((task) => (
                        <div
                          key={task.id}
                          className="px-4 py-3 flex items-center gap-4 hover:bg-slate-50"
                        >
                          <div className="flex-1 min-w-0">
                            <EditableText
                              value={task.description}
                              onSave={(value) => handleUpdate(task.id, 'description', value)}
                              className="text-sm"
                            />
                            <Link
                              to={`/cases/${task.case_id}`}
                              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-primary-600 mt-1"
                            >
                              {task.case_name || `Case #${task.case_id}`}
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          </div>
                          <EditableDate
                            value={task.due_date || null}
                            onSave={(value) => handleUpdate(task.id, 'due_date', value)}
                            placeholder="Due date"
                          />
                          <EditableSelect
                            value={task.status}
                            options={taskStatusOptions}
                            onSave={(value) => handleUpdate(task.id, 'status', value)}
                            renderValue={(value) => <StatusBadge status={value} />}
                          />
                          <EditableSelect
                            value={String(task.urgency)}
                            options={urgencyOptions}
                            onSave={(value) => handleUpdate(task.id, 'urgency', parseInt(value))}
                            renderValue={(value) => <UrgencyBadge urgency={parseInt(value)} />}
                          />
                          <button
                            onClick={() => handleDelete(task.id)}
                            className="p-1 text-slate-400 hover:text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
            )}
          </div>
        )}
      </div>
    </>
  );
}
