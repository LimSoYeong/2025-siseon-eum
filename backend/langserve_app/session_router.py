# backend/langserve_app/session_router.py

from fastapi import APIRouter, UploadFile, Response, Request, Cookie
import uuid, shutil
from .conversation_chain import ImageChatRunnable
from infrastructure.vector_store import save_image_embedding, save_text_embedding
from PIL import Image

router = APIRouter(prefix="/api")
sessions = {}

@router.post("/start_session")
async def start_session(image: UploadFile, response: Response):
    user_id = uuid.uuid4().hex
    temp_path = f"/tmp/{user_id}.jpg"
    
    with open(temp_path, "wb") as f:
        shutil.copyfileobj(image.file, f)

    sessions[user_id] = ImageChatRunnable(temp_path) # 세션 초기화
    # 벡터 DB에 이미지 임베딩 저장
    try:
        save_image_embedding(temp_path, user_id=user_id, extra_metadata={"source": "start_session"})
    except Exception as e:
        print(f"[WARN] save_image_embedding 실패: {e}")
    initial_summary = sessions[user_id].invoke("이 문서에 대해 설명해줘.")
    # 요약 텍스트도 벡터DB에 저장
    try:
        save_text_embedding(initial_summary, user_id=user_id, extra_metadata={"source": "summary"})
    except Exception as e:
        print(f"[WARN] save_text_embedding 실패: {e}")

    # 쿠키로 user_id 저장 (7일 유효)
    response.set_cookie(key="user_id", value=user_id, max_age=60*60*24*7, httponly=True, samesite="None", secure=True)
    print("세션이 시작되었습니다.")
    return {"answer": initial_summary}

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

    response = sessions[user_id].invoke(question)
    return {"answer": response}