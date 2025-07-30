from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from infrastructure.tts_client import text_to_speech

router = APIRouter()

class TTSRequest(BaseModel):
    text: str

@router.post("/tts")
def generate_tts(req: TTSRequest):
    try:
        audio_path = text_to_speech(req.text)
        return {"audio_url": audio_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))