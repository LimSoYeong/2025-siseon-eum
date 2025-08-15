# backend/langserve_app/session_router.py

from fastapi import APIRouter, UploadFile, Response, Request, Cookie
import uuid, shutil
from .conversation_chain import ImageChatRunnable
import os
import time
from data_store.conversations import append_message, get_conversation
from data_store.recent_docs import (
    add_recent_doc,
    list_recent_docs,
    delete_recent_doc,
    get_recent_doc,
    get_recent_doc_by_doc_id,
    get_latest_doc_for_user,
)

router = APIRouter(prefix="/api")
sessions = {}
latest_doc_id_by_user: dict[str, str] = {}

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
    latest_doc_id_by_user[user_id] = doc_id
    # 문서 유형 분류 및 유형별 프롬프트 선택
    try:
        start_classify = time.time()
        doc_type = sessions[user_id].classify()
        end_classify = time.time()
        print(f"[DEBUG] ⏳ 문서분류 소요 시간: {round(end_classify - start_classify, 2)}초")
        prompt_text = sessions[user_id].prompt_for(doc_type)
        # 분류 로그 (pm2 stdout 수집)
        print(f"📝 문서유형: {doc_type}")
    except Exception as e:
        print(f"[WARN] 문서 유형 분류 실패: user_id={user_id} doc_id={doc_id} error={e}")
        doc_type = "기타"
        prompt_text = sessions[user_id].prompt_for(doc_type)
    
    start_invoke = time.time()
    initial_summary = sessions[user_id].invoke(prompt_text) # 유형별 프롬프트로 초기 요약 생성
    end_invoke = time.time()
    print(f"[DEBUG] ⏳ 요약 소요 시간: {round(end_invoke - start_invoke, 2)}초")

    append_message(user_id, doc_id, "assistant", initial_summary)
    # 최근 문서 기록 저장 (RAG 비활성화 대체)
    try:
        add_recent_doc(
            user_id=user_id,
            doc_id=doc_id,
            path=temp_path,
            title=initial_summary[:60] if initial_summary else "문서",
            doc_type=doc_type,
        )
    except Exception as e:
        print(f"[WARN] add_recent_doc 실패: {e}")
    # (RAG 제거) 임베딩 저장 로직 제거

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
    return {"answer": initial_summary, "doc_id": doc_id, "doc_type": doc_type}

@router.post("/save_text")
async def save_text(request: Request, user_id: str = Cookie(None)):
    # (RAG 제거) 텍스트 임베딩 저장 기능 비활성화
    return {"status": "disabled"}

@router.post("/ask")
async def ask_question(request: Request, user_id: str = Cookie(None)):
    body = await request.json()
    question = body.get("question")
    doc_id = body.get("doc_id") or latest_doc_id_by_user.get(user_id)

    # 세션이 유실된 경우 DB에서 복구 시도
    if user_id not in sessions:
        # 1) doc_id+user_id로 복원 시도
        restored = False
        if user_id and doc_id:
            doc = get_recent_doc(user_id=user_id, doc_id=doc_id) or get_recent_doc_by_doc_id(doc_id)
            if doc and doc.get("path") and os.path.exists(doc["path"]):
                try:
                    sessions[user_id] = ImageChatRunnable(doc["path"])  # 세션 복원
                    latest_doc_id_by_user[user_id] = doc.get("doc_id", doc_id)
                    restored = True
                except Exception as e:
                    print(f"[WARN] 세션 복원 실패: user_id={user_id} doc_id={doc_id} error={e}")
        # 2) user_id만 있고 doc_id 없으면 가장 최근 문서로 복원
        if not restored and user_id and not doc_id:
            doc = get_latest_doc_for_user(user_id)
            if doc and doc.get("path") and os.path.exists(doc["path"]):
                try:
                    sessions[user_id] = ImageChatRunnable(doc["path"])  # 세션 복원
                    latest_doc_id_by_user[user_id] = doc.get("doc_id")
                    restored = True
                except Exception as e:
                    print(f"[WARN] 세션 복원(최근문서) 실패: user_id={user_id} error={e}")
        if user_id not in sessions:
            return {"error": "세션이 존재하지 않습니다. 먼저 /start_session 호출하세요."}

    if not doc_id:
        return {"error": "대화 문서 식별자(doc_id)가 없습니다. 먼저 /start_session을 호출하세요."}

    # 질문/답변 대화 기록 저장 + 이미지+질문으로 직접 모델 호출
    try:
        append_message(user_id, doc_id, "user", question)
    except Exception as e:
        print(f"[WARN] append_message(question) 실패: user_id={user_id} doc_id={doc_id} error={e}")

    response_text = sessions[user_id].invoke(question)

    try:
        append_message(user_id, doc_id, "assistant", response_text)
    except Exception as e:
        print(f"[WARN] append_message(answer) 실패: user_id={user_id} doc_id={doc_id} error={e}")

    return {"answer": response_text, "doc_id": doc_id}

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

@router.post("/delete_doc")
async def delete_doc(request: Request, user_id: str = Cookie(None)):
    if not user_id:
        return {"removed": False, "error": "no user"}
    body = await request.json()
    doc_id = body.get("doc_id")
    path = body.get("path")
    try:
        result = delete_recent_doc(user_id=user_id, doc_id=doc_id, path=path)
        return result
    except Exception as e:
        return {"removed": False, "error": str(e)}