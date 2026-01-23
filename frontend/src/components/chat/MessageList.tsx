import { useEffect, useRef } from 'react';
import { Bot, User } from 'lucide-react';
import { ToolCallIndicator } from './ToolCallIndicator';
import type { ChatMessage, ToolExecution } from '../../types';

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  toolExecutions?: ToolExecution[];
}

export function MessageList({ messages, isLoading, toolExecutions = [] }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, toolExecutions]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center text-slate-500 dark:text-slate-400">
          <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Start a conversation with your AI assistant.</p>
          <p className="text-xs mt-1 opacity-75">Ask questions about your cases, tasks, or anything else.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          toolExecutions={message.isStreaming ? toolExecutions : undefined}
        />
      ))}

      {/* Show loading state when waiting for initial response */}
      {isLoading && !messages.some((m) => m.isStreaming) && (
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
            <Bot className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </div>
          <div className="bg-slate-100 dark:bg-slate-700 rounded-2xl rounded-tl-sm px-4 py-3">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
  toolExecutions?: ToolExecution[];
}

function MessageBubble({ message, toolExecutions }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
        }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Message content */}
      <div className={`flex flex-col gap-2 max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Text content */}
        {(message.content || message.isStreaming) && (
          <div
            className={`rounded-2xl px-4 py-2.5 ${
              isUser
                ? 'bg-blue-600 text-white rounded-tr-sm'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-tl-sm'
            }`}
          >
            <p className="text-sm whitespace-pre-wrap">
              {message.content}
              {message.isStreaming && <StreamingCursor />}
            </p>
          </div>
        )}

        {/* Tool executions during streaming */}
        {toolExecutions && toolExecutions.length > 0 && (
          <div className="w-full space-y-2">
            {toolExecutions.map((execution) => (
              <ToolCallIndicator key={execution.id} execution={execution} />
            ))}
          </div>
        )}

        {/* Completed tool calls (non-streaming messages) */}
        {!message.isStreaming && message.toolCalls && message.toolCalls.length > 0 && (
          <div className="w-full space-y-2">
            {message.toolCalls.map((tool) => (
              <ToolCallIndicator
                key={tool.id}
                execution={{
                  id: tool.id,
                  name: tool.name,
                  arguments: tool.arguments,
                  status: 'completed',
                  result: message.toolResults?.find((r) => r.tool_use_id === tool.id)?.content,
                  isError: message.toolResults?.find((r) => r.tool_use_id === tool.id)?.is_error,
                  startTime: 0,
                  endTime: 0,
                }}
              />
            ))}
          </div>
        )}

        {/* Timestamp */}
        {!message.isStreaming && (
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {formatTime(message.timestamp)}
          </span>
        )}
      </div>
    </div>
  );
}

function StreamingCursor() {
  return (
    <span className="inline-block w-1.5 h-4 ml-0.5 bg-slate-600 dark:bg-slate-300 animate-pulse" />
  );
}

function formatTime(date: Date): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
