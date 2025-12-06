"use client";

import { useState, useCallback } from "react";
import { Send, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApprovalCard } from "@/components/approval-card";
import type {
  WorkflowStatus,
  InterruptData,
  WorkflowState,
  StartWorkflowResponse,
  ResumeWorkflowResponse,
} from "@/types/workflow";

interface Message {
  id: string;
  role: "user" | "system" | "result";
  content: string;
  timestamp: Date;
}

async function startWorkflow(message: string): Promise<StartWorkflowResponse> {
  const response = await fetch("/api/workflow/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Request failed");
  }
  return response.json();
}

async function resumeWorkflow(
  threadId: string,
  decision: "approve" | "reject"
): Promise<ResumeWorkflowResponse> {
  const response = await fetch(`/api/workflow/${threadId}/resume`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Request failed");
  }
  return response.json();
}

export function WorkflowChat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<WorkflowStatus>("idle");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [interruptData, setInterruptData] = useState<InterruptData | null>(null);
  const [workflowState, setWorkflowState] = useState<WorkflowState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addMessage = useCallback((role: Message["role"], content: string) => {
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
    if (!input.trim() || status === "running") return;

    const userMessage = input.trim();
    setInput("");
    setError(null);

    addMessage("user", userMessage);
    setStatus("running");
    addMessage("system", "워크플로우를 시작합니다...");

    try {
      const response = await startWorkflow(userMessage);
      setThreadId(response.threadId);
      setWorkflowState(response.state || null);

      if (response.requiresApproval && response.interruptData) {
        setStatus("awaiting_approval");
        setInterruptData(response.interruptData);
        addMessage("system", "작업 계획이 생성되었습니다. 승인이 필요합니다.");
      } else {
        setStatus("completed");
        addMessage("result", response.state?.result || "작업이 완료되었습니다.");
      }
    } catch (err) {
      setStatus("error");
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      addMessage("system", `오류: ${errorMessage}`);
    }
  };

  const handleApprove = async () => {
    if (!threadId) return;
    setStatus("running");
    addMessage("system", "승인됨. 작업을 실행합니다...");

    try {
      const response = await resumeWorkflow(threadId, "approve");
      setStatus("completed");
      setInterruptData(null);
      setWorkflowState(response.state || null);
      addMessage("result", response.result || "작업이 완료되었습니다.");
    } catch (err) {
      setStatus("error");
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      addMessage("system", `오류: ${errorMessage}`);
    }
  };

  const handleReject = async () => {
    if (!threadId) return;
    setStatus("running");
    addMessage("system", "거부됨. 작업을 취소합니다...");

    try {
      const response = await resumeWorkflow(threadId, "reject");
      setStatus("completed");
      setInterruptData(null);
      setWorkflowState(response.state || null);
      addMessage("result", response.result || "작업이 취소되었습니다.");
    } catch (err) {
      setStatus("error");
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      addMessage("system", `오류: ${errorMessage}`);
    }
  };

  const handleReset = () => {
    setMessages([]);
    setStatus("idle");
    setThreadId(null);
    setInterruptData(null);
    setWorkflowState(null);
    setError(null);
    setInput("");
  };

  const statusConfig: Record<WorkflowStatus, { color: string; label: string }> = {
    idle: { color: "bg-gray-400", label: "대기 중" },
    running: { color: "bg-blue-500 animate-pulse", label: "실행 중" },
    awaiting_approval: { color: "bg-yellow-500 animate-pulse", label: "승인 대기" },
    completed: { color: "bg-green-500", label: "완료" },
    error: { color: "bg-red-500", label: "오류" },
  };

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex-row items-center justify-between space-y-0 border-b">
        <div>
          <CardTitle>LangGraph HITL Demo</CardTitle>
          <p className="text-sm text-muted-foreground">
            Human-in-the-Loop 워크플로우
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${statusConfig[status].color}`} />
            <span className="text-sm text-muted-foreground">
              {statusConfig[status].label}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            초기화
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p className="mb-2 text-4xl">💬</p>
              <p>메시지를 입력하여 워크플로우를 시작하세요</p>
              <p className="mt-2 text-sm">
                예: &quot;데이터베이스 사용자 삭제&quot;, &quot;새 프로젝트 생성&quot;
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : message.role === "result"
                        ? "bg-green-100 text-green-900 dark:bg-green-900/20 dark:text-green-100"
                        : "bg-muted"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  <p className="mt-1 text-xs opacity-70">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}

            {status === "awaiting_approval" && interruptData && (
              <ApprovalCard
                interruptData={interruptData}
                onApprove={handleApprove}
                onReject={handleReject}
                isLoading={false}
              />
            )}
          </div>
        )}
      </CardContent>

      {workflowState && (
        <div className="border-t bg-muted/50 p-3">
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">
              워크플로우 상태 정보
            </summary>
            <pre className="mt-2 overflow-x-auto text-xs">
              {JSON.stringify(workflowState, null, 2)}
            </pre>
          </details>
        </div>
      )}

      <form onSubmit={handleSubmit} className="border-t p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="작업을 입력하세요... (예: 파일 삭제, 사용자 생성)"
            disabled={status === "running" || status === "awaiting_approval"}
            className="flex-1 rounded-lg border bg-background px-4 py-2 focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
          <Button
            type="submit"
            disabled={
              !input.trim() ||
              status === "running" ||
              status === "awaiting_approval"
            }
          >
            {status === "running" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </form>
    </Card>
  );
}
