/**
 * LangGraph HITL Workflow 타입 정의
 */

export interface WorkflowState {
  task_type?: string;
  action_plan?: string;
  current_step?: string;
  result?: string;
}

export interface InterruptData {
  question: string;
  action_plan: string;
  task_type: string;
  options: string[];
}

export interface StartWorkflowResponse {
  thread_id: string;
  status: string;
  requires_approval: boolean;
  interrupt_data?: InterruptData;
  state?: WorkflowState;
}

export interface WorkflowStatusResponse {
  thread_id: string;
  status: string;
  requires_approval: boolean;
  interrupt_data?: InterruptData;
  state?: WorkflowState;
}

export interface ResumeWorkflowResponse {
  thread_id: string;
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
