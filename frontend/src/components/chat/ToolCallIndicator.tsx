import { useState } from 'react';
import { Wrench, Check, X, ChevronDown, ChevronUp, Loader2, Clock } from 'lucide-react';
import type { ToolExecution } from '../../types';

interface ToolCallIndicatorProps {
  execution: ToolExecution;
}

export function ToolCallIndicator({ execution }: ToolCallIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const duration = execution.endTime
    ? ((execution.endTime - execution.startTime) / 1000).toFixed(2)
    : null;

  const statusIcon = {
    pending: <Clock className="w-3 h-3 text-slate-400 animate-pulse" />,
    running: <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />,
    completed: <Check className="w-3 h-3 text-green-500" />,
    error: <X className="w-3 h-3 text-red-500" />,
  }[execution.status];

  const statusColors = {
    pending: 'border-slate-300 dark:border-slate-600',
    running: 'border-blue-400 dark:border-blue-500',
    completed: 'border-green-400 dark:border-green-500',
    error: 'border-red-400 dark:border-red-500',
  }[execution.status];

  const bgColors = {
    pending: 'bg-slate-50 dark:bg-slate-800',
    running: 'bg-blue-50 dark:bg-blue-900/20',
    completed: 'bg-green-50 dark:bg-green-900/20',
    error: 'bg-red-50 dark:bg-red-900/20',
  }[execution.status];

  return (
    <div className={`rounded-lg border ${statusColors} ${bgColors} overflow-hidden`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Wrench className="w-3 h-3 text-slate-500 dark:text-slate-400 flex-shrink-0" />
          <span className="font-mono text-xs text-slate-700 dark:text-slate-300 truncate">
            {execution.name}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {duration && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {duration}s
            </span>
          )}
          {statusIcon}
          {isExpanded ? (
            <ChevronUp className="w-3 h-3 text-slate-400" />
          ) : (
            <ChevronDown className="w-3 h-3 text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-slate-200 dark:border-slate-700">
          {/* Arguments */}
          {Object.keys(execution.arguments).length > 0 && (
            <div className="pt-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">
                Arguments
              </span>
              <pre className="text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 rounded p-2 overflow-x-auto max-h-32 overflow-y-auto">
                {JSON.stringify(execution.arguments, null, 2)}
              </pre>
            </div>
          )}

          {/* Result */}
          {execution.result && (
            <div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">
                {execution.isError ? 'Error' : 'Result'}
              </span>
              <pre
                className={`text-xs rounded p-2 overflow-x-auto max-h-48 overflow-y-auto ${
                  execution.isError
                    ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
                    : 'text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900'
                }`}
              >
                {formatResult(execution.result)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Format result for display. Try to parse as JSON and pretty print.
 */
function formatResult(result: string): string {
  try {
    const parsed = JSON.parse(result);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return result;
  }
}
