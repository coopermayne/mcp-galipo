import { request } from './common';
import type { ChatRequest, ChatResponse } from '../types';

export async function sendChatMessage(req: ChatRequest): Promise<ChatResponse> {
  return request('/chat', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}
