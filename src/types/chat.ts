/**
 * Chat 타입 정의
 */

export interface ChatState {
  taskType?: string;
  actionPlan?: string;
  currentStep?: string;
  result?: string;
}

export interface InterruptData {
  question: string;
  actionPlan: string;
  taskType: string;
  options: string[];
}

export interface ChatResponse {
  threadId: string;
  status: 'awaiting_approval' | 'completed';
  interruptData?: InterruptData;
  result?: string;
  state: ChatState;
}

export type ChatStatus =
  | 'idle'
  | 'running'
  | 'awaiting_approval'
  | 'completed'
  | 'error';
