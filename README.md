# LangGraph HITL POC

Next.js + LangGraph.js를 사용한 Human-in-the-Loop (HITL) 워크플로우 POC입니다.

## 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js Application                          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Frontend (React)                       │   │
│  │  ┌─────────────┐              ┌───────────────────┐     │   │
│  │  │ WorkflowChat│─────────────▶│  ApprovalDialog   │     │   │
│  │  └─────────────┘              └───────────────────┘     │   │
│  └──────────────────────────┬──────────────────────────────┘   │
│                             │ fetch(/api/...)                   │
│  ┌──────────────────────────▼──────────────────────────────┐   │
│  │              API Routes (Route Handlers)                 │   │
│  │                                                          │   │
│  │  POST /api/workflow/start                                │   │
│  │  GET  /api/workflow/[threadId]/status                    │   │
│  │  POST /api/workflow/[threadId]/resume                    │   │
│  └──────────────────────────┬──────────────────────────────┘   │
│                             │                                   │
│  ┌──────────────────────────▼──────────────────────────────┐   │
│  │                 LangGraph.js Workflow                    │   │
│  │                                                          │   │
│  │  [START] → [분석] → [계획] → [승인요청] → [실행/취소] → [END] │
│  │                          ↑                               │   │
│  │                     INTERRUPT                            │   │
│  │                    (사용자 승인)                          │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## 시작하기

```bash
npm install
npm run dev
```

http://localhost:3000 에서 확인

## 프로젝트 구조

```
src/
├── app/
│   ├── api/workflow/
│   │   ├── start/route.ts              # 워크플로우 시작
│   │   └── [threadId]/
│   │       ├── status/route.ts         # 상태 조회
│   │       └── resume/route.ts         # 워크플로우 재개
│   ├── page.tsx
│   └── layout.tsx
├── components/
│   ├── WorkflowChat.tsx                # 채팅 UI
│   └── ApprovalDialog.tsx              # 승인 다이얼로그
├── lib/
│   ├── api.ts                          # API 클라이언트
│   └── graph.ts                        # LangGraph.js 워크플로우
└── types/
    └── workflow.ts
```

## HITL 핵심 코드

```typescript
// src/lib/graph.ts - interrupt()로 워크플로우 중단
function requestApproval(state: WorkflowStateType) {
  const response = interrupt({
    question: '이 작업을 실행하시겠습니까?',
    actionPlan: state.actionPlan,
    taskType: state.taskType,
  });
  return { approved: response.decision === 'approve' };
}

// src/app/api/workflow/[threadId]/resume/route.ts - Command로 재개
const result = await graph.invoke(
  new Command({ resume: { decision } }),
  config
);
```
