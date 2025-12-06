'use client';

import type { ToolCallInfo } from '@/types/chat';

interface ApprovalDialogProps {
  toolCall: ToolCallInfo;
  onApprove: () => void;
  onReject: () => void;
  isLoading: boolean;
}

const toolLabels: Record<string, { label: string; icon: string }> = {
  bookRoom: { label: '객실 예약', icon: '🏨' },
  cancelReservation: { label: '예약 취소', icon: '❌' },
};

export function ApprovalDialog({
  toolCall,
  onApprove,
  onReject,
  isLoading,
}: ApprovalDialogProps) {
  const tool = toolLabels[toolCall.toolName] || { label: toolCall.toolName, icon: '⚙️' };

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-2xl">{tool.icon}</span>
        <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
          {tool.label} 승인 필요
        </h3>
      </div>

      <p className="mb-4 text-amber-800 dark:text-amber-200">
        {toolCall.message}
      </p>

      <div className="mb-6 rounded-md bg-white p-4 dark:bg-gray-900">
        <h4 className="mb-2 font-medium text-gray-900 dark:text-gray-100">
          상세 정보:
        </h4>
        <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
          {JSON.stringify(toolCall.toolArgs, null, 2)}
        </pre>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onApprove}
          disabled={isLoading}
          className="flex-1 rounded-lg bg-green-600 px-4 py-2 font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? '처리 중...' : '승인'}
        </button>
        <button
          onClick={onReject}
          disabled={isLoading}
          className="flex-1 rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? '처리 중...' : '거부'}
        </button>
      </div>
    </div>
  );
}
