import { Trash2, Activity, AlertTriangle } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import type { Activity as ActivityType } from '../../../types';

interface SettingsTabProps {
  caseId: number;
  caseName: string;
  activities: ActivityType[];
  onDelete: () => void;
}

export function SettingsTab({ caseName, activities, onDelete }: SettingsTabProps) {
  const formatDate = (dateStr: string) => {
    const date = parseISO(dateStr);
    return isValid(date) ? format(date, 'MMM d, yyyy h:mm a') : dateStr;
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
            Recent activities and time entries for this case
          </p>
        </div>
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
                        {formatDate(activity.date)}
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
    </div>
  );
}
