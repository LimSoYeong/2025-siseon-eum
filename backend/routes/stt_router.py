from fastapi import APIRouter, UploadFile, File, HTTPException
from infrastructure.stt_client import speech_to_text
import tempfile

router = APIRouter(prefix="/api")

@router.post("/stt")
async def recognize_speech(file: UploadFile = File(...)):
    try:
        # 1. bytes 읽기
        audio_bytes = await file.read()
        
        # 2. 임시 파일 생성
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_audio:
            temp_audio.write(audio_bytes)
            temp_audio_path = temp_audio.name  # 여기가 str 경로!

        # 3. 경로로 STT 처리
        result_text = speech_to_text(temp_audio_path)

        return result_text

    except Exception as e:
        print("[🔥 STT ERROR]", str(e))
        raise HTTPException(status_code=500, detail=str(e))