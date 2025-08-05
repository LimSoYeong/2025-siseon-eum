# backend/langserve_app/serve.py

from fastapi import FastAPI, UploadFile, Response, Request, Cookie
import uuid, shutil, os
from conversation_chain import ImageChatRunnable

app = FastAPI()
sessions = {}

@app.post("/start_session")
async def start_session(image: UploadFile, response: Response):
    user_id = uuid.uuid4().hex
    temp_path = f"/tmp/{user_id}.jpg"
    
    with open(temp_path, "wb") as f:
        shutil.copyfileobj(image.file, f)

    sessions[user_id] = ImageChatRunnable(temp_path)

    # 쿠키로 user_id 저장 (7일 유효)
    response.set_cookie(key="user_id", value=user_id, max_age=60*60*24*7, httponly=False)
    return {"message": "세션이 시작되었습니다."}

@app.post("/ask")
async def ask_question(request: Request, user_id: str = Cookie(None)):
    body = await request.json()
    question = body.get("question")

    if user_id not in sessions:
        return {"error": "세션이 존재하지 않습니다. 먼저 /start_session 호출하세요."}

    response = sessions[user_id].invoke(question)
    return {"answer": response}