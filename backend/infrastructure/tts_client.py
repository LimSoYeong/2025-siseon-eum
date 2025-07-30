import uuid
from pathlib import Path
import requests
from config.settings import NAVER_CLIENT_ID, NAVER_CLIENT_SECRET, APP_SERVER_URL

TTS_URL = "https://naveropenapi.apigw.ntruss.com/tts-premium/v1/tts"

def text_to_speech(text: str) -> bytes:
    print(f"[📏 TTS 요청 텍스트 길이] {len(text)}자")
    filename = f"{uuid.uuid4().hex}.mp3"
    path = Path("static/audio") / filename
    try:
        path.parent.mkdir(parents=True, exist_ok=True) # 폴더 없을 경우 생성
    except FileExistsError:
        pass

    print("[🔐 ID]", NAVER_CLIENT_ID)
    print("[🔐 SECRET]", NAVER_CLIENT_SECRET)

    headers = {
        "x-ncp-apigw-api-key-id": NAVER_CLIENT_ID,
        "x-ncp-apigw-api-key": NAVER_CLIENT_SECRET,
        "Content-Type": "application/x-www-form-urlencoded"
    }
    data = {
        "speaker": "nara",
        "speed": "0",
        "text": text,
        "format" : "mp3", # 파일 포맷 설정
    }

    response = requests.post(TTS_URL, headers=headers, data=data)
    print("[TTS 요청]", data)
    print("[TTS 응답 코드]", response.status_code)
    print("[TTS 응답 내용]", response.content)
    if response.status_code == 200:

        return response.content

        # with open(path, "wb") as f:
        #     f.write(response.content)
        # return f"{APP_SERVER_URL}/static/audio/{filename}" # 클라이언트용 경로
    else:
        raise RuntimeError(f"TTS 요청 실패: {response.status_code} - {response.text}")
