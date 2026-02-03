import { useState } from 'react';
import { Wrench, Check, X, ChevronDown, ChevronUp, Loader2, Clock } from 'lucide-react';
import { ToolResultRenderer, hasInteractiveResult } from './ToolResultRenderer';
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
    pending: <Clock className="w-3 h-3 text-text-muted animate-pulse" />,
    running: <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />,
    completed: <Check className="w-3 h-3 text-green-500" />,
    error: <X className="w-3 h-3 text-red-500" />,
  }[execution.status];

  const statusColors = {
    pending: 'border-border',
    running: 'border-blue-400',
    completed: 'border-green-400',
    error: 'border-red-400',
  }[execution.status];

  const bgColors = {
    pending: 'bg-bg-hover',
    running: 'bg-blue-50 dark:bg-blue-900/20',
    completed: 'bg-green-50 dark:bg-green-900/20',
    error: 'bg-red-50 dark:bg-red-900/20',
  }[execution.status];

  // Check if this tool has an interactive result to display prominently
  const showInteractiveResult =
    execution.status === 'completed' &&
    execution.result &&
    !execution.isError &&
    hasInteractiveResult(execution.name, execution.result, execution.isError);

  return (
    <div className="space-y-2">
      {/* Interactive result shown prominently (outside the collapsible) */}
      {showInteractiveResult && execution.result && (
        <ToolResultRenderer
          toolName={execution.name}
          result={execution.result}
          isError={execution.isError}
        />
      )}

      {/* Collapsible tool details header */}
      <div className={`rounded-lg border ${statusColors} ${bgColors} overflow-hidden`}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Wrench className="w-3 h-3 text-text-muted flex-shrink-0" />
            <span className="font-mono text-xs text-text-secondary truncate">
              {execution.name}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {duration && (
              <span className="text-xs text-text-muted">
                {duration}s
              </span>
            )}
            {statusIcon}
            {isExpanded ? (
              <ChevronUp className="w-3 h-3 text-text-muted" />
            ) : (
              <ChevronDown className="w-3 h-3 text-text-muted" />
            )}
          </div>
        </button>

        {/* Expanded content - arguments and raw result for debugging */}
        {isExpanded && (
          <div className="px-3 pb-3 space-y-2 border-t border-border">
            {/* Arguments */}
            {Object.keys(execution.arguments).length > 0 && (
              <div className="pt-2">
                <span className="text-xs font-medium text-text-muted block mb-1">
                  Arguments
                </span>
                <pre className="text-xs text-text-secondary bg-bg-surface rounded p-2 overflow-x-auto max-h-32 overflow-y-auto">
                  {JSON.stringify(execution.arguments, null, 2)}
                </pre>
              </div>
            )}

            {/* Result - show JSON for debugging (even if interactive result shown above) */}
            {execution.result && (
              <div>
                <span className="text-xs font-medium text-text-muted block mb-1">
                  {execution.isError ? 'Error' : 'Raw Result'}
                </span>
                <ToolResultRenderer
                  toolName={execution.name}
                  result={execution.result}
                  isError={execution.isError}
                  mode="json"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
