/**
 * POST /api/workflow/start
 *
 * 새 워크플로우를 시작합니다.
 * interrupt 지점까지 실행 후 상태를 반환합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { graph, WorkflowStateType } from '@/lib/graph';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'message is required' },
        { status: 400 }
      );
    }

    const threadId = uuidv4();

    // 초기 상태 설정
    const initialState: Partial<WorkflowStateType> = {
      userMessage: message,
      taskType: '',
      actionPlan: '',
      approved: null,
      result: '',
      currentStep: 'started',
    };

    const config = { configurable: { thread_id: threadId } };

    // 워크플로우 실행 (interrupt 지점까지)
    await graph.invoke(initialState, config);

    // 현재 상태 확인
    const stateSnapshot = await graph.getState(config);

    // 중단점에서 멈췄는지 확인
    const isInterrupted = stateSnapshot.tasks && stateSnapshot.tasks.length > 0;

    if (isInterrupted) {
      // 중단점 데이터 추출
      let interruptData = null;

      for (const task of stateSnapshot.tasks) {
        if (task.interrupts && task.interrupts.length > 0) {
          interruptData = task.interrupts[0].value;
          break;
        }
      }

      return NextResponse.json({
        threadId,
        status: 'awaiting_approval',
        requiresApproval: true,
        interruptData,
        state: {
          taskType: stateSnapshot.values?.taskType,
          actionPlan: stateSnapshot.values?.actionPlan,
          currentStep: stateSnapshot.values?.currentStep,
        },
      });
    }

    // 중단 없이 완료된 경우
    return NextResponse.json({
      threadId,
      status: 'completed',
      requiresApproval: false,
      state: stateSnapshot.values,
    });
  } catch (error) {
    console.error('Workflow start error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
