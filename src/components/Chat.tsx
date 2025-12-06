'use client';

import { useState, useCallback } from 'react';
import { sendMessage, submitApproval } from '@/lib/api';
import { ApprovalDialog } from './ApprovalDialog';
import type { ChatStatus, ToolCallInfo } from '@/types/chat';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export function Chat() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [threadId, setThreadId] = useState<string | null>(null);
  const [toolCall, setToolCall] = useState<ToolCallInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addMessage = useCallback((role: Message['role'], content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role, content },
    ]);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || status === 'loading') return;

    const userMessage = input.trim();
    setInput('');
    setError(null);
    addMessage('user', userMessage);
    setStatus('loading');

    try {
      const response = await sendMessage(userMessage, threadId || undefined);
      setThreadId(response.threadId);

      if (response.status === 'awaiting_approval' && response.toolCall) {
        setStatus('awaiting_approval');
        setToolCall(response.toolCall);
      } else {
        setStatus('ready');
        if (response.response) {
          addMessage('assistant', response.response);
        }
      }
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleApproval = async (approved: boolean) => {
    if (!threadId) return;

    setStatus('loading');
    setToolCall(null);

    try {
      const response = await submitApproval(threadId, approved);

      if (response.status === 'awaiting_approval' && response.toolCall) {
        setStatus('awaiting_approval');
        setToolCall(response.toolCall);
      } else {
        setStatus('ready');
        if (response.response) {
          addMessage('assistant', response.response);
        }
      }
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleReset = () => {
    setMessages([]);
    setStatus('idle');
    setThreadId(null);
    setToolCall(null);
    setError(null);
    setInput('');
  };

  return (
    <div className="flex h-full flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
        <div>
          <h2 className="text-lg font-semibold">호텔 예약 챗봇</h2>
          <p className="text-sm text-gray-500">객실 검색, 예약, 취소를 도와드립니다</p>
        </div>
        <button
          onClick={handleReset}
          className="rounded-lg border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
        >
          새 대화
        </button>
      </div>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-gray-400">
            <div className="text-center">
              <p className="mb-2 text-4xl">🏨</p>
              <p>안녕하세요! 호텔 예약을 도와드릴게요.</p>
              <p className="mt-2 text-sm">
                &quot;3월 15일부터 2박 객실 찾아줘&quot;
              </p>
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
                      : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}

            {status === 'loading' && (
              <div className="flex justify-start">
                <div className="rounded-lg bg-gray-100 px-4 py-2 dark:bg-gray-800">
                  <p className="text-gray-500">생각 중...</p>
                </div>
              </div>
            )}

            {status === 'awaiting_approval' && toolCall && (
              <ApprovalDialog
                toolCall={toolCall}
                onApprove={() => handleApproval(true)}
                onReject={() => handleApproval(false)}
                isLoading={false}
              />
            )}

            {error && (
              <div className="rounded-lg bg-red-100 px-4 py-2 text-red-800 dark:bg-red-900 dark:text-red-200">
                오류: {error}
              </div>
            )}
          </div>
        )}
      </div>

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
            disabled={status === 'loading' || status === 'awaiting_approval'}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:disabled:bg-gray-900"
          />
          <button
            type="submit"
            disabled={!input.trim() || status === 'loading' || status === 'awaiting_approval'}
            className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            전송
          </button>
        </div>
      </form>
    </div>
  );
}
