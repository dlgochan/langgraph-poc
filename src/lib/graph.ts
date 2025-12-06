/**
 * LangGraph HITL (Human-in-the-Loop) Workflow - TypeScript
 *
 * Next.js API Routes에서 사용하는 LangGraph.js 워크플로우입니다.
 * interrupt() 함수를 사용하여 사용자 승인이 필요한 지점에서 워크플로우를 중단합니다.
 */

import { StateGraph, START, END, Annotation, interrupt, Command } from '@langchain/langgraph';
import { MemorySaver } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { AIMessage } from '@langchain/core/messages';

// ===== Tool 정의 =====

// 계산기 Tool
const calculatorTool = tool(
  async ({ expression }) => {
    try {
      // 간단한 수식 계산 (실제 운영에서는 더 안전한 방법 사용)
      const result = Function(`"use strict"; return (${expression})`)();
      return `계산 결과: ${expression} = ${result}`;
    } catch {
      return `계산 오류: "${expression}"는 유효한 수식이 아닙니다.`;
    }
  },
  {
    name: 'calculator',
    description: '수학 계산을 수행합니다. 덧셈, 뺄셈, 곱셈, 나눗셈 등의 수식을 계산할 수 있습니다.',
    schema: z.object({
      expression: z.string().describe('계산할 수식 (예: "2 + 3 * 4")'),
    }),
  }
);

// 현재 시간 조회 Tool
const getCurrentTimeTool = tool(
  async () => {
    const now = new Date();
    return `현재 시간: ${now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`;
  },
  {
    name: 'get_current_time',
    description: '현재 날짜와 시간을 조회합니다.',
    schema: z.object({}),
  }
);

// 검색 Tool (시뮬레이션)
const searchTool = tool(
  async ({ query }) => {
    // 실제로는 외부 API 호출
    return `"${query}"에 대한 검색 결과:\n1. ${query} 관련 문서 1\n2. ${query} 관련 문서 2\n3. ${query} 관련 문서 3`;
  },
  {
    name: 'search',
    description: '정보를 검색합니다. 질문이나 키워드로 관련 정보를 찾을 수 있습니다.',
    schema: z.object({
      query: z.string().describe('검색할 질문이나 키워드'),
    }),
  }
);

// 데이터 저장 Tool (시뮬레이션)
const saveDataTool = tool(
  async ({ key, value }) => {
    // 실제로는 DB에 저장
    return `데이터 저장 완료: "${key}" = "${value}"`;
  },
  {
    name: 'save_data',
    description: '데이터를 저장합니다.',
    schema: z.object({
      key: z.string().describe('저장할 데이터의 키'),
      value: z.string().describe('저장할 데이터의 값'),
    }),
  }
);

// 데이터 삭제 Tool (시뮬레이션)
const deleteDataTool = tool(
  async ({ key }) => {
    // 실제로는 DB에서 삭제
    return `데이터 삭제 완료: "${key}"`;
  },
  {
    name: 'delete_data',
    description: '데이터를 삭제합니다.',
    schema: z.object({
      key: z.string().describe('삭제할 데이터의 키'),
    }),
  }
);

// 모든 Tool 목록
const tools = [calculatorTool, getCurrentTimeTool, searchTool, saveDataTool, deleteDataTool];

// OpenAI LLM 인스턴스 (Tool 바인딩 포함)
const llm = new ChatOpenAI({
  modelName: 'gpt-4o-mini',
  temperature: 0.7,
});

// Tool이 바인딩된 LLM
const llmWithTools = llm.bindTools(tools);

// 상태 스키마 정의
export const WorkflowState = Annotation.Root({
  userMessage: Annotation<string>(),
  taskType: Annotation<string>(),
  actionPlan: Annotation<string>(),
  approved: Annotation<boolean | null>(),
  result: Annotation<string>(),
  currentStep: Annotation<string>(),
  // Tool 호출을 위한 메시지 히스토리
  messages: Annotation<AIMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
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
 * Tool을 사용하여 실제 작업을 수행합니다.
 */
async function executeAction(state: WorkflowStateType): Promise<Partial<WorkflowStateType>> {
  const { userMessage, actionPlan } = state;

  // LLM에게 Tool을 사용하여 작업을 수행하도록 요청
  const response = await llmWithTools.invoke([
    {
      role: 'system',
      content: `당신은 사용자의 요청을 수행하는 AI 어시스턴트입니다.
주어진 Tool들을 사용하여 작업을 완료하세요.
사용 가능한 Tool: calculator, get_current_time, search, save_data, delete_data

작업 계획:
${actionPlan}`,
    },
    {
      role: 'user',
      content: userMessage,
    },
  ]);

  // Tool 호출이 있는 경우 실행
  if (response.tool_calls && response.tool_calls.length > 0) {
    const toolResults: string[] = [];

    for (const toolCall of response.tool_calls) {
      const toolName = toolCall.name;
      const toolArgs = toolCall.args as Record<string, string>;

      // Tool 이름에 따라 실행
      let result: string;
      switch (toolName) {
        case 'calculator':
          result = await calculatorTool.invoke({ expression: toolArgs.expression });
          break;
        case 'get_current_time':
          result = await getCurrentTimeTool.invoke({});
          break;
        case 'search':
          result = await searchTool.invoke({ query: toolArgs.query });
          break;
        case 'save_data':
          result = await saveDataTool.invoke({ key: toolArgs.key, value: toolArgs.value });
          break;
        case 'delete_data':
          result = await deleteDataTool.invoke({ key: toolArgs.key });
          break;
        default:
          result = `알 수 없는 Tool: ${toolName}`;
      }
      toolResults.push(`[${toolName}] ${result}`);
    }

    return {
      result: `✅ 작업 완료!\n\n${toolResults.join('\n')}`,
      currentStep: 'executed',
      messages: [response],
    };
  }

  // Tool 호출이 없는 경우 LLM 응답 반환
  return {
    result: `✅ ${response.content}`,
    currentStep: 'executed',
    messages: [response],
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
