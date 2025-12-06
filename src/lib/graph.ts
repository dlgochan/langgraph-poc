/**
 * LangGraph HITL (Human-in-the-Loop) Workflow - TypeScript
 *
 * Next.js API Routes에서 사용하는 LangGraph.js 워크플로우입니다.
 * interrupt() 함수를 사용하여 사용자 승인이 필요한 지점에서 워크플로우를 중단합니다.
 */

import { StateGraph, START, END, Annotation, interrupt, Command } from '@langchain/langgraph';
import { MemorySaver } from '@langchain/langgraph';

// 상태 스키마 정의
export const WorkflowState = Annotation.Root({
  userMessage: Annotation<string>(),
  taskType: Annotation<string>(),
  actionPlan: Annotation<string>(),
  approved: Annotation<boolean | null>(),
  result: Annotation<string>(),
  currentStep: Annotation<string>(),
});

export type WorkflowStateType = typeof WorkflowState.State;

/**
 * 사용자 요청을 분석하여 작업 유형을 결정합니다.
 */
function analyzeRequest(state: WorkflowStateType): Partial<WorkflowStateType> {
  const userMessage = state.userMessage.toLowerCase();

  let taskType: string;

  if (['삭제', 'delete', 'remove', 'drop'].some((word) => userMessage.includes(word))) {
    taskType = 'destructive';
  } else if (['생성', 'create', '만들', 'add', 'new'].some((word) => userMessage.includes(word))) {
    taskType = 'create';
  } else if (['수정', 'update', '변경', 'modify', 'edit'].some((word) => userMessage.includes(word))) {
    taskType = 'update';
  } else {
    taskType = 'query';
  }

  return {
    taskType,
    currentStep: 'analyzed',
  };
}

/**
 * 분석 결과를 바탕으로 실행 계획을 생성합니다.
 */
function generatePlan(state: WorkflowStateType): Partial<WorkflowStateType> {
  const { taskType, userMessage } = state;

  const plans: Record<string, string> = {
    destructive: `⚠️ 위험한 작업: '${userMessage}'\n\n실행 단계:\n1. 대상 확인\n2. 백업 생성\n3. 삭제 실행\n4. 결과 검증`,
    create: `📝 생성 작업: '${userMessage}'\n\n실행 단계:\n1. 요구사항 검증\n2. 리소스 생성\n3. 초기 설정\n4. 결과 확인`,
    update: `🔄 수정 작업: '${userMessage}'\n\n실행 단계:\n1. 현재 상태 확인\n2. 변경사항 적용\n3. 유효성 검증\n4. 결과 확인`,
    query: `🔍 조회 작업: '${userMessage}'\n\n실행 단계:\n1. 쿼리 구성\n2. 데이터 조회\n3. 결과 포맷팅`,
  };

  return {
    actionPlan: plans[taskType] || '알 수 없는 작업 유형',
    currentStep: 'planned',
  };
}

/**
 * 사용자에게 작업 승인을 요청합니다.
 * interrupt()를 호출하여 워크플로우를 중단하고 사용자 입력을 기다립니다.
 */
function requestApproval(state: WorkflowStateType): Partial<WorkflowStateType> {
  // interrupt()는 워크플로우를 중단하고 사용자 입력을 기다림
  const approvalResponse = interrupt({
    question: '이 작업을 실행하시겠습니까?',
    actionPlan: state.actionPlan,
    taskType: state.taskType,
    options: ['approve', 'reject'],
  });

  // Command(resume=...)로 전달된 사용자 응답
  const approved = (approvalResponse as { decision: string }).decision === 'approve';

  return {
    approved,
    currentStep: 'approval_received',
  };
}

/**
 * 승인된 작업을 실행합니다.
 */
function executeAction(state: WorkflowStateType): Partial<WorkflowStateType> {
  const { taskType } = state;

  const results: Record<string, string> = {
    destructive: '✅ 삭제 작업이 성공적으로 완료되었습니다.',
    create: '✅ 생성 작업이 성공적으로 완료되었습니다.',
    update: '✅ 수정 작업이 성공적으로 완료되었습니다.',
    query: '✅ 조회 결과가 준비되었습니다.',
  };

  return {
    result: results[taskType] || '작업이 완료되었습니다.',
    currentStep: 'executed',
  };
}

/**
 * 사용자가 작업을 거부했을 때 호출됩니다.
 */
function cancelAction(_state: WorkflowStateType): Partial<WorkflowStateType> {
  return {
    result: '❌ 사용자가 작업을 취소했습니다.',
    currentStep: 'cancelled',
  };
}

/**
 * 승인 여부에 따라 다음 노드를 결정합니다.
 */
function routeAfterApproval(state: WorkflowStateType): 'executeAction' | 'cancelAction' {
  return state.approved ? 'executeAction' : 'cancelAction';
}

/**
 * HITL 워크플로우 그래프를 생성합니다.
 */
function createHitlGraph() {
  const builder = new StateGraph(WorkflowState)
    .addNode('analyzeRequest', analyzeRequest)
    .addNode('generatePlan', generatePlan)
    .addNode('requestApproval', requestApproval)
    .addNode('executeAction', executeAction)
    .addNode('cancelAction', cancelAction)
    .addEdge(START, 'analyzeRequest')
    .addEdge('analyzeRequest', 'generatePlan')
    .addEdge('generatePlan', 'requestApproval')
    .addConditionalEdges('requestApproval', routeAfterApproval, {
      executeAction: 'executeAction',
      cancelAction: 'cancelAction',
    })
    .addEdge('executeAction', END)
    .addEdge('cancelAction', END);

  return builder;
}

// 메모리 기반 체크포인터 (서버 재시작 시 초기화됨)
// 실제 운영에서는 PostgreSQL, Redis 등 사용
export const checkpointer = new MemorySaver();

// 컴파일된 그래프
export const graph = createHitlGraph().compile({ checkpointer });

// Command export for resume
export { Command };
