/**
 * POST /api/workflow - SSE 기반 HITL 워크플로우
 *
 * 하나의 엔드포인트에서 워크플로우 시작과 재개를 모두 처리합니다.
 * - message만 있으면: 새 워크플로우 시작
 * - threadId + decision 있으면: 워크플로우 재개
 */

import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { graph, Command, WorkflowStateType } from "@/lib/graph";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { message, threadId, decision } = body;

  // SSE 스트림 설정
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        // 새 워크플로우 시작
        if (message && !threadId) {
          const newThreadId = uuidv4();
          const config = { configurable: { thread_id: newThreadId } };

          send("start", { threadId: newThreadId, status: "started" });

          const initialState: Partial<WorkflowStateType> = {
            userMessage: message,
            taskType: "",
            actionPlan: "",
            approved: null,
            result: "",
            currentStep: "started",
          };

          // 워크플로우 실행 (interrupt까지)
          await graph.invoke(initialState, config);

          // 상태 확인
          const stateSnapshot = await graph.getState(config);
          const isInterrupted =
            stateSnapshot.tasks && stateSnapshot.tasks.length > 0;

          if (isInterrupted) {
            let interruptData = null;
            for (const task of stateSnapshot.tasks) {
              if (task.interrupts && task.interrupts.length > 0) {
                interruptData = task.interrupts[0].value;
                break;
              }
            }

            send("interrupt", {
              threadId: newThreadId,
              status: "awaiting_approval",
              interruptData,
              state: {
                taskType: stateSnapshot.values?.taskType,
                actionPlan: stateSnapshot.values?.actionPlan,
                currentStep: stateSnapshot.values?.currentStep,
              },
            });
          } else {
            send("complete", {
              threadId: newThreadId,
              status: "completed",
              state: stateSnapshot.values,
            });
          }
        }
        // 워크플로우 재개
        else if (threadId && decision) {
          const config = { configurable: { thread_id: threadId } };

          send("resume", { threadId, decision, status: "resuming" });

          // Command로 워크플로우 재개
          const result = await graph.invoke(
            new Command({ resume: { decision } }),
            config
          );

          send("complete", {
            threadId,
            status: "completed",
            result: result?.result,
            state: result,
          });
        } else {
          send("error", { error: "Invalid request: need message or threadId+decision" });
        }
      } catch (error) {
        send("error", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
