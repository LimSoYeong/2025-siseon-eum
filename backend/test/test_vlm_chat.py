# backend/test/test_vlm_chat.py
# import sys
# import os
# # 현재 backend 폴더를 PYTHONPATH에 추가
# sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# from runnables.vlm_runnable import vlm_runnable

# if __name__ == "__main__":
#     image_path = "/root/2025-siseon-eum/ai/data/img/img_001.jpg"
#     with open(image_path, "rb") as f:
#         image_bytes = f.read()
#         output = vlm_runnable.invoke(image_bytes)
#         print("📝 결과:", output)

import base64
import requests

with open("/root/2025-siseon-eum/ai/data/img/img_001.jpg", "rb") as f:
    image_bytes = f.read()
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")

response = requests.post(
    "http://localhost:8000/vlm/invoke",  # 또는 https://siseon-eum.site/vlm/invoke
    json={
        "input": image_b64
    }
)
print("Status:", response.status_code)
print("Raw response:", response.text)  # 👈 JSONDecodeError 날 때는 여기에 에러 메시지 나올 수도 있음
try:
    print("Parsed JSON:", response.json())
except Exception as e:
    print("❌ JSON 파싱 실패:", str(e))
