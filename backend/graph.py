"""
LangGraph HITL (Human-in-the-Loop) Workflow

이 모듈은 사람의 승인이 필요한 중요한 작업 전에
중단점(interrupt)을 포함하는 LangGraph 워크플로우를 정의합니다.

HITL 패턴:
1. 사용자 요청 분석
2. 작업 계획 생성
3. [INTERRUPT] 사용자 승인 요청
4. 승인 시 작업 실행
5. 결과 반환
"""

from typing import Annotated, TypedDict, Literal
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import interrupt, Command


class State(TypedDict):
    """워크플로우 상태 정의"""
    # 사용자 입력 메시지
    user_message: str
    # 분석된 작업 유형
    task_type: str
    # 생성된 작업 계획
    action_plan: str
    # 사용자 승인 여부
    approved: bool | None
    # 최종 결과
    result: str
    # 현재 단계
    current_step: str


def analyze_request(state: State) -> dict:
    """
    사용자 요청을 분석하여 작업 유형을 결정합니다.
    """
    user_message = state["user_message"].lower()

    # 간단한 규칙 기반 분류 (실제로는 LLM 사용)
    if any(word in user_message for word in ["삭제", "delete", "remove"]):
        task_type = "destructive"
    elif any(word in user_message for word in ["생성", "create", "만들"]):
        task_type = "create"
    elif any(word in user_message for word in ["수정", "update", "변경"]):
        task_type = "update"
    else:
        task_type = "query"

    return {
        "task_type": task_type,
        "current_step": "analyzed"
    }


def generate_plan(state: State) -> dict:
    """
    분석 결과를 바탕으로 실행 계획을 생성합니다.
    """
    task_type = state["task_type"]
    user_message = state["user_message"]

    # 작업 유형에 따른 계획 생성
    plans = {
        "destructive": f"⚠️ 위험한 작업: '{user_message}'\n\n실행 단계:\n1. 대상 확인\n2. 백업 생성\n3. 삭제 실행\n4. 결과 검증",
        "create": f"📝 생성 작업: '{user_message}'\n\n실행 단계:\n1. 요구사항 검증\n2. 리소스 생성\n3. 초기 설정\n4. 결과 확인",
        "update": f"🔄 수정 작업: '{user_message}'\n\n실행 단계:\n1. 현재 상태 확인\n2. 변경사항 적용\n3. 유효성 검증\n4. 결과 확인",
        "query": f"🔍 조회 작업: '{user_message}'\n\n실행 단계:\n1. 쿼리 구성\n2. 데이터 조회\n3. 결과 포맷팅"
    }

    action_plan = plans.get(task_type, "알 수 없는 작업 유형")

    return {
        "action_plan": action_plan,
        "current_step": "planned"
    }


def request_approval(state: State) -> dict:
    """
    사용자에게 작업 승인을 요청합니다.

    이 노드에서 interrupt()를 호출하여 워크플로우를 중단하고
    사용자의 승인/거부를 기다립니다.
    """
    # interrupt()는 워크플로우를 중단하고 사용자 입력을 기다림
    # 반환값은 Command(resume=...)로 전달된 값
    approval_response = interrupt({
        "question": "이 작업을 실행하시겠습니까?",
        "action_plan": state["action_plan"],
        "task_type": state["task_type"],
        "options": ["approve", "reject"]
    })

    # 사용자 응답 처리
    approved = approval_response.get("decision") == "approve"

    return {
        "approved": approved,
        "current_step": "approval_received"
    }


def execute_action(state: State) -> dict:
    """
    승인된 작업을 실행합니다.
    """
    task_type = state["task_type"]

    # 실제 작업 실행 시뮬레이션
    results = {
        "destructive": "✅ 삭제 작업이 성공적으로 완료되었습니다.",
        "create": "✅ 생성 작업이 성공적으로 완료되었습니다.",
        "update": "✅ 수정 작업이 성공적으로 완료되었습니다.",
        "query": "✅ 조회 결과가 준비되었습니다."
    }

    return {
        "result": results.get(task_type, "작업이 완료되었습니다."),
        "current_step": "executed"
    }


def cancel_action(state: State) -> dict:
    """
    사용자가 작업을 거부했을 때 호출됩니다.
    """
    return {
        "result": "❌ 사용자가 작업을 취소했습니다.",
        "current_step": "cancelled"
    }


def route_after_approval(state: State) -> Literal["execute_action", "cancel_action"]:
    """
    승인 여부에 따라 다음 노드를 결정합니다.
    """
    if state.get("approved"):
        return "execute_action"
    return "cancel_action"


def create_hitl_graph() -> StateGraph:
    """
    HITL 워크플로우 그래프를 생성합니다.
    """
    # 그래프 빌더 생성
    builder = StateGraph(State)

    # 노드 추가
    builder.add_node("analyze_request", analyze_request)
    builder.add_node("generate_plan", generate_plan)
    builder.add_node("request_approval", request_approval)
    builder.add_node("execute_action", execute_action)
    builder.add_node("cancel_action", cancel_action)

    # 엣지 정의 (워크플로우 흐름)
    builder.add_edge(START, "analyze_request")
    builder.add_edge("analyze_request", "generate_plan")
    builder.add_edge("generate_plan", "request_approval")

    # 조건부 라우팅: 승인 여부에 따라 분기
    builder.add_conditional_edges(
        "request_approval",
        route_after_approval,
        {
            "execute_action": "execute_action",
            "cancel_action": "cancel_action"
        }
    )

    builder.add_edge("execute_action", END)
    builder.add_edge("cancel_action", END)

    return builder


# 메모리 기반 체크포인터 (실제 운영에서는 PostgreSQL 등 사용)
checkpointer = MemorySaver()

# 컴파일된 그래프 생성
graph = create_hitl_graph().compile(checkpointer=checkpointer)
