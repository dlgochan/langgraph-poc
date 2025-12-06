/**
 * LangGraph HITL (Human-in-the-Loop) Workflow - TypeScript
 *
 * Next.js API Routes에서 사용하는 LangGraph.js 워크플로우입니다.
 * interrupt() 함수를 사용하여 사용자 승인이 필요한 지점에서 워크플로우를 중단합니다.
 */

import { StateGraph, START, END, Annotation, interrupt, Command } from '@langchain/langgraph';
import { MemorySaver } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';

// OpenAI LLM 인스턴스 (OPENAI_API_KEY 환경변수 사용)
const llm = new ChatOpenAI({
  modelName: 'gpt-4o-mini',
  temperature: 0.7,
});

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
 * OpenAI LLM을 사용하여 의도를 파악합니다.
 */
async function analyzeRequest(state: WorkflowStateType): Promise<Partial<WorkflowStateType>> {
  const userMessage = state.userMessage;

  const response = await llm.invoke([
    {
      role: 'system',
      content: `당신은 사용자 요청을 분석하는 AI입니다.
사용자의 요청을 분석하여 다음 중 하나의 작업 유형을 반환하세요:
- destructive: 삭제, 제거, 드롭 등 위험한 작업
- create: 생성, 만들기, 추가 등 새로운 것을 만드는 작업
- update: 수정, 변경, 업데이트 등 기존 것을 바꾸는 작업
- query: 조회, 검색, 확인 등 정보를 가져오는 작업

반드시 위 4가지 중 하나만 답하세요.`,
    },
    {
      role: 'user',
      content: userMessage,
    },
  ]);

  const taskType = response.content.toString().toLowerCase().trim();
  const validTypes = ['destructive', 'create', 'update', 'query'];
  const finalTaskType = validTypes.includes(taskType) ? taskType : 'query';

  return {
    taskType: finalTaskType,
    currentStep: 'analyzed',
  };
}

/**
 * 분석 결과를 바탕으로 실행 계획을 생성합니다.
 * OpenAI LLM을 사용하여 상세한 실행 계획을 생성합니다.
 */
async function generatePlan(state: WorkflowStateType): Promise<Partial<WorkflowStateType>> {
  const { taskType, userMessage } = state;

  const taskTypeEmoji: Record<string, string> = {
    destructive: '⚠️ 위험한 작업',
    create: '📝 생성 작업',
    update: '🔄 수정 작업',
    query: '🔍 조회 작업',
  };

  const response = await llm.invoke([
    {
      role: 'system',
      content: `당신은 작업 계획을 세우는 AI입니다.
사용자의 요청에 대한 실행 계획을 상세하게 작성하세요.
계획은 단계별로 나누어 작성하고, 각 단계는 번호로 시작하세요.
한국어로 작성하세요.`,
    },
    {
      role: 'user',
      content: `작업 유형: ${taskType}\n사용자 요청: ${userMessage}\n\n이 작업을 수행하기 위한 실행 계획을 작성해주세요.`,
    },
  ]);

  const plan = `${taskTypeEmoji[taskType] || '📋 작업'}: '${userMessage}'\n\n${response.content.toString()}`;

  return {
    actionPlan: plan,
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
