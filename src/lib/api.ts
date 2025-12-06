/**
 * Chat API 클라이언트
 */

import type { ChatResponse } from '@/types/chat';

class APIError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new APIError(response.status, error.error || 'Request failed');
  }
  return response.json();
}

/**
 * 메시지 전송
 */
export async function sendMessage(
  message: string,
  threadId?: string
): Promise<ChatResponse> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, threadId }),
  });
  return handleResponse<ChatResponse>(response);
}

/**
 * 승인/거부 처리
 */
export async function submitApproval(
  threadId: string,
  approved: boolean
): Promise<ChatResponse> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId, approved }),
  });
  return handleResponse<ChatResponse>(response);
}

export { APIError };
