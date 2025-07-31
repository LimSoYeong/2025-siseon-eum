from fastapi import APIRouter, UploadFile, File, HTTPException
from infrastructure.stt_client import speech_to_text

router = APIRouter()

@router.post("/stt")
async def recognize_speech(file: UploadFile = File(...)):
    try:
        audio_bytes = await file.read()
        result_text = speech_to_text(audio_bytes)
        return {"text": result_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))