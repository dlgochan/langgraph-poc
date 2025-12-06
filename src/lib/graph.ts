/**
 * 호텔 챗봇 - LangGraph HITL Agent
 *
 * LLM이 도구를 호출할 때:
 * - 안전한 도구: 바로 실행
 * - 위험한 도구: interrupt로 사용자 승인 요청
 */

import { ChatOpenAI } from '@langchain/openai';
import {
  StateGraph,
  START,
  END,
  Annotation,
  MessagesAnnotation,
  interrupt,
  MemorySaver,
} from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { allTools, isDangerousTool } from './tools';

// 상태 정의
const AgentState = Annotation.Root({
  ...MessagesAnnotation.spec,
  // 승인 대기 중인 도구 호출 정보
  pendingToolCall: Annotation<{
    toolName: string;
    toolArgs: Record<string, unknown>;
    description: string;
  } | null>(),
});

export type AgentStateType = typeof AgentState.State;

// LLM 설정
const llm = new ChatOpenAI({
  modelName: 'gpt-4o-mini',
  temperature: 0,
}).bindTools(allTools);

const SYSTEM_PROMPT = `당신은 친절한 호텔 예약 챗봇입니다.

사용 가능한 기능:
- 객실 검색: 날짜와 인원수로 빈 객실을 찾습니다
- 예약 조회: 예약 번호로 예약 정보를 확인합니다
- 객실 예약: 선택한 객실을 예약합니다
- 예약 취소: 기존 예약을 취소합니다

항상 친절하게 응대하고, 필요한 정보가 부족하면 먼저 물어보세요.
오늘 날짜는 2024년 3월 10일입니다.`;

/**
 * LLM을 호출하여 응답 또는 도구 호출을 결정
 */
async function callModel(state: AgentStateType) {
  const messagesWithSystem = [
    new SystemMessage(SYSTEM_PROMPT),
    ...state.messages,
  ];

  const response = await llm.invoke(messagesWithSystem);

  return { messages: [response] };
}

/**
 * 도구 호출 전 검사 - 위험한 도구면 interrupt
 */
function checkToolCall(state: AgentStateType) {
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;

  if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
    return { pendingToolCall: null };
  }

  const toolCall = lastMessage.tool_calls[0];

  if (isDangerousTool(toolCall.name)) {
    // 위험한 도구 - interrupt로 승인 요청
    const description = toolCall.name === 'bookRoom'
      ? `객실 예약: ${JSON.stringify(toolCall.args)}`
      : `예약 취소: ${JSON.stringify(toolCall.args)}`;

    const approved = interrupt({
      toolName: toolCall.name,
      toolArgs: toolCall.args,
      description,
      message: '이 작업을 진행하시겠습니까?',
    });

    // 거부된 경우
    if (!approved) {
      return {
        messages: [new AIMessage('알겠습니다. 작업을 취소했습니다. 다른 도움이 필요하시면 말씀해주세요.')],
        pendingToolCall: null,
      };
    }
  }

  return { pendingToolCall: null };
}

// 도구 실행 노드
const toolNode = new ToolNode(allTools);

/**
 * 라우팅: 도구 호출 여부에 따라 분기
 */
function shouldContinue(state: AgentStateType): 'tools' | 'end' {
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;

  if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    return 'tools';
  }

  return 'end';
}

/**
 * 그래프 생성
 */
function createAgentGraph() {
  const workflow = new StateGraph(AgentState)
    .addNode('agent', callModel)
    .addNode('checkTool', checkToolCall)
    .addNode('tools', toolNode)
    .addEdge(START, 'agent')
    .addConditionalEdges('agent', shouldContinue, {
      tools: 'checkTool',
      end: END,
    })
    .addEdge('checkTool', 'tools')
    .addEdge('tools', 'agent');

  return workflow;
}

export const checkpointer = new MemorySaver();
export const graph = createAgentGraph().compile({ checkpointer });
