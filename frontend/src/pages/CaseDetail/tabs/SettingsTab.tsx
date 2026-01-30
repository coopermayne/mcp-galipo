import { Trash2, AlertTriangle } from 'lucide-react';

interface SettingsTabProps {
  caseName: string;
  onDelete: () => void;
}

export function SettingsTab({ caseName, onDelete }: SettingsTabProps) {
  return (
    <div className="space-y-6">
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
