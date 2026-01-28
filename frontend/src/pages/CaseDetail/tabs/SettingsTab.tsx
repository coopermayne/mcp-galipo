import { useState, useCallback } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Trash2, Activity, AlertTriangle, Plus } from 'lucide-react';
import { parseISO, isValid, format } from 'date-fns';
import { formatSmartDate } from '../../../utils/dateFormat';
import { ConfirmModal } from '../../../components/common';
import { createActivity, deleteActivity, getConstants } from '../../../api';
import type { Activity as ActivityType, Constants } from '../../../types';

interface SettingsTabProps {
  caseId: number;
  caseName: string;
  activities: ActivityType[];
  onDelete: () => void;
}

export function SettingsTab({ caseId, caseName, activities, onDelete }: SettingsTabProps) {
  const queryClient = useQueryClient();
  const [description, setDescription] = useState('');
  const [activityType, setActivityType] = useState('');
  const [activityDate, setActivityDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [minutes, setMinutes] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; description: string } | null>(null);

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
        activity_type: activityType,
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

  const handleDelete = useCallback((activity: ActivityType) => {
    setDeleteTarget({ id: activity.id, description: activity.description });
  }, []);

  const confirmDelete = useCallback(() => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id);
    }
  }, [deleteTarget, deleteMutation]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim() && activityType && activityDate) {
      createMutation.mutate();
    }
  };

  const formatDateTime = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (!isValid(date)) return dateStr;
    const datePart = formatSmartDate(date, { numeric: false });
    const timePart = format(date, 'h:mm a');
    return `${datePart} ${timePart}`;
  };

  return (
    <div className="space-y-6">
      {/* Activity Log */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <h3 className="font-medium text-slate-900 dark:text-slate-100">Activity Log</h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Record activities and time entries for this case
          </p>
        </div>

        {/* Add Activity Form */}
        <form onSubmit={handleCreate} className="p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="space-y-3">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the activity..."
              className="
                w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600
                bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400
                focus:border-primary-500 focus:ring-1 focus:ring-primary-500
                outline-none text-sm resize-none min-h-[60px]
              "
            />
            <div className="flex flex-wrap gap-3">
              <select
                value={activityType}
                onChange={(e) => setActivityType(e.target.value)}
                className="
                  px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600
                  bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100
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
                  px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600
                  bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100
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
                  w-24 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600
                  bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400
                  focus:border-primary-500 focus:ring-1 focus:ring-primary-500
                  outline-none text-sm
                "
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={createMutation.isPending || !description.trim() || !activityType || !activityDate}
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

        {/* Activities List */}
        <div className="divide-y divide-slate-200 dark:divide-slate-700">
          {activities.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
              No activities recorded
            </div>
          ) : (
            activities.slice(0, 20).map((activity) => (
              <div
                key={activity.id}
                className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-900 dark:text-slate-100">
                      {activity.description}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDateTime(activity.date)}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded">
                        {activity.type}
                      </span>
                      {activity.minutes && (
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {activity.minutes} min
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(activity)}
                    className="p-1 text-slate-400 hover:text-red-500 dark:hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-red-200 dark:border-red-900/50">
        <div className="px-4 py-3 border-b border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 rounded-t-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
            <h3 className="font-medium text-red-600 dark:text-red-400">Danger Zone</h3>
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">Delete this case</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Permanently delete "{caseName}" and all associated data. This action cannot be undone.
              </p>
            </div>
            <button
              onClick={onDelete}
              className="
                inline-flex items-center gap-2 px-4 py-2
                bg-red-600 text-white rounded-lg
                hover:bg-red-700 transition-colors
                text-sm font-medium
              "
            >
              <Trash2 className="w-4 h-4" />
              Delete Case
            </button>
          </div>
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
