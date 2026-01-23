/**
 * Shared types for the chat feature.
 *
 * These types mirror the backend types in services/chat/types.py
 */

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  tool_use_id: string;
  content: string;
  is_error: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  isStreaming?: boolean;
  timestamp: Date;
  /** Error state for failed messages - contains error message if send failed */
  error?: string;
}

export interface ChatRequest {
  message: string;
  conversationId?: string;
  caseContext?: number;
}

export interface ChatResponse {
  content: string;
  conversation_id: string;
  tool_calls?: ToolCall[];
  finished: boolean;
}

// SSE Event types for streaming
export type StreamEventType = 'text' | 'tool_start' | 'tool_result' | 'done' | 'error';

export interface StreamEvent {
  type: StreamEventType;
  // For 'text' events
  content?: string;
  // For 'tool_start' and 'tool_result' events (flat structure from backend)
  id?: string;
  name?: string;
  arguments?: Record<string, unknown>;
  result?: string;
  is_error?: boolean;
  duration_ms?: number;
  // For 'done' events
  conversation_id?: string;
  tool_calls?: ToolCall[];
  // For 'error' events
  error?: string;
  // Legacy nested format (kept for compatibility)
  toolCall?: ToolCall;
  toolResult?: ToolResult;
  conversationId?: string;
}

// Tool execution status for UI
export type ToolStatus = 'pending' | 'running' | 'completed' | 'error';

export interface ToolExecution {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  status: ToolStatus;
  result?: string;
  isError?: boolean;
  startTime: number;
  endTime?: number;
}

// Conversation management
export interface Conversation {
  id: string;
  messages: ChatMessage[];
  caseContext?: number;
  createdAt: Date;
  updatedAt: Date;
}
