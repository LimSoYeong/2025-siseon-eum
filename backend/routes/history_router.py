from fastapi import APIRouter, Request
from db import SessionLocal
from models import Summary

router = APIRouter(prefix="/api", tags=["History"])

@router.get("/history")
def get_user_history(request: Request):
    client_id = request.headers.get("X-Client-ID", "anonymous")

    db = SessionLocal()
    rows = db.query(Summary).filter_by(client_id=client_id).order_by(Summary.created_at.desc()).limit(5).all()
    db.close()

    return [
        {
            "summary_text": row.summary_text,
            "audio_path": row.tts_path,
            "created_at": row.created_at
        }
        for row in rows
    ]
