# backend/routes/summarize.py

from fastapi import APIRouter, UploadFile, File, Request
from application.summarize_service import summarize_pipeline
from db import SessionLocal
from models import Summary

router = APIRouter(prefix="/api", tags=["Summarize"])

@router.post("/summarize")
async def summarize_with_storage(request: Request,file: UploadFile = File(...)):
    image_bytes = await file.read()
    client_id = request.headers.get("X-Client-ID", "anonymous")

    result = summarize_pipeline(image_bytes)

    db = SessionLocal()
    summary = Summary(
        client_id=client_id,
        original_text=result.original_text,
        summary_text=result.summary_text,
        tts_path=result.audio_path
    )
    db.add(summary)
    db.commit()
    db.close()

    return {
        "original_text": result.original_text,
        "summary_text": result.summary_text,
        "audio_path": result.audio_path
    }
