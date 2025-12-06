/**
 * POST /api/chat
 *
 * 통합 Chat API - 워크플로우 시작과 재개를 하나의 엔드포인트로 처리
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { graph, Command, WorkflowStateType } from '@/lib/graph';

interface ChatRequest {
  threadId?: string;
  message?: string;
  decision?: 'approve' | 'reject';
}

interface ChatResponse {
  threadId: string;
  status: 'awaiting_approval' | 'completed';
  interruptData?: {
    question: string;
    actionPlan: string;
    taskType: string;
    options: string[];
  };
  result?: string;
  state: {
    taskType?: string;
    actionPlan?: string;
    currentStep?: string;
    result?: string;
  };
}

/**
 * 상태 스냅샷에서 interrupt 데이터와 응답을 추출
 */
async function buildResponse(
  threadId: string,
  config: { configurable: { thread_id: string } }
): Promise<ChatResponse> {
  const stateSnapshot = await graph.getState(config);
  const isInterrupted = stateSnapshot.tasks && stateSnapshot.tasks.length > 0;

  if (isInterrupted) {
    // interrupt 데이터 추출
    let interruptData = null;
    for (const task of stateSnapshot.tasks) {
      if (task.interrupts && task.interrupts.length > 0) {
        interruptData = task.interrupts[0].value;
        break;
      }
    }

    return {
      threadId,
      status: 'awaiting_approval',
      interruptData,
      state: {
        taskType: stateSnapshot.values?.taskType,
        actionPlan: stateSnapshot.values?.actionPlan,
        currentStep: stateSnapshot.values?.currentStep,
      },
    };
  }

  // 완료된 경우
  return {
    threadId,
    status: 'completed',
    result: stateSnapshot.values?.result,
    state: {
      taskType: stateSnapshot.values?.taskType,
      actionPlan: stateSnapshot.values?.actionPlan,
      currentStep: stateSnapshot.values?.currentStep,
      result: stateSnapshot.values?.result,
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { threadId: existingThreadId, message, decision } = body;

    // Case 1: 새 워크플로우 시작 (message만 있음)
    if (message && !existingThreadId) {
      const threadId = uuidv4();
      const config = { configurable: { thread_id: threadId } };

      const initialState: Partial<WorkflowStateType> = {
        userMessage: message,
        taskType: '',
        actionPlan: '',
        approved: null,
        result: '',
        currentStep: 'started',
      };

      await graph.invoke(initialState, config);
      return NextResponse.json(await buildResponse(threadId, config));
    }

    // Case 2: 워크플로우 재개 (threadId + decision)
    if (existingThreadId && decision) {
      if (!['approve', 'reject'].includes(decision)) {
        return NextResponse.json(
          { error: 'decision must be "approve" or "reject"' },
          { status: 400 }
        );
      }

      const config = { configurable: { thread_id: existingThreadId } };

      // 현재 상태 확인
      const stateSnapshot = await graph.getState(config);

      if (!stateSnapshot.values || Object.keys(stateSnapshot.values).length === 0) {
        return NextResponse.json(
          { error: 'Workflow not found' },
          { status: 404 }
        );
      }

      if (!stateSnapshot.tasks || stateSnapshot.tasks.length === 0) {
        return NextResponse.json(
          { error: 'Workflow is not waiting for approval' },
          { status: 400 }
        );
      }

      // 워크플로우 재개
      await graph.invoke(new Command({ resume: { decision } }), config);
      return NextResponse.json(await buildResponse(existingThreadId, config));
    }

    // 잘못된 요청
    return NextResponse.json(
      { error: 'Invalid request. Provide either "message" for new workflow or "threadId" + "decision" to resume.' },
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
