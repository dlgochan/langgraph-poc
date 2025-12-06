"""
FastAPI 서버 - LangGraph HITL 워크플로우 API

이 서버는 LangGraph 워크플로우와 상호작용하기 위한 REST API를 제공합니다.

주요 엔드포인트:
- POST /api/workflow/start: 새 워크플로우 시작
- GET /api/workflow/{thread_id}/status: 워크플로우 상태 조회
- POST /api/workflow/{thread_id}/resume: 중단된 워크플로우 재개 (승인/거부)
"""

import uuid
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langgraph.types import Command

from graph import graph, State


# 세션 저장소 (실제로는 Redis 등 사용)
sessions: dict[str, dict] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """애플리케이션 시작/종료 시 실행되는 코드"""
    print("🚀 LangGraph HITL Server starting...")
    yield
    print("👋 LangGraph HITL Server shutting down...")


app = FastAPI(
    title="LangGraph HITL API",
    description="Human-in-the-Loop 워크플로우 API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS 설정 (프론트엔드 연동용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============ Pydantic 모델 ============

class StartWorkflowRequest(BaseModel):
    """워크플로우 시작 요청"""
    message: str


class StartWorkflowResponse(BaseModel):
    """워크플로우 시작 응답"""
    thread_id: str
    status: str
    requires_approval: bool
    interrupt_data: Optional[dict] = None
    state: Optional[dict] = None


class ResumeWorkflowRequest(BaseModel):
    """워크플로우 재개 요청"""
    decision: str  # "approve" or "reject"


class WorkflowStatusResponse(BaseModel):
    """워크플로우 상태 응답"""
    thread_id: str
    status: str
    requires_approval: bool
    interrupt_data: Optional[dict] = None
    state: Optional[dict] = None


class ResumeWorkflowResponse(BaseModel):
    """워크플로우 재개 응답"""
    thread_id: str
    status: str
    result: Optional[str] = None
    state: Optional[dict] = None


# ============ API 엔드포인트 ============

@app.get("/")
async def root():
    """헬스 체크"""
    return {"message": "LangGraph HITL API is running", "version": "1.0.0"}


@app.post("/api/workflow/start", response_model=StartWorkflowResponse)
async def start_workflow(request: StartWorkflowRequest):
    """
    새 워크플로우를 시작합니다.

    워크플로우는 다음 단계를 거칩니다:
    1. 요청 분석
    2. 실행 계획 생성
    3. 사용자 승인 요청 (여기서 중단)
    """
    thread_id = str(uuid.uuid4())

    # 초기 상태 설정
    initial_state: State = {
        "user_message": request.message,
        "task_type": "",
        "action_plan": "",
        "approved": None,
        "result": "",
        "current_step": "started"
    }

    config = {"configurable": {"thread_id": thread_id}}

    try:
        # 워크플로우 실행 (interrupt 지점까지)
        result = graph.invoke(initial_state, config)

        # 현재 상태 확인
        state_snapshot = graph.get_state(config)

        # 중단점에서 멈췄는지 확인
        is_interrupted = len(state_snapshot.tasks) > 0

        if is_interrupted:
            # 중단점 데이터 추출
            interrupt_data = None
            for task in state_snapshot.tasks:
                if hasattr(task, 'interrupts') and task.interrupts:
                    interrupt_data = task.interrupts[0].value
                    break

            # 세션 저장
            sessions[thread_id] = {
                "status": "awaiting_approval",
                "interrupt_data": interrupt_data
            }

            return StartWorkflowResponse(
                thread_id=thread_id,
                status="awaiting_approval",
                requires_approval=True,
                interrupt_data=interrupt_data,
                state={
                    "task_type": state_snapshot.values.get("task_type"),
                    "action_plan": state_snapshot.values.get("action_plan"),
                    "current_step": state_snapshot.values.get("current_step")
                }
            )
        else:
            # 중단 없이 완료된 경우
            sessions[thread_id] = {"status": "completed"}

            return StartWorkflowResponse(
                thread_id=thread_id,
                status="completed",
                requires_approval=False,
                state=dict(result) if result else None
            )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/workflow/{thread_id}/status", response_model=WorkflowStatusResponse)
async def get_workflow_status(thread_id: str):
    """
    워크플로우 상태를 조회합니다.
    """
    config = {"configurable": {"thread_id": thread_id}}

    try:
        state_snapshot = graph.get_state(config)

        if not state_snapshot.values:
            raise HTTPException(status_code=404, detail="Workflow not found")

        is_interrupted = len(state_snapshot.tasks) > 0

        interrupt_data = None
        if is_interrupted:
            for task in state_snapshot.tasks:
                if hasattr(task, 'interrupts') and task.interrupts:
                    interrupt_data = task.interrupts[0].value
                    break

        return WorkflowStatusResponse(
            thread_id=thread_id,
            status="awaiting_approval" if is_interrupted else "completed",
            requires_approval=is_interrupted,
            interrupt_data=interrupt_data,
            state={
                "task_type": state_snapshot.values.get("task_type"),
                "action_plan": state_snapshot.values.get("action_plan"),
                "current_step": state_snapshot.values.get("current_step"),
                "result": state_snapshot.values.get("result")
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/workflow/{thread_id}/resume", response_model=ResumeWorkflowResponse)
async def resume_workflow(thread_id: str, request: ResumeWorkflowRequest):
    """
    중단된 워크플로우를 재개합니다.

    사용자의 승인/거부 결정에 따라 워크플로우를 계속 진행합니다.
    """
    config = {"configurable": {"thread_id": thread_id}}

    try:
        # 현재 상태 확인
        state_snapshot = graph.get_state(config)

        if not state_snapshot.values:
            raise HTTPException(status_code=404, detail="Workflow not found")

        if len(state_snapshot.tasks) == 0:
            raise HTTPException(
                status_code=400,
                detail="Workflow is not waiting for approval"
            )

        # Command를 사용하여 interrupt에 응답하고 워크플로우 재개
        result = graph.invoke(
            Command(resume={"decision": request.decision}),
            config
        )

        # 세션 업데이트
        sessions[thread_id] = {"status": "completed"}

        return ResumeWorkflowResponse(
            thread_id=thread_id,
            status="completed",
            result=result.get("result") if result else None,
            state=dict(result) if result else None
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sessions")
async def list_sessions():
    """
    활성 세션 목록을 반환합니다. (디버깅용)
    """
    return {"sessions": sessions}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
