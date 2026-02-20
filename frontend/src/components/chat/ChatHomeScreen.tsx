/**
 * Chat home screen component.
 *
 * Shows context-appropriate UI:
 * - Case context: Case-specific preset buttons
 * - Intakes page: Intake insight presets + New Intake action
 * - Dashboard/general: Dashboard preset buttons
 */

import { MessageCircle } from 'lucide-react';
import {
  type DashboardPreset,
  type CasePreset,
  type ActionStarter,
  type DashboardActionStarter,
  getModeColorClasses,
  DASHBOARD_PRESETS,
  INTAKE_PRESETS,
  DASHBOARD_ACTION_STARTERS,
  CASE_PRESETS,
  ACTION_STARTERS,
} from '../../config/chatModes';

export type PageContext = 'intakes' | undefined;

interface ChatHomeScreenProps {
  caseContext?: number;
  pageContext?: PageContext;
  onSendPreset: (preset: DashboardPreset) => void;
  onSendCasePreset: (preset: CasePreset) => void;
  onSendActionStarter: (starter: ActionStarter | DashboardActionStarter) => void;
}

export function ChatHomeScreen({
  caseContext,
  pageContext,
  onSendPreset,
  onSendCasePreset,
  onSendActionStarter,
}: ChatHomeScreenProps) {
  if (caseContext) {
    // Case context: Show case-specific preset buttons
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
          <MessageCircle className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>

        <h3 className="text-lg font-semibold text-text mb-2">
          Case Insights
        </h3>
        <p className="text-sm text-text-muted mb-6 text-center max-w-sm">
          Get quick answers about this case
        </p>

        <div className="w-full max-w-sm space-y-3">
          {CASE_PRESETS.map((preset) => {
            const Icon = preset.icon;
            const colors = getModeColorClasses(preset.color);

            return (
              <button
                key={preset.id}
                onClick={() => onSendCasePreset(preset)}
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
                  <div className="text-sm text-text-muted">
                    {preset.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Action Starters - for adding data */}
        <div className="w-full max-w-sm mt-6">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3 px-1">
            Add to Case
          </p>
          <div className="flex flex-wrap gap-2">
            {ACTION_STARTERS.map((starter) => {
              const Icon = starter.icon;
              const colors = getModeColorClasses(starter.color);

              return (
                <button
                  key={starter.id}
                  onClick={() => onSendActionStarter(starter)}
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-lg
                    border ${colors.border}
                    ${colors.bgLight} ${colors.hover}
                    transition-colors
                  `}
                >
                  <Icon className={`w-4 h-4 ${colors.text}`} />
                  <span className={`text-sm font-medium ${colors.text}`}>{starter.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Choose presets and config based on page context
  const isIntakes = pageContext === 'intakes';
  const presets = isIntakes ? INTAKE_PRESETS : DASHBOARD_PRESETS;
  const heading = isIntakes ? 'Insights' : 'Quick Insights';
  const subheading = isIntakes
    ? 'Surface what needs your attention'
    : 'Get an overview of your cases and tasks';

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
        <MessageCircle className="w-8 h-8 text-blue-600 dark:text-blue-400" />
      </div>

      <h3 className="text-lg font-semibold text-text mb-2">
        {heading}
      </h3>
      <p className="text-sm text-text-muted mb-6 text-center max-w-sm">
        {subheading}
      </p>

      <div className="w-full max-w-sm space-y-3">
        {presets.map((preset) => {
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
                <div className="text-sm text-text-muted">
                  {preset.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Quick Actions - only on intakes page */}
      {isIntakes && (
        <div className="w-full max-w-sm mt-6">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3 px-1">
            Quick Actions
          </p>
          <div className="flex flex-wrap gap-2">
            {DASHBOARD_ACTION_STARTERS.map((starter) => {
              const Icon = starter.icon;
              const colors = getModeColorClasses(starter.color);

              return (
                <button
                  key={starter.id}
                  onClick={() => onSendActionStarter(starter)}
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-lg
                    border ${colors.border}
                    ${colors.bgLight} ${colors.hover}
                    transition-colors
                  `}
                >
                  <Icon className={`w-4 h-4 ${colors.text}`} />
                  <span className={`text-sm font-medium ${colors.text}`}>{starter.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
