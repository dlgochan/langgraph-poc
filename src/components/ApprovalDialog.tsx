'use client';

import type { InterruptData } from '@/types/workflow';

interface ApprovalDialogProps {
  interruptData: InterruptData;
  onApprove: () => void;
  onReject: () => void;
  isLoading: boolean;
}

/**
 * HITL 승인/거부 다이얼로그 컴포넌트
 *
 * 워크플로우가 중단점에서 멈췄을 때 사용자에게
 * 작업 계획을 보여주고 승인/거부를 요청합니다.
 */
export function ApprovalDialog({
  interruptData,
  onApprove,
  onReject,
  isLoading,
}: ApprovalDialogProps) {
  const taskTypeLabels: Record<string, { label: string; color: string }> = {
    destructive: { label: '위험한 작업', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
    create: { label: '생성 작업', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
    update: { label: '수정 작업', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
    query: { label: '조회 작업', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' },
  };

  const taskType = taskTypeLabels[interruptData.taskType] || taskTypeLabels.query;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950">
      {/* 헤더 */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-2xl">⏸️</span>
        <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
          승인이 필요합니다
        </h3>
      </div>

      {/* 작업 유형 배지 */}
      <div className="mb-4">
        <span className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${taskType.color}`}>
          {taskType.label}
        </span>
      </div>

      {/* 질문 */}
      <p className="mb-4 text-amber-800 dark:text-amber-200">
        {interruptData.question}
      </p>

      {/* 실행 계획 */}
      <div className="mb-6 rounded-md bg-white p-4 dark:bg-gray-900">
        <h4 className="mb-2 font-medium text-gray-900 dark:text-gray-100">
          실행 계획:
        </h4>
        <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
          {interruptData.actionPlan}
        </pre>
      </div>

      {/* 버튼 */}
      <div className="flex gap-3">
        <button
          onClick={onApprove}
          disabled={isLoading}
          className="flex-1 rounded-lg bg-green-600 px-4 py-2 font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? '처리 중...' : '✅ 승인'}
        </button>
        <button
          onClick={onReject}
          disabled={isLoading}
          className="flex-1 rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? '처리 중...' : '❌ 거부'}
        </button>
      </div>
    </div>
  );
}
