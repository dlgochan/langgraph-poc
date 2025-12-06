/**
 * POST /api/chat
 *
 * 호텔 챗봇 API - 메시지 기반 대화
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { graph } from '@/lib/graph';
import { Command } from '@langchain/langgraph';

interface ChatRequest {
  threadId?: string;
  message?: string;
  approved?: boolean; // true: 승인, false: 거부
}

interface ToolCallInfo {
  toolName: string;
  toolArgs: Record<string, unknown>;
  description: string;
  message: string;
}

interface ChatResponse {
  threadId: string;
  status: 'ready' | 'awaiting_approval';
  response?: string;
  toolCall?: ToolCallInfo;
}

/**
 * 메시지 배열에서 마지막 AI 응답 텍스트 추출
 */
function getLastAIResponse(messages: BaseMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg instanceof AIMessage && typeof msg.content === 'string' && msg.content) {
      return msg.content;
    }
  }
  return '';
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { threadId: existingThreadId, message, approved } = body;

    // Case 1: 새 대화 시작 또는 메시지 추가
    if (message) {
      const threadId = existingThreadId || uuidv4();
      const config = { configurable: { thread_id: threadId } };

      // 메시지 추가하고 실행
      await graph.invoke(
        { messages: [new HumanMessage(message)] },
        config
      );

      // 상태 확인
      const state = await graph.getState(config);
      const isInterrupted = state.tasks && state.tasks.length > 0;

      if (isInterrupted) {
        // interrupt 데이터 추출
        let toolCall: ToolCallInfo | undefined;
        for (const task of state.tasks) {
          if (task.interrupts && task.interrupts.length > 0) {
            toolCall = task.interrupts[0].value as ToolCallInfo;
            break;
          }
        }

        return NextResponse.json<ChatResponse>({
          threadId,
          status: 'awaiting_approval',
          toolCall,
        });
      }

      return NextResponse.json<ChatResponse>({
        threadId,
        status: 'ready',
        response: getLastAIResponse(state.values?.messages || []),
      });
    }

    // Case 2: 승인/거부 처리
    if (existingThreadId && approved !== undefined) {
      const config = { configurable: { thread_id: existingThreadId } };

      // 워크플로우 재개
      await graph.invoke(
        new Command({ resume: approved }),
        config
      );

      // 상태 확인
      const state = await graph.getState(config);
      const isInterrupted = state.tasks && state.tasks.length > 0;

      if (isInterrupted) {
        let toolCall: ToolCallInfo | undefined;
        for (const task of state.tasks) {
          if (task.interrupts && task.interrupts.length > 0) {
            toolCall = task.interrupts[0].value as ToolCallInfo;
            break;
          }
        }

        return NextResponse.json<ChatResponse>({
          threadId: existingThreadId,
          status: 'awaiting_approval',
          toolCall,
        });
      }

      return NextResponse.json<ChatResponse>({
        threadId: existingThreadId,
        status: 'ready',
        response: getLastAIResponse(state.values?.messages || []),
      });
    }

    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
