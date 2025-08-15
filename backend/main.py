# backend/main.py

from fastapi import FastAPI
print("✅ 앱 시작")
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from langserve import add_routes
from routes.stt_router import router as stt_router
from routes.tts_router import router as tts_router
from langserve_app.session_router import router as session_router

app = FastAPI()

# DB 테이블 보장 생성 (서버 시작 시 한 번)
try:
    from db_config import Base, engine
    from models import Conversation, RecentDoc  # noqa: F401
    Base.metadata.create_all(bind=engine)
    print("✅ DB 테이블 준비 완료")
except Exception as e:
    print(f"[WARN] DB 초기화 실패: {e}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://siseon-eum.site",   # 배포용
        "http://localhost:5173",     # Vite dev
        "http://localhost:5174",     # Vite dev (다른 포트)
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://localhost:4173",     # Vite preview
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 정적 파일 서빙
app.mount("/static", StaticFiles(directory="static"), name="static")

# 🔹 일반 FastAPI 라우터 등록
app.include_router(stt_router)
app.include_router(tts_router)
app.include_router(session_router)

@app.get("/")
def read_root():
    return {"message": "FastAPI 서버가 잘 작동 중입니다!"}