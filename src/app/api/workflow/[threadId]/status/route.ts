/**
 * GET /api/workflow/[threadId]/status
 *
 * 워크플로우 상태를 조회합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { graph } from '@/lib/graph';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params;
    const config = { configurable: { thread_id: threadId } };

    const stateSnapshot = await graph.getState(config);

    if (!stateSnapshot.values || Object.keys(stateSnapshot.values).length === 0) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      );
    }

    const isInterrupted = stateSnapshot.tasks && stateSnapshot.tasks.length > 0;

    let interruptData = null;
    if (isInterrupted) {
      for (const task of stateSnapshot.tasks) {
        if (task.interrupts && task.interrupts.length > 0) {
          interruptData = task.interrupts[0].value;
          break;
        }
      }
    }

    return NextResponse.json({
      threadId,
      status: isInterrupted ? 'awaiting_approval' : 'completed',
      requiresApproval: isInterrupted,
      interruptData,
      state: {
        taskType: stateSnapshot.values?.taskType,
        actionPlan: stateSnapshot.values?.actionPlan,
        currentStep: stateSnapshot.values?.currentStep,
        result: stateSnapshot.values?.result,
      },
    });
  } catch (error) {
    console.error('Workflow status error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
