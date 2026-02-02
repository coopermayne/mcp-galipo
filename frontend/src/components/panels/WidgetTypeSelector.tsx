/**
 * WidgetTypeSelector - Dropdown to switch widget type within a panel
 *
 * Only shown when there are multiple widget types allowed.
 */
import { useState } from 'react';
import { Check, ChevronDown, CheckSquare, Clock } from 'lucide-react';
import type { WidgetType } from '../../types/panel-layout';
import { WIDGET_INFO } from '../../types/panel-layout';

const WIDGET_ICONS: Record<WidgetType, React.ReactNode> = {
  tasks: <CheckSquare className="w-4 h-4" />,
  events: <Clock className="w-4 h-4" />,
};

interface WidgetTypeSelectorProps {
  value: WidgetType;
  allowedWidgets: WidgetType[];
  onChange: (type: WidgetType) => void;
}

export function WidgetTypeSelector({
  value,
  allowedWidgets,
  onChange,
}: WidgetTypeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const currentInfo = WIDGET_INFO[value];

  // Show static label if only one widget type is allowed
  if (allowedWidgets.length <= 1) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 text-sm font-medium text-slate-600 dark:text-slate-300">
        {WIDGET_ICONS[value]}
        <span>{currentInfo?.label || 'Widget'}</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded text-sm font-medium transition-colors ${
          isOpen
            ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
        }`}
      >
        {WIDGET_ICONS[value]}
        <span>{currentInfo?.label || 'Widget'}</span>
        <ChevronDown className="w-3 h-3" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          {/* Dropdown */}
          <div className="absolute left-0 top-full mt-1 w-48 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50">
            {allowedWidgets.map((type) => {
              const info = WIDGET_INFO[type];
              return (
                <button
                  key={type}
                  onClick={() => {
                    onChange(type);
                    setIsOpen(false);
                  }}
                  className="flex items-center justify-between w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <span className="flex items-center gap-2">
                    {WIDGET_ICONS[type]}
                    <span>{info.label}</span>
                  </span>
                  {value === type && (
                    <Check className="w-4 h-4 text-primary-500" />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
