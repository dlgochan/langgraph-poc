/**
 * LangGraph HITL API 클라이언트
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
 * 통합 Chat API
 * - message만 전달: 새 워크플로우 시작
 * - threadId + decision 전달: 워크플로우 재개
 */
export async function chat(params: {
  message?: string;
  threadId?: string;
  decision?: 'approve' | 'reject';
}): Promise<ChatResponse> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  return handleResponse<ChatResponse>(response);
}

export { APIError };
