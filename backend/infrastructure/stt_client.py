import requests
from pathlib import Path
from config.settings import NAVER_CLIENT_ID, NAVER_CLIENT_SECRET

STT_URL = "https://naveropenapi.apigw.ntruss.com/recog/v1/stt"
LANG = "Kor"  # 한국어


def speech_to_text(audio_path: str) -> str:
    path = Path(audio_path)
    if not path.exists():
        raise FileNotFoundError(f"음성 파일이 존재하지 않습니다: {audio_path}")
    
    with open(path, "rb") as f:
        audio_data = f.read()

    headers = {
        "x-ncp-apigw-api-key-id": NAVER_CLIENT_ID,
        "x-ncp-apigw-api-key": NAVER_CLIENT_SECRET,
        "Content-Type": "application/octet-stream"
    }
    
    with open(audio_path, "rb") as f:
        audio_data = f.read()

    response = requests.post(
        f"{STT_URL}?lang={LANG}",
        headers=headers,
        data=audio_data
    )

    if response.status_code == 200:
        return response.json().get("text", "")
    else:
        raise RuntimeError(f"STT 요청 실패: {response.status_code} - {response.text}")