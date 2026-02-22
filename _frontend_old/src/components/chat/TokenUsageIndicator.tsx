import { useState } from 'react';
import { Coins, ChevronDown, ChevronUp } from 'lucide-react';
import type { UsageData } from '../../types';

interface TokenUsageIndicatorProps {
  usage: UsageData;
}

type TabType = 'summary' | 'request' | 'response';

export function TokenUsageIndicator({ usage }: TokenUsageIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('summary');

  const totalTokens = usage.input_tokens + usage.output_tokens;
  const hasCacheData = (usage.cache_read_input_tokens ?? 0) > 0 || (usage.cache_creation_input_tokens ?? 0) > 0;

  // Format number with commas
  const formatNumber = (n: number) => n.toLocaleString();

  return (
    <div className="rounded-lg border border-border bg-bg-hover overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-bg-hover transition-colors"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Coins className="w-3 h-3 text-text-muted flex-shrink-0" />
          <span className="font-mono text-xs text-text-secondary">
            {formatNumber(totalTokens)} tokens
          </span>
          {hasCacheData && usage.cache_read_input_tokens && usage.cache_read_input_tokens > 0 && (
            <span className="text-xs text-green-600 dark:text-green-400">
              ({formatNumber(usage.cache_read_input_tokens)} cached)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isExpanded ? (
            <ChevronUp className="w-3 h-3 text-text-muted" />
          ) : (
            <ChevronDown className="w-3 h-3 text-text-muted" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-border">
          {/* Tabs */}
          <div className="flex border-b border-border">
            {(['summary', 'request', 'response'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  activeTab === tab
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 -mb-px'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="px-3 py-3">
            {activeTab === 'summary' && (
              <SummaryTab usage={usage} formatNumber={formatNumber} />
            )}
            {activeTab === 'request' && (
              <RequestTab usage={usage} />
            )}
            {activeTab === 'response' && (
              <ResponseTab usage={usage} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface TabProps {
  usage: UsageData;
  formatNumber?: (n: number) => string;
}

function SummaryTab({ usage, formatNumber = (n) => n.toLocaleString() }: TabProps) {
  const totalTokens = usage.input_tokens + usage.output_tokens;

  return (
    <div className="space-y-2 text-xs">
      <div className="flex justify-between">
        <span className="text-text-muted">Input tokens</span>
        <span className="font-mono text-text-secondary">
          {formatNumber(usage.input_tokens)}
        </span>
      </div>

      {(usage.cache_read_input_tokens ?? 0) > 0 && (
        <div className="flex justify-between pl-3">
          <span className="text-green-600 dark:text-green-400">Cache read</span>
          <span className="font-mono text-green-600 dark:text-green-400">
            {formatNumber(usage.cache_read_input_tokens!)}
          </span>
        </div>
      )}

      {(usage.cache_creation_input_tokens ?? 0) > 0 && (
        <div className="flex justify-between pl-3">
          <span className="text-amber-600 dark:text-amber-400">Cache creation</span>
          <span className="font-mono text-amber-600 dark:text-amber-400">
            {formatNumber(usage.cache_creation_input_tokens!)}
          </span>
        </div>
      )}

      <div className="flex justify-between">
        <span className="text-text-muted">Output tokens</span>
        <span className="font-mono text-text-secondary">
          {formatNumber(usage.output_tokens)}
        </span>
      </div>

      <div className="flex justify-between pt-2 border-t border-border">
        <span className="font-medium text-text-secondary">Total</span>
        <span className="font-mono font-medium text-text">
          {formatNumber(totalTokens)}
        </span>
      </div>
    </div>
  );
}

function RequestTab({ usage }: TabProps) {
  const [showFullPrompt, setShowFullPrompt] = useState(false);

  if (!usage.request) {
    return <div className="text-xs text-text-muted">No request data available</div>;
  }

  const { system_prompt, messages, tools, tool_count } = usage.request;
  const truncatedPrompt = system_prompt.length > 500 && !showFullPrompt
    ? system_prompt.slice(0, 500) + '...'
    : system_prompt;

  return (
    <div className="space-y-3">
      {/* System prompt */}
      <div>
        <span className="text-xs font-medium text-text-muted block mb-1">
          System Prompt
        </span>
        <pre className="text-xs text-text-secondary bg-bg-surface rounded p-2 overflow-x-auto max-h-32 overflow-y-auto whitespace-pre-wrap">
          {truncatedPrompt}
        </pre>
        {system_prompt.length > 500 && (
          <button
            onClick={() => setShowFullPrompt(!showFullPrompt)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1"
          >
            {showFullPrompt ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>

      {/* Tools */}
      {tools && tools.length > 0 && (
        <div>
          <span className="text-xs font-medium text-text-muted block mb-1">
            Tools ({tool_count})
          </span>
          <div className="flex flex-wrap gap-1">
            {tools.map((tool: string, i: number) => (
              <span
                key={i}
                className="text-xs px-1.5 py-0.5 rounded bg-bg-hover text-text-secondary"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div>
        <span className="text-xs font-medium text-text-muted block mb-1">
          Messages ({messages.length})
        </span>
        <pre className="text-xs text-text-secondary bg-bg-surface rounded p-2 overflow-x-auto max-h-48 overflow-y-auto">
          {JSON.stringify(messages, null, 2)}
        </pre>
      </div>
    </div>
  );
}

function ResponseTab({ usage }: TabProps) {
  if (!usage.response) {
    return <div className="text-xs text-text-muted">No response data available</div>;
  }

  const { content, stop_reason, tool_calls } = usage.response;

  return (
    <div className="space-y-3">
      {/* Stop reason */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-text-muted">
          Stop reason:
        </span>
        <span className="text-xs px-1.5 py-0.5 rounded bg-bg-hover text-text-secondary">
          {stop_reason}
        </span>
      </div>

      {/* Content */}
      {content && (
        <div>
          <span className="text-xs font-medium text-text-muted block mb-1">
            Content
          </span>
          <pre className="text-xs text-text-secondary bg-bg-surface rounded p-2 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
            {content}
          </pre>
        </div>
      )}

      {/* Tool calls */}
      {tool_calls && tool_calls.length > 0 && (
        <div>
          <span className="text-xs font-medium text-text-muted block mb-1">
            Tool Calls ({tool_calls.length})
          </span>
          <pre className="text-xs text-text-secondary bg-bg-surface rounded p-2 overflow-x-auto max-h-48 overflow-y-auto">
            {JSON.stringify(tool_calls, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
