# backend/routes/qa_router.py

from fastapi import APIRouter, UploadFile, File, Form
from pydantic import BaseModel
from runnables.chat_runnable import get_chat_agent
from typing import Optional
import shutil
import uuid
import os

router = APIRouter()

# 요청 스키마
class AnswerRequest(BaseModel):
    question: str
    image_path: Optional[str] = None

# 응답 스키마
class AnswerResponse(BaseModel):
    answer: str

# ✅ /answer 엔드포인트
"""
•	POST /answer
	•	question (텍스트): 어르신의 질문
	•	image (선택): 문서 이미지 (예: 신청서 등)
•	이미지를 static/audio/ 디렉토리에 저장
•	내부에서 get_chat_agent()로 LangChain Agent 실행
•	질문과 이미지 경로를 함께 전달하여 멀티모달 답변 생성
•	결과를 JSON으로 반환: { "answer": "..." }
"""
@router.post("/answer", response_model=AnswerResponse)
async def answer_question(
    question: str = Form(...),
    image: Optional[UploadFile] = File(None),
):
    # 이미지 저장 (있을 경우)
    image_path = None
    if image:
        file_ext = image.filename.split(".")[-1]
        file_name = f"{uuid.uuid4()}.{file_ext}"
        image_path = os.path.join("static/audio", file_name)  # static 폴더 재사용
        with open(image_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)

    # Agent 호출
    agent = get_chat_agent()
    prompt = question
    response = agent.invoke({"input": prompt, "image_path": image_path})

    return {"answer": response}
