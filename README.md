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

## 주요 기능

- **Human-in-the-Loop**: 중요한 작업 전에 사용자 승인 요청
- **상태 관리**: LangGraph의 MemorySaver 체크포인터로 워크플로우 상태 저장
- **Full-Stack Next.js**: 프론트엔드와 백엔드가 하나의 Next.js 앱에서 동작
- **실시간 UI**: React를 통한 실시간 상태 업데이트

## HITL 워크플로우

1. **요청 분석** (`analyzeRequest`): 사용자 입력을 분석하여 작업 유형 결정
2. **계획 생성** (`generatePlan`): 실행 계획 생성
3. **승인 요청** (`requestApproval`): `interrupt()`로 워크플로우 중단, 사용자 승인 대기
4. **실행/취소**: 승인 시 작업 실행, 거부 시 취소

## 시작하기

### 사전 요구사항

- Node.js 18+
- npm

### 설치 및 실행

```bash
cd frontend

# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

브라우저에서 http://localhost:3000 에 접속합니다.

## API 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/workflow/start` | 새 워크플로우 시작 |
| GET | `/api/workflow/[threadId]/status` | 워크플로우 상태 조회 |
| POST | `/api/workflow/[threadId]/resume` | 중단된 워크플로우 재개 |

### 요청/응답 예시

#### 워크플로우 시작

```bash
curl -X POST http://localhost:3000/api/workflow/start \
  -H "Content-Type: application/json" \
  -d '{"message": "데이터베이스 사용자 삭제"}'
```

응답:
```json
{
  "threadId": "uuid-here",
  "status": "awaiting_approval",
  "requiresApproval": true,
  "interruptData": {
    "question": "이 작업을 실행하시겠습니까?",
    "actionPlan": "⚠️ 위험한 작업: ...",
    "taskType": "destructive",
    "options": ["approve", "reject"]
  }
}
```

#### 워크플로우 재개 (승인)

```bash
curl -X POST http://localhost:3000/api/workflow/{threadId}/resume \
  -H "Content-Type: application/json" \
  -d '{"decision": "approve"}'
```

## 프로젝트 구조

```
frontend/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── workflow/
│   │   │       ├── start/route.ts           # 워크플로우 시작 API
│   │   │       └── [threadId]/
│   │   │           ├── status/route.ts      # 상태 조회 API
│   │   │           └── resume/route.ts      # 워크플로우 재개 API
│   │   ├── page.tsx                         # 메인 페이지
│   │   ├── layout.tsx                       # 레이아웃
│   │   └── globals.css                      # 전역 스타일
│   ├── components/
│   │   ├── WorkflowChat.tsx                 # 채팅 인터페이스
│   │   └── ApprovalDialog.tsx               # 승인 다이얼로그
│   ├── lib/
│   │   ├── api.ts                           # API 클라이언트
│   │   └── graph.ts                         # LangGraph 워크플로우
│   └── types/
│       └── workflow.ts                      # 타입 정의
├── package.json
└── tsconfig.json
```

## 핵심 코드

### LangGraph.js interrupt() 사용

```typescript
// src/lib/graph.ts
function requestApproval(state: WorkflowStateType): Partial<WorkflowStateType> {
  // interrupt()는 워크플로우를 중단하고 사용자 입력을 기다림
  const approvalResponse = interrupt({
    question: '이 작업을 실행하시겠습니까?',
    actionPlan: state.actionPlan,
    taskType: state.taskType,
    options: ['approve', 'reject'],
  });

  // Command(resume=...)로 전달된 사용자 응답
  const approved = approvalResponse.decision === 'approve';

  return { approved, currentStep: 'approval_received' };
}
```

### 워크플로우 재개

```typescript
// src/app/api/workflow/[threadId]/resume/route.ts
const result = await graph.invoke(
  new Command({ resume: { decision } }),
  config
);
```

## 확장 가이드

### LLM 통합

현재 구현은 규칙 기반 분석을 사용합니다. LLM을 통합하려면:

```bash
npm install @langchain/openai
```

```typescript
// src/lib/graph.ts
import { ChatOpenAI } from '@langchain/openai';

const llm = new ChatOpenAI({ model: 'gpt-4' });

async function analyzeRequest(state: WorkflowStateType) {
  const response = await llm.invoke([
    { role: 'system', content: '사용자 요청을 분석하세요...' },
    { role: 'user', content: state.userMessage }
  ]);
  // 응답 파싱 및 반환
}
```

### 영구 체크포인터

운영 환경에서는 메모리 대신 PostgreSQL이나 Redis 체크포인터를 사용하세요.

## 라이선스

MIT License
