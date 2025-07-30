# infrastructure/vlm_client.py

import requests
import io
from config.settings import MODEL_SERVER_URL  

def extract_text_from_image(image_bytes: bytes) -> str:
    
    files = {
        "file": ("image.jpg", io.BytesIO(image_bytes), "image/jpeg")
    }

    try:
        response = requests.post(f"{MODEL_SERVER_URL}/inference", files=files)
        response.raise_for_status()
        return response.json()["output"]
    except Exception as e:
        raise RuntimeError(f"[VLM 오류] 문서 이미지 요약 실패: {e}")
    