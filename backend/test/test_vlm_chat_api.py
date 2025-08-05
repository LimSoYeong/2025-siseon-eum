import base64
import requests

image_path = "/root/2025-siseon-eum/ai/data/img/img_001.jpg"
session_id = "user123"

with open(image_path, "rb") as f:
    image_bytes = f.read()
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")

def chat(user_input):
    res = requests.post(
        "http://localhost:8000/vlm/chat/invoke",  # 또는 https://siseon-eum.site/vlm/chat/invoke
        json={
            "input": {
                "image": image_b64,
                "user_input": user_input,
                "session_id": session_id
            }
        }
    )
    print("응답:", res.status_code)
    print(res.json() if res.headers.get("Content-Type") == "application/json" else res.text)

# 첫 설명
chat("이 이미지를 쉽게 설명해줘")

# 이어서 질문
chat("이 문서는 어떤 내용이야?")
chat("왼쪽 아래 있는 건 뭐야?")