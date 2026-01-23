import { request, API_BASE, ApiError } from './common';
import { getAuthToken, clearAuthToken } from '../context/AuthContext';
import type { ChatRequest, ChatResponse, StreamEvent } from '../types';

export async function sendChatMessage(req: ChatRequest): Promise<ChatResponse> {
  // Convert to snake_case for backend API
  const body = {
    message: req.message,
    conversation_id: req.conversationId,
    case_context: req.caseContext,
  };
  return request('/chat', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Stream chat messages via SSE.
 * Yields StreamEvent objects as they arrive from the server.
 */
export async function* streamChatMessage(req: ChatRequest): AsyncGenerator<StreamEvent> {
  const url = `${API_BASE}/chat/stream`;
  const token = getAuthToken();

  // Convert to snake_case for backend API
  const body = {
    message: req.message,
    conversation_id: req.conversationId,
    case_context: req.caseContext,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearAuthToken();
      window.location.href = '/login';
    }
    const errorText = await response.text();
    let errorMessage = 'Stream connection failed';
    try {
      const errorData = JSON.parse(errorText);
      errorMessage = errorData.error?.message || errorData.detail || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }
    throw new ApiError(errorMessage, 'STREAM_ERROR', response.status);
  }

  if (!response.body) {
    throw new ApiError('Response body is null', 'STREAM_ERROR', 500);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events from buffer
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();

        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith(':')) {
          continue;
        }

        // Parse data lines
        if (trimmed.startsWith('data:')) {
          const jsonStr = trimmed.slice(5).trim();

          if (!jsonStr) {
            continue;
          }

          try {
            const event = JSON.parse(jsonStr) as StreamEvent;
            yield event;

            // Stop if we received done or error
            if (event.type === 'done' || event.type === 'error') {
              return;
            }
          } catch (parseError) {
            console.error('Failed to parse SSE event:', jsonStr, parseError);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
