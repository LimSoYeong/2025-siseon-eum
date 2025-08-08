# backend/langserve_app/test_conversation_session.py

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import gc
import torch
from langserve_app.conversation_session import ConversationSession

image_path = "/root/2025-siseon-eum/ai/data/img/img_001.jpg"

def clean_cuda_cache():
    gc.collect()
    torch.cuda.empty_cache()
clean_cuda_cache()

# 📌 모델은 불러오지만, 추론은 하지 않음
session = ConversationSession(image_path)
# ⏱ 여기까지는 거의 안 걸려야 정상

# 첫 설명
print("📝 첫 설명:")
print(session.ask(""))

# 질문 1
print("\n❓ 이거는 어디에서 찍은 사진이야?")
print(session.ask("이거는 어디에서 찍은 사진이야?"))

# 질문 2
print("\n❓ 이 문서는 어떤 내용을 담고 있어?")
print(session.ask("이 문서는 어떤 내용을 담고 있어?"))