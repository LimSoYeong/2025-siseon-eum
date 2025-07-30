from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from infrastructure.tts_client import text_to_speech
from fastapi.responses import Response

router = APIRouter()

class TTSRequest(BaseModel):
    text: str

@router.post("/tts")
def generate_tts(req: TTSRequest):
    try:
        audio_bytes = text_to_speech(req.text)
        return Response(content=audio_bytes, media_type="audio/mpeg")
    except Exception as e:
        print("[❌ TTS 에러 발생]", str(e))
        raise HTTPException(status_code=500, detail=str(e))