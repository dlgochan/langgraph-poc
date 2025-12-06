/**
 * POST /api/workflow/[threadId]/resume
 *
 * 중단된 워크플로우를 재개합니다.
 * 사용자의 승인/거부 결정에 따라 워크플로우를 계속 진행합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { graph, Command } from '@/lib/graph';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params;
    const body = await request.json();
    const { decision } = body;

    if (!decision || !['approve', 'reject'].includes(decision)) {
      return NextResponse.json(
        { error: 'decision must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    const config = { configurable: { thread_id: threadId } };

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

    // Command를 사용하여 interrupt에 응답하고 워크플로우 재개
    const result = await graph.invoke(
      new Command({ resume: { decision } }),
      config
    );

    return NextResponse.json({
      threadId,
      status: 'completed',
      result: result?.result || null,
      state: result,
    });
  } catch (error) {
    console.error('Workflow resume error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
