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

// SSE Event types for streaming (Phase 2)
export type StreamEventType = 'text' | 'tool_use' | 'tool_result' | 'done' | 'error';

export interface StreamEvent {
  type: StreamEventType;
  content?: string;
  toolCall?: ToolCall;
  toolResult?: ToolResult;
  error?: string;
}

// Conversation management
export interface Conversation {
  id: string;
  messages: ChatMessage[];
  caseContext?: number;
  createdAt: Date;
  updatedAt: Date;
}
