'use client';

import { useState, useCallback } from 'react';
import { chat } from '@/lib/api';
import { ApprovalDialog } from './ApprovalDialog';
import type { ChatStatus, InterruptData, ChatState } from '@/types/chat';

interface Message {
  id: string;
  role: 'user' | 'system' | 'result';
  content: string;
  timestamp: Date;
}

export function Chat() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [threadId, setThreadId] = useState<string | null>(null);
  const [interruptData, setInterruptData] = useState<InterruptData | null>(null);
  const [chatState, setChatState] = useState<ChatState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addMessage = useCallback((role: Message['role'], content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role,
        content,
        timestamp: new Date(),
      },
    ]);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || status === 'running') return;

    const userMessage = input.trim();
    setInput('');
    setError(null);

    addMessage('user', userMessage);
    setStatus('running');

    try {
      const response = await chat({ message: userMessage });
      setThreadId(response.threadId);
      setChatState(response.state);

      if (response.status === 'awaiting_approval' && response.interruptData) {
        setStatus('awaiting_approval');
        setInterruptData(response.interruptData);
        addMessage('system', '승인이 필요합니다.');
      } else {
        setStatus('completed');
        addMessage('result', response.result || '완료되었습니다.');
      }
    } catch (err) {
      setStatus('error');
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      addMessage('system', `오류: ${errorMessage}`);
    }
  };

  const handleDecision = async (decision: 'approve' | 'reject') => {
    if (!threadId) return;

    setStatus('running');
    addMessage('system', decision === 'approve' ? '승인됨' : '거부됨');

    try {
      const response = await chat({ threadId, decision });
      setChatState(response.state);
      setInterruptData(null);

      if (response.status === 'awaiting_approval' && response.interruptData) {
        setStatus('awaiting_approval');
        setInterruptData(response.interruptData);
        addMessage('system', '추가 승인이 필요합니다.');
      } else {
        setStatus('completed');
        addMessage('result', response.result || '완료되었습니다.');
      }
    } catch (err) {
      setStatus('error');
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      addMessage('system', `오류: ${errorMessage}`);
    }
  };

  const handleReset = () => {
    setMessages([]);
    setStatus('idle');
    setThreadId(null);
    setInterruptData(null);
    setChatState(null);
    setError(null);
    setInput('');
  };

  return (
    <div className="flex h-full flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
        <div>
          <h2 className="text-lg font-semibold">LangGraph HITL Demo</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                status === 'idle'
                  ? 'bg-gray-400'
                  : status === 'running'
                    ? 'animate-pulse bg-blue-500'
                    : status === 'awaiting_approval'
                      ? 'animate-pulse bg-amber-500'
                      : status === 'completed'
                        ? 'bg-green-500'
                        : 'bg-red-500'
              }`}
            />
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {status === 'idle' && '대기'}
              {status === 'running' && '실행 중'}
              {status === 'awaiting_approval' && '승인 대기'}
              {status === 'completed' && '완료'}
              {status === 'error' && '오류'}
            </span>
          </div>
          <button
            onClick={handleReset}
            className="rounded-lg border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            초기화
          </button>
        </div>
      </div>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-gray-400">
            <div className="text-center">
              <p className="mb-2 text-4xl">💬</p>
              <p>메시지를 입력하세요</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : message.role === 'result'
                        ? 'bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100'
                        : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  <p
                    className={`mt-1 text-xs ${
                      message.role === 'user'
                        ? 'text-blue-200'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}

            {status === 'awaiting_approval' && interruptData && (
              <ApprovalDialog
                interruptData={interruptData}
                onApprove={() => handleDecision('approve')}
                onReject={() => handleDecision('reject')}
                isLoading={false}
              />
            )}
          </div>
        )}
      </div>

      {/* 상태 정보 */}
      {chatState && (
        <div className="border-t border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
          <details className="text-sm">
            <summary className="cursor-pointer text-gray-600 dark:text-gray-400">
              상태 정보
            </summary>
            <pre className="mt-2 overflow-x-auto text-xs text-gray-500">
              {JSON.stringify(chatState, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {/* 입력 영역 */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-gray-200 p-4 dark:border-gray-700"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="메시지를 입력하세요..."
            disabled={status === 'running' || status === 'awaiting_approval'}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:disabled:bg-gray-900"
          />
          <button
            type="submit"
            disabled={
              !input.trim() ||
              status === 'running' ||
              status === 'awaiting_approval'
            }
            className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            전송
          </button>
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </form>
    </div>
  );
}
