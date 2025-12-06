/**
 * 호텔 챗봇 - LangGraph HITL Agent
 *
 * LLM이 도구를 호출할 때:
 * - 안전한 도구: 바로 실행
 * - 위험한 도구: interrupt로 사용자 승인 요청
 */

import { ChatAnthropic } from '@langchain/anthropic';
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
import { AIMessage, SystemMessage } from '@langchain/core/messages';
import { allTools, isDangerousTool } from './tools';

// 상태 정의
const AgentState = Annotation.Root({
  ...MessagesAnnotation.spec,
  pendingToolCall: Annotation<{
    toolName: string;
    toolArgs: Record<string, unknown>;
    description: string;
  } | null>(),
});

export type AgentStateType = typeof AgentState.State;

// LLM lazy 초기화 (빌드 타임에는 생성하지 않음)
let llm: ReturnType<typeof ChatAnthropic.prototype.bindTools> | null = null;

function getLLM() {
  if (!llm) {
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY 또는 CLAUDE_API_KEY 환경변수가 필요합니다');
    }
    llm = new ChatAnthropic({
      modelName: 'claude-sonnet-4-20250514',
      temperature: 0,
      anthropicApiKey: apiKey,
    }).bindTools(allTools);
  }
  return llm;
}

const SYSTEM_PROMPT = `당신은 친절한 호텔 예약 챗봇입니다.

사용 가능한 기능:
- 객실 검색: 날짜와 인원수로 빈 객실을 찾습니다
- 예약 조회: 예약 번호로 예약 정보를 확인합니다
- 객실 예약: 선택한 객실을 예약합니다
- 예약 취소: 기존 예약을 취소합니다

항상 친절하게 응대하고, 필요한 정보가 부족하면 먼저 물어보세요.
오늘 날짜는 2024년 3월 10일입니다.`;

async function callModel(state: AgentStateType) {
  const messagesWithSystem = [
    new SystemMessage(SYSTEM_PROMPT),
    ...state.messages,
  ];

  const response = await getLLM().invoke(messagesWithSystem);

  return { messages: [response] };
}

function checkToolCall(state: AgentStateType) {
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;

  if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
    return { pendingToolCall: null };
  }

  const toolCall = lastMessage.tool_calls[0];

  if (isDangerousTool(toolCall.name)) {
    const description = toolCall.name === 'bookRoom'
      ? `객실 예약: ${JSON.stringify(toolCall.args)}`
      : `예약 취소: ${JSON.stringify(toolCall.args)}`;

    const approved = interrupt({
      toolName: toolCall.name,
      toolArgs: toolCall.args,
      description,
      message: '이 작업을 진행하시겠습니까?',
    });

    if (!approved) {
      return {
        messages: [new AIMessage('알겠습니다. 작업을 취소했습니다. 다른 도움이 필요하시면 말씀해주세요.')],
        pendingToolCall: null,
      };
    }
  }

  return { pendingToolCall: null };
}

const toolNode = new ToolNode(allTools);

function shouldContinue(state: AgentStateType): 'tools' | 'end' {
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;

  if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    return 'tools';
  }

  return 'end';
}

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
