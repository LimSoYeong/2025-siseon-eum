from fastapi import FastAPI
print("✅ 앱 시작")
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from langserve import add_routes

# from runnables.summarize_runnable import summarize_runnable
# from runnables.chat_runnable import chat_runnable
# from runnables.tts_runnable import tts_runnable
# from runnables.stt_runnable import stt_runnable
from routes import summarize, history_router
from routes.stt_router import router as stt_router
from routes.vlm_router import router as vlm_router
from routes.tts_router import router as tts_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://siseon-eum.site",   # 배포용
        "http://localhost:3000",     # 개발 중이면 이거 꼭 추가!!
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 정적 파일 서빙
app.mount("/static", StaticFiles(directory="static"), name="static")

# 🔹 일반 FastAPI 라우터 등록
app.include_router(stt_router)
app.include_router(vlm_router)
app.include_router(tts_router)
app.include_router(summarize)
app.include_router(history_router)

# # 🔹 LangServe 기반 runnable 등록
# add_routes(app, summarize_runnable, path="/lang/summarize")
# add_routes(app, chat_runnable, path="/lang/chat")
# add_routes(app, tts_runnable, path="/lang/tts")
# add_routes(app, stt_runnable, path="/lang/stt")

@app.get("/")
def read_root():
    return {"message": "FastAPI 서버가 잘 작동 중입니다!"}