# LangGraph HITL POC

Next.js + LangGraph를 사용한 Human-in-the-Loop (HITL) 워크플로우 POC입니다.

## 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                       │
│  ┌─────────────┐    ┌──────────────────┐    ┌───────────────┐  │
│  │ WorkflowChat│───▶│   API Client     │───▶│ ApprovalDialog│  │
│  └─────────────┘    └──────────────────┘    └───────────────┘  │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTP
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend (FastAPI + LangGraph)              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    LangGraph Workflow                    │   │
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
- **상태 관리**: LangGraph의 체크포인터를 사용한 워크플로우 상태 저장
- **실시간 UI**: React를 통한 실시간 상태 업데이트

## HITL 워크플로우

1. **요청 분석** (`analyze_request`): 사용자 입력을 분석하여 작업 유형 결정
2. **계획 생성** (`generate_plan`): 실행 계획 생성
3. **승인 요청** (`request_approval`): `interrupt()`로 워크플로우 중단, 사용자 승인 대기
4. **실행/취소**: 승인 시 작업 실행, 거부 시 취소

## 시작하기

### 사전 요구사항

- Node.js 18+
- Python 3.11+
- pip

### Backend 설정

```bash
cd backend

# 가상환경 생성 (권장)
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt

# 환경변수 설정 (선택)
cp .env.example .env
# .env 파일 수정

# 서버 실행
python server.py
# 또는
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

서버가 http://localhost:8000 에서 실행됩니다.

### Frontend 설정

```bash
cd frontend

# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env.local
# .env.local 파일에서 API URL 확인

# 개발 서버 실행
npm run dev
```

프론트엔드가 http://localhost:3000 에서 실행됩니다.

## API 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/` | 헬스 체크 |
| POST | `/api/workflow/start` | 새 워크플로우 시작 |
| GET | `/api/workflow/{thread_id}/status` | 워크플로우 상태 조회 |
| POST | `/api/workflow/{thread_id}/resume` | 중단된 워크플로우 재개 |

### 요청/응답 예시

#### 워크플로우 시작

```bash
curl -X POST http://localhost:8000/api/workflow/start \
  -H "Content-Type: application/json" \
  -d '{"message": "데이터베이스 사용자 삭제"}'
```

응답:
```json
{
  "thread_id": "uuid-here",
  "status": "awaiting_approval",
  "requires_approval": true,
  "interrupt_data": {
    "question": "이 작업을 실행하시겠습니까?",
    "action_plan": "⚠️ 위험한 작업: ...",
    "task_type": "destructive",
    "options": ["approve", "reject"]
  }
}
```

#### 워크플로우 재개 (승인)

```bash
curl -X POST http://localhost:8000/api/workflow/{thread_id}/resume \
  -H "Content-Type: application/json" \
  -d '{"decision": "approve"}'
```

## 프로젝트 구조

```
langgraph-poc/
├── backend/
│   ├── graph.py          # LangGraph 워크플로우 정의
│   ├── server.py         # FastAPI 서버
│   ├── requirements.txt  # Python 의존성
│   └── .env.example      # 환경변수 예시
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx      # 메인 페이지
│   │   │   ├── layout.tsx    # 레이아웃
│   │   │   └── globals.css   # 전역 스타일
│   │   ├── components/
│   │   │   ├── WorkflowChat.tsx    # 채팅 인터페이스
│   │   │   └── ApprovalDialog.tsx  # 승인 다이얼로그
│   │   ├── lib/
│   │   │   └── api.ts        # API 클라이언트
│   │   └── types/
│   │       └── workflow.ts   # 타입 정의
│   ├── .env.example          # 환경변수 예시
│   └── package.json
└── README.md
```

## 확장 가이드

### LLM 통합

현재 구현은 규칙 기반 분석을 사용합니다. LLM을 통합하려면 `graph.py`의 노드 함수를 수정하세요:

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4")

def analyze_request(state: State) -> dict:
    response = llm.invoke([
        {"role": "system", "content": "사용자 요청을 분석하세요..."},
        {"role": "user", "content": state["user_message"]}
    ])
    # 응답 파싱 및 반환
```

### 영구 체크포인터

운영 환경에서는 메모리 대신 PostgreSQL 체크포인터를 사용하세요:

```python
from langgraph.checkpoint.postgres import PostgresSaver

checkpointer = PostgresSaver.from_conn_string("postgresql://...")
graph = create_hitl_graph().compile(checkpointer=checkpointer)
```

## 라이선스

MIT License
