import { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X, MessageCircle, RotateCcw, AlertCircle } from 'lucide-react';
import { MessageList } from './MessageList';
import { ChatInput, type ChatInputHandle } from './ChatInput';
import { ChatHomeScreen } from './ChatHomeScreen';
import { streamChatMessage, getChatInfo } from '../../api/chat';
import type { ChatMessage, ToolExecution, StreamEvent, ToolCall, ToolResult } from '../../types';
import { type DashboardPreset, type PresetId, type CasePreset, type CasePresetId, type ActionStarter, type ChatMode } from '../../config/chatModes';

// Map mutation tools to the query keys they affect
const MUTATION_TOOL_QUERIES: Record<string, string[][]> = {
  manage_task: [['tasks'], ['case']],
  manage_event: [['events'], ['case'], ['calendar']],
  manage_case: [['cases'], ['case'], ['stats']],
  manage_person: [['persons'], ['case']],
  manage_case_role: [['persons'], ['case']],
  manage_note: [['notes'], ['case']],
  manage_proceeding: [['proceedings'], ['case']],
  manage_activity: [['activities'], ['case']],
};

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  caseContext?: number;
}

export function ChatPanel({ isOpen, onClose, caseContext }: ChatPanelProps) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [toolExecutions, setToolExecutions] = useState<ToolExecution[]>([]);
  const [failedMessageContent, setFailedMessageContent] = useState<string | null>(null);
  const [modelName, setModelName] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<PresetId | CasePresetId | null>(null);
  const [activeMode, setActiveMode] = useState<ChatMode | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<ChatInputHandle>(null);

  // Determine if we should show the home screen
  const showHomeScreen = messages.length === 0;

  // Fetch chat info (model name) on mount
  useEffect(() => {
    getChatInfo()
      .then((info) => setModelName(info.model))
      .catch(() => setModelName(null)); // Fail silently
  }, []);

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

  // Focus input after AI finishes responding in action mode
  useEffect(() => {
    if (activeMode && !isLoading && messages.length > 0) {
      // Small delay to ensure input is rendered
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [activeMode, isLoading, messages.length]);

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
        // Handle flat format from backend: {type: 'tool_result', id: '...', name: '...', result: '...', is_error: false, duration_ms: 123}
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

          // Invalidate queries if this was a successful mutation tool
          if (!event.is_error && event.name) {
            const queriesToInvalidate = MUTATION_TOOL_QUERIES[event.name];
            if (queriesToInvalidate) {
              queriesToInvalidate.forEach((queryKey) => {
                queryClient.invalidateQueries({ queryKey });
              });
            }
          }
        }
        break;

      case 'usage':
        // Update message with token usage data
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamingMessageId
              ? {
                  ...m,
                  usage: {
                    input_tokens: event.input_tokens || 0,
                    output_tokens: event.output_tokens || 0,
                    cache_read_input_tokens: event.cache_read_input_tokens,
                    cache_creation_input_tokens: event.cache_creation_input_tokens,
                    request: event.request,
                    response: event.response,
                  },
                }
              : m
          )
        );
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
  }, [queryClient]);

  const handleSend = async (content: string, isRetry = false, presetOverride?: PresetId | CasePresetId, modeOverride?: ChatMode) => {
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
      const presetToUse = presetOverride ?? activePreset ?? undefined;
      const modeToUse = modeOverride ?? activeMode ?? undefined;
      const stream = streamChatMessage({
        message: content,
        conversationId: conversationId ?? undefined,
        caseContext,
        preset: presetToUse,
        mode: modeToUse,
      });
      // Clear active preset after first use (data is already sent)
      if (presetToUse) {
        setActivePreset(null);
      }

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
    setActivePreset(null);
    setActiveMode(null);
  };

  const handleSendPreset = (preset: DashboardPreset) => {
    // Send a simple message - the backend will inject the preset data
    handleSend(preset.description, false, preset.id);
  };

  const handleSendCasePreset = (preset: CasePreset) => {
    // Send a simple message - the backend will inject the case-specific data
    handleSend(preset.description, false, preset.id);
  };

  const handleSendActionStarter = (starter: ActionStarter) => {
    // Set the mode for tool filtering and send the initial message
    setActiveMode(starter.mode);
    handleSend(starter.initialMessage, false, undefined, starter.mode);
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
          w-full md:w-[600px] lg:w-[700px] xl:w-[800px]
          bg-bg-surface
          shadow-2xl
          flex flex-col
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 md:py-3 border-b border-border safe-area-inset-top">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 md:w-8 md:h-8 rounded-full bg-blue-600 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 md:w-4 md:h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base md:text-sm font-semibold text-text">
                AI Assistant
              </h2>
              <p className="text-sm md:text-xs text-text-muted">
                {caseContext ? `Case #${caseContext}` : 'General'}
                {activeMode && (
                  <span className="ml-1.5 text-blue-600 font-medium">
                    · {activeMode.charAt(0).toUpperCase() + activeMode.slice(1)} Mode
                  </span>
                )}
                {modelName && !activeMode && <span className="ml-1.5 opacity-70">· {modelName}</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={handleNewConversation}
                className="text-sm md:text-xs text-text-muted hover:text-text px-3 py-1.5 md:px-2 md:py-1 rounded hover:bg-bg-hover transition-colors"
              >
                New chat
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 md:p-1.5 text-text-muted hover:text-text rounded-lg hover:bg-bg-hover transition-colors"
              aria-label="Close chat"
            >
              <X className="w-6 h-6 md:w-5 md:h-5" />
            </button>
          </div>
        </div>

        {/* Error Banner with Retry */}
        {failedMessageContent && (
          <div className="px-4 py-3 bg-red-50 border-b border-red-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">Message failed to send</span>
            </div>
            <button
              onClick={handleRetry}
              disabled={isLoading}
              className="
                flex items-center gap-1.5 px-3 py-1.5
                text-sm font-medium
                text-red-700
                bg-red-100
                hover:bg-red-200
                rounded-lg transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        )}

        {/* Content area - either home screen or messages */}
        {showHomeScreen ? (
          <ChatHomeScreen
            caseContext={caseContext}
            onSendPreset={handleSendPreset}
            onSendCasePreset={handleSendCasePreset}
            onSendActionStarter={handleSendActionStarter}
          />
        ) : (
          <>
            {/* Messages */}
            <MessageList
              messages={messages}
              isLoading={isLoading}
              toolExecutions={toolExecutions}
            />

            {/* Input - enabled when in an action mode */}
            {activeMode && (
              <ChatInput ref={inputRef} onSend={handleSend} isLoading={isLoading} />
            )}
          </>
        )}
      </div>
    </>
  );
}
