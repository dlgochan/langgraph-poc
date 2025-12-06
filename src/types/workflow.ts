/**
 * LangGraph HITL Workflow 타입 정의
 */

export interface WorkflowState {
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

/**
 * 통합 Chat API 응답 타입
 */
export interface ChatResponse {
  threadId: string;
  status: 'awaiting_approval' | 'completed';
  interruptData?: InterruptData;
  result?: string;
  state: WorkflowState;
}

export type WorkflowStatus =
  | 'idle'
  | 'running'
  | 'awaiting_approval'
  | 'completed'
  | 'error';
