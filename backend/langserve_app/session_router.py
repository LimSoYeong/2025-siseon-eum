# backend/langserve_app/session_router.py

from fastapi import APIRouter, UploadFile, Response, Request, Cookie
import uuid, shutil
from .conversation_chain import ImageChatRunnable
from infrastructure.vector_store import (
    save_image_embedding,
    save_text_embedding,
    search_by_text,
    list_recent_docs,
)
import os
import time
from data_store.conversations import append_message, get_conversation
from PIL import Image

router = APIRouter(prefix="/api")
sessions = {}

@router.post("/start_session")
async def start_session(image: UploadFile, response: Response, user_id: str = Cookie(None)):
    # 기존 쿠키가 있으면 재사용하여 기록 누적
    if not user_id:
        user_id = uuid.uuid4().hex
    # 문서 식별자(밀리초 타임스탬프 기반)로 파일명 유니크 보장
    doc_id = str(int(time.time() * 1000))
    temp_path = f"/tmp/{user_id}_{doc_id}.jpg"

    with open(temp_path, "wb") as f:
        shutil.copyfileobj(image.file, f)
    sessions[user_id] = ImageChatRunnable(temp_path) # 세션 초기화
    # 벡터 DB에 이미지 임베딩 저장
    try:
        save_image_embedding(temp_path, user_id=user_id, extra_metadata={"source": "start_session", "doc_id": doc_id})
    except Exception as e:
        print(f"[WARN] save_image_embedding 실패: {e}")
    initial_summary = sessions[user_id].invoke("이 문서에 대해 설명해줘.")
    append_message(user_id, doc_id, "assistant", initial_summary)
    # 요약 텍스트도 벡터DB에 저장
    try:
        # 길면 CLIP 한도를 넘기므로 요약을 200자로 우선 절단
        safe_summary = (initial_summary or "").strip()
        if len(safe_summary) > 200:
            safe_summary = safe_summary[:200] + "…"
        save_text_embedding(safe_summary, user_id=user_id, extra_metadata={"source": "summary", "doc_id": doc_id})
    except Exception as e:
        print(f"[WARN] save_text_embedding 실패: {e}")

    # 쿠키로 user_id 저장 (7일 유효). 이미 있더라도 갱신만 수행
    response.set_cookie(
        key="user_id",
        value=user_id,
        max_age=60*60*24*7,
        httponly=True,
        # 로컬 개발: 서로 다른 호스트(127.0.0.1 vs localhost) 간에도 전송되도록 None
        # 배포 시 None/True로 전환
        samesite="None",
        secure=True,
    )
    print("세션이 시작되었습니다.")
    return {"answer": initial_summary, "doc_id": doc_id}

@router.post("/save_text")
async def save_text(request: Request, user_id: str = Cookie(None)):
    body = await request.json()
    text = body.get("text")
    if not text:
        return {"error": "text가 비어 있습니다."}
    if not user_id:
        # 익명 저장 허용. 쿠키 없을 때는 임시 id 생성
        user_id = uuid.uuid4().hex
    try:
        save_text_embedding(text, user_id=user_id, extra_metadata={"source": "manual"})
        return {"status": "ok"}
    except Exception as e:
        return {"error": str(e)}

@router.post("/ask")
async def ask_question(request: Request, user_id: str = Cookie(None)):
    body = await request.json()
    question = body.get("question")

    if user_id not in sessions:
        return {"error": "세션이 존재하지 않습니다. 먼저 /start_session 호출하세요."}

    # 1) 질문을 벡터DB에 저장 (사용자 스코프)
    try:
        save_text_embedding(question, user_id=user_id, extra_metadata={"source": "qa_question"})
    except Exception as e:
        print(f"[WARN] save_text_embedding(question) 실패: {e}")

    # 2) 유사도 검색 후 컨텍스트 구성 (user_id 필터)
    try:
        raw_results = search_by_text(question, k=20) or []
        filtered = [r for r in raw_results if r.get("metadata", {}).get("user_id") == user_id]
        topk = filtered[:5]
        context_lines = []
        for item in topk:
            meta = item.get("metadata", {})
            item_type = meta.get("type")
            if item_type == "text":
                text = item.get("text", "")
                if len(text) > 160:
                    text = text[:160] + "…"
                context_lines.append(f"- 이전 텍스트: {text}")
            elif item_type == "image":
                path = meta.get("path")
                basename = os.path.basename(path) if path else "(path 미상)"
                context_lines.append(f"- 이전 이미지: {basename}")
        context_block = (
            "이전 관련 정보(사용자 개인 히스토리)입니다. 필요 시 연결감을 유지해 답변하세요:\n"
            + "\n".join(context_lines)
            if context_lines
            else ""
        )
    except Exception as e:
        print(f"[WARN] search_by_text 실패: {e}")
        context_block = ""

    # 3) 컨텍스트를 주입한 질문 생성
    if context_block:
        combined_question = f"{context_block}\n\n질문: {question}"
    else:
        combined_question = question

    # 4) 모델 호출
    response = sessions[user_id].invoke(combined_question)

    # 5) 답변/요약 스니펫 저장
    try:
        save_text_embedding(response, user_id=user_id, extra_metadata={"source": "qa_answer"})
        snippet = response.strip()
        if len(snippet) > 160:
            snippet = snippet[:160] + "…"
        if snippet:
            save_text_embedding(snippet, user_id=user_id, extra_metadata={"source": "summary_snippet"})
    except Exception as e:
        print(f"[WARN] save_text_embedding(answer/snippet) 실패: {e}")

    return {"answer": response}

@router.get("/conversation")
async def conversation(user_id: str = Cookie(None), doc_id: str | None = None):
    if not user_id or not doc_id:
        return {"messages": []}
    return {"messages": get_conversation(user_id, doc_id)}

@router.get("/recent_docs")
async def recent_docs(user_id: str = Cookie(None)):
    if not user_id:
        return {"items": []}
    try:
        items = list_recent_docs(user_id=user_id, limit=20)
        # 썸네일을 위한 파일 경로를 그대로 반환 (프런트가 file://가 아닌 서버 경로로 접근해야 하므로 아래 서빙 라우트도 제공)
        return {"items": items}
    except Exception as e:
        return {"items": [], "error": str(e)}

from fastapi.responses import FileResponse
@router.get("/image")
async def serve_image(path: str):
    # 보안 주의: 실제 서비스에서는 사용자 스코프/화이트리스트 검증 필요
    if not path or not os.path.exists(path):
        return {"error": "이미지를 찾을 수 없습니다."}
    return FileResponse(path)