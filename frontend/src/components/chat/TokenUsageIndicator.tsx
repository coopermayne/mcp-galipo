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
    <div className="rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Coins className="w-3 h-3 text-slate-500 dark:text-slate-400 flex-shrink-0" />
          <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
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
            <ChevronUp className="w-3 h-3 text-slate-400" />
          ) : (
            <ChevronDown className="w-3 h-3 text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-slate-200 dark:border-slate-700">
          {/* Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-700">
            {(['summary', 'request', 'response'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  activeTab === tab
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 -mb-px'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
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
        <span className="text-slate-500 dark:text-slate-400">Input tokens</span>
        <span className="font-mono text-slate-700 dark:text-slate-300">
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
        <span className="text-slate-500 dark:text-slate-400">Output tokens</span>
        <span className="font-mono text-slate-700 dark:text-slate-300">
          {formatNumber(usage.output_tokens)}
        </span>
      </div>

      <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
        <span className="font-medium text-slate-700 dark:text-slate-300">Total</span>
        <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
          {formatNumber(totalTokens)}
        </span>
      </div>
    </div>
  );
}

function RequestTab({ usage }: TabProps) {
  const [showFullPrompt, setShowFullPrompt] = useState(false);

  if (!usage.request) {
    return <div className="text-xs text-slate-500">No request data available</div>;
  }

  const { system_prompt, messages, tools, tool_count } = usage.request;
  const truncatedPrompt = system_prompt.length > 500 && !showFullPrompt
    ? system_prompt.slice(0, 500) + '...'
    : system_prompt;

  return (
    <div className="space-y-3">
      {/* System prompt */}
      <div>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">
          System Prompt
        </span>
        <pre className="text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 rounded p-2 overflow-x-auto max-h-32 overflow-y-auto whitespace-pre-wrap">
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
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">
            Tools ({tool_count})
          </span>
          <div className="flex flex-wrap gap-1">
            {tools.map((tool: string, i: number) => (
              <span
                key={i}
                className="text-xs px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">
          Messages ({messages.length})
        </span>
        <pre className="text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 rounded p-2 overflow-x-auto max-h-48 overflow-y-auto">
          {JSON.stringify(messages, null, 2)}
        </pre>
      </div>
    </div>
  );
}

function ResponseTab({ usage }: TabProps) {
  if (!usage.response) {
    return <div className="text-xs text-slate-500">No response data available</div>;
  }

  const { content, stop_reason, tool_calls } = usage.response;

  return (
    <div className="space-y-3">
      {/* Stop reason */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Stop reason:
        </span>
        <span className="text-xs px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
          {stop_reason}
        </span>
      </div>

      {/* Content */}
      {content && (
        <div>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">
            Content
          </span>
          <pre className="text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 rounded p-2 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
            {content}
          </pre>
        </div>
      )}

      {/* Tool calls */}
      {tool_calls && tool_calls.length > 0 && (
        <div>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">
            Tool Calls ({tool_calls.length})
          </span>
          <pre className="text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 rounded p-2 overflow-x-auto max-h-48 overflow-y-auto">
            {JSON.stringify(tool_calls, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
