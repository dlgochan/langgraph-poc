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

export interface StartWorkflowResponse {
  threadId: string;
  status: string;
  requiresApproval: boolean;
  interruptData?: InterruptData;
  state?: WorkflowState;
}

export interface WorkflowStatusResponse {
  threadId: string;
  status: string;
  requiresApproval: boolean;
  interruptData?: InterruptData;
  state?: WorkflowState;
}

export interface ResumeWorkflowResponse {
  threadId: string;
  status: string;
  result?: string;
  state?: WorkflowState;
}

export type WorkflowStatus =
  | 'idle'
  | 'running'
  | 'awaiting_approval'
  | 'completed'
  | 'error';
