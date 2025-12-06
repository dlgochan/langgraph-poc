/**
 * LangGraph HITL API 클라이언트
 */

import type {
  StartWorkflowResponse,
  WorkflowStatusResponse,
  ResumeWorkflowResponse,
} from '@/types/workflow';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new APIError(response.status, error.detail || 'Request failed');
  }
  return response.json();
}

/**
 * 새 워크플로우를 시작합니다.
 */
export async function startWorkflow(message: string): Promise<StartWorkflowResponse> {
  const response = await fetch(`${API_BASE_URL}/api/workflow/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message }),
  });

  return handleResponse<StartWorkflowResponse>(response);
}

/**
 * 워크플로우 상태를 조회합니다.
 */
export async function getWorkflowStatus(threadId: string): Promise<WorkflowStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/api/workflow/${threadId}/status`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return handleResponse<WorkflowStatusResponse>(response);
}

/**
 * 중단된 워크플로우를 재개합니다.
 */
export async function resumeWorkflow(
  threadId: string,
  decision: 'approve' | 'reject'
): Promise<ResumeWorkflowResponse> {
  const response = await fetch(`${API_BASE_URL}/api/workflow/${threadId}/resume`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ decision }),
  });

  return handleResponse<ResumeWorkflowResponse>(response);
}

export { APIError };
