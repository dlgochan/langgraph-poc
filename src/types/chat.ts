/**
 * Chat 타입 정의
 */

export interface ToolCallInfo {
  toolName: string;
  toolArgs: Record<string, unknown>;
  description: string;
  message: string;
}

export interface ChatResponse {
  threadId: string;
  status: 'ready' | 'awaiting_approval';
  response?: string;
  toolCall?: ToolCallInfo;
}

export type ChatStatus =
  | 'idle'
  | 'loading'
  | 'awaiting_approval'
  | 'ready'
  | 'error';
