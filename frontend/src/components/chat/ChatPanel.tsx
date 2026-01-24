import { useState, useEffect, useRef, useCallback } from 'react';
import { X, MessageCircle, RotateCcw, AlertCircle } from 'lucide-react';
import { MessageList } from './MessageList';
import { ChatInput, type ChatInputHandle } from './ChatInput';
import { streamChatMessage } from '../../api/chat';
import type { ChatMessage, ToolExecution, StreamEvent, ToolCall, ToolResult } from '../../types';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  caseContext?: number;
}

export function ChatPanel({ isOpen, onClose, caseContext }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [toolExecutions, setToolExecutions] = useState<ToolExecution[]>([]);
  const [failedMessageContent, setFailedMessageContent] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<ChatInputHandle>(null);

  // Handle escape key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to allow the panel animation to start
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleStreamEvent = useCallback((event: StreamEvent, streamingMessageId: string) => {
    switch (event.type) {
      case 'text':
        // Append text content to the streaming message
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamingMessageId
              ? { ...m, content: m.content + (event.content || '') }
              : m
          )
        );
        break;

      case 'tool_start':
        // Add new tool execution in running state
        // Handle flat format from backend: {type: 'tool_start', id: '...', name: '...'}
        if (event.id && event.name) {
          const toolCall: ToolCall = {
            id: event.id,
            name: event.name,
            arguments: event.arguments || {},
          };
          const newExecution: ToolExecution = {
            id: event.id,
            name: event.name,
            arguments: event.arguments || {},
            status: 'running',
            startTime: Date.now(),
          };
          setToolExecutions((prev) => [...prev, newExecution]);

          // Also track the tool call on the message
          setMessages((prev) =>
            prev.map((m) =>
              m.id === streamingMessageId
                ? { ...m, toolCalls: [...(m.toolCalls || []), toolCall] }
                : m
            )
          );
        }
        break;

      case 'tool_result':
        // Update tool execution with result
        // Handle flat format from backend: {type: 'tool_result', id: '...', result: '...', is_error: false, duration_ms: 123}
        if (event.id) {
          const toolResult: ToolResult = {
            tool_use_id: event.id,
            content: event.result || '',
            is_error: event.is_error || false,
          };

          setToolExecutions((prev) =>
            prev.map((exec) =>
              exec.id === event.id
                ? {
                    ...exec,
                    status: event.is_error ? 'error' : 'completed',
                    result: event.result,
                    isError: event.is_error,
                    endTime: Date.now(),
                  }
                : exec
            )
          );

          // Also track the tool result on the message
          setMessages((prev) =>
            prev.map((m) =>
              m.id === streamingMessageId
                ? { ...m, toolResults: [...(m.toolResults || []), toolResult] }
                : m
            )
          );
        }
        break;

      case 'done':
        // Mark streaming as complete
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamingMessageId
              ? { ...m, isStreaming: false }
              : m
          )
        );
        // Update conversation ID if provided (backend uses conversation_id)
        if (event.conversation_id) {
          setConversationId(event.conversation_id);
        }
        break;

      case 'error':
        // Handle error by updating the message
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamingMessageId
              ? {
                  ...m,
                  isStreaming: false,
                  content: m.content || `Error: ${event.error || 'Unknown error occurred'}`,
                }
              : m
          )
        );
        break;
    }
  }, []);

  const handleSend = async (content: string, isRetry = false) => {
    // Abort any existing stream
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    // Clear any previous error state
    setFailedMessageContent(null);

    // For retry, we need to find and update the existing user message and remove the failed assistant message
    let userMessageId: string;
    let streamingMessageId: string;

    if (isRetry) {
      // Find the last user message with this content (should be the failed one)
      const existingUserMsg = [...messages].reverse().find(m => m.role === 'user' && m.content === content);
      if (existingUserMsg) {
        userMessageId = existingUserMsg.id;
        // Remove the failed assistant message and clear error from user message
        setMessages((prev) => prev
          .filter((m) => !(m.role === 'assistant' && m.error))
          .map((m) => m.id === userMessageId ? { ...m, error: undefined } : m)
        );
      } else {
        userMessageId = crypto.randomUUID();
      }
      streamingMessageId = crypto.randomUUID();
      // Add new streaming message
      const streamingMessage: ChatMessage = {
        id: streamingMessageId,
        role: 'assistant',
        content: '',
        isStreaming: true,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, streamingMessage]);
    } else {
      // Create user message
      userMessageId = crypto.randomUUID();
      const userMessage: ChatMessage = {
        id: userMessageId,
        role: 'user',
        content,
        timestamp: new Date(),
      };

      // Create placeholder assistant message for streaming
      streamingMessageId = crypto.randomUUID();
      const streamingMessage: ChatMessage = {
        id: streamingMessageId,
        role: 'assistant',
        content: '',
        isStreaming: true,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage, streamingMessage]);
    }

    setIsLoading(true);
    setToolExecutions([]);

    try {
      const stream = streamChatMessage({
        message: content,
        conversationId: conversationId ?? undefined,
        caseContext,
      });

      for await (const event of stream) {
        // Check if aborted
        if (abortControllerRef.current?.signal.aborted) {
          break;
        }
        handleStreamEvent(event, streamingMessageId);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      // Store the failed message content for retry
      setFailedMessageContent(content);
      // Mark both user message and assistant message with error
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === userMessageId) {
            return { ...m, error: errorMessage };
          }
          if (m.id === streamingMessageId) {
            return {
              ...m,
              isStreaming: false,
              content: '',
              error: errorMessage,
            };
          }
          return m;
        })
      );
    } finally {
      setIsLoading(false);
      setToolExecutions([]);
    }
  };

  const handleRetry = () => {
    if (failedMessageContent) {
      handleSend(failedMessageContent, true);
    }
  };

  const handleNewConversation = () => {
    // Abort any existing stream
    abortControllerRef.current?.abort();
    setMessages([]);
    setConversationId(null);
    setToolExecutions([]);
    setIsLoading(false);
    setFailedMessageContent(null);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`
          fixed inset-0 bg-black/20 z-40
          transition-opacity duration-300
          ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        onClick={onClose}
      />

      {/* Panel - Full screen on mobile, side drawer on larger screens */}
      <div
        className={`
          fixed z-50
          inset-0 md:inset-auto md:top-0 md:right-0 md:bottom-0
          w-full md:w-[420px] lg:w-[480px]
          bg-white dark:bg-slate-800
          shadow-2xl
          flex flex-col
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 md:py-3 border-b border-slate-200 dark:border-slate-700 safe-area-inset-top">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 md:w-8 md:h-8 rounded-full bg-blue-600 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 md:w-4 md:h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base md:text-sm font-semibold text-slate-900 dark:text-slate-100">
                AI Assistant
              </h2>
              <p className="text-sm md:text-xs text-slate-500 dark:text-slate-400">
                {caseContext ? `Case #${caseContext}` : 'General Chat'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={handleNewConversation}
                className="text-sm md:text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 px-3 py-1.5 md:px-2 md:py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                New chat
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 md:p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              aria-label="Close chat"
            >
              <X className="w-6 h-6 md:w-5 md:h-5" />
            </button>
          </div>
        </div>

        {/* Error Banner with Retry */}
        {failedMessageContent && (
          <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">Message failed to send</span>
            </div>
            <button
              onClick={handleRetry}
              disabled={isLoading}
              className="
                flex items-center gap-1.5 px-3 py-1.5
                text-sm font-medium
                text-red-700 dark:text-red-400
                bg-red-100 dark:bg-red-900/30
                hover:bg-red-200 dark:hover:bg-red-900/50
                rounded-lg transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        )}

        {/* Messages */}
        <MessageList
          messages={messages}
          isLoading={isLoading}
          toolExecutions={toolExecutions}
        />

        {/* Input */}
        <ChatInput ref={inputRef} onSend={handleSend} isLoading={isLoading} />
      </div>
    </>
  );
}
