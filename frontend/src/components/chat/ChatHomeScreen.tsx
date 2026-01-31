/**
 * Chat home screen component.
 *
 * Shows context-appropriate UI:
 * - Case context: Mode selector buttons (Tasks, Events, People)
 * - Dashboard/general: Preset inquiry buttons
 */

import { MessageCircle } from 'lucide-react';
import {
  type ChatMode,
  type DashboardPreset,
  getCaseModes,
  getModeColorClasses,
  DASHBOARD_PRESETS,
} from '../../config/chatModes';

interface ChatHomeScreenProps {
  caseContext?: number;
  onSelectMode: (mode: ChatMode) => void;
  onSendPreset: (preset: DashboardPreset) => void;
}

export function ChatHomeScreen({
  caseContext,
  onSelectMode,
  onSendPreset,
}: ChatHomeScreenProps) {
  const caseModes = getCaseModes();

  if (caseContext) {
    // Case context: Show mode selector
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
          <MessageCircle className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>

        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
          How can I help?
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 text-center max-w-sm">
          Select a focus area for faster, more accurate responses
        </p>

        <div className="w-full max-w-sm space-y-3">
          {caseModes.map((mode) => {
            const Icon = mode.icon;
            const colors = getModeColorClasses(mode.color);

            return (
              <button
                key={mode.id}
                onClick={() => onSelectMode(mode.id)}
                className={`
                  w-full flex items-center gap-3 p-4 rounded-lg
                  border ${colors.border}
                  ${colors.bgLight} ${colors.hover}
                  transition-colors text-left
                `}
              >
                <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className={`font-medium ${colors.text}`}>{mode.label}</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {mode.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => onSelectMode('full')}
          className="mt-4 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          Or ask anything...
        </button>
      </div>
    );
  }

  // Dashboard context: Show preset inquiry buttons
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
        <MessageCircle className="w-8 h-8 text-blue-600 dark:text-blue-400" />
      </div>

      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
        Quick Insights
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 text-center max-w-sm">
        Get an overview of your cases and tasks
      </p>

      <div className="w-full max-w-sm space-y-3">
        {DASHBOARD_PRESETS.map((preset) => {
          const Icon = preset.icon;
          const colors = getModeColorClasses(preset.color);

          return (
            <button
              key={preset.id}
              onClick={() => onSendPreset(preset)}
              className={`
                w-full flex items-center gap-3 p-4 rounded-lg
                border ${colors.border}
                ${colors.bgLight} ${colors.hover}
                transition-colors text-left
              `}
            >
              <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className={`font-medium ${colors.text}`}>{preset.label}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {preset.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={() => onSelectMode('full')}
        className="mt-4 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
      >
        Or ask anything...
      </button>
    </div>
  );
}
