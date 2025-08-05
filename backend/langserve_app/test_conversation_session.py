# backend/langserve_app/test_conversation_session.py

import gc
import torch
from conversation_session import ConversationSession

image_path = "/root/2025-siseon-eum/ai/data/img/img_001.jpg"

# 대화 세션 초기화
session = ConversationSession(image_path)

def clean_cuda_cache():
    gc.collect()
    torch.cuda.empty_cache()
clean_cuda_cache()

# 첫 설명
print("📝 첫 설명:")
print(session.ask(""))

# 질문 1
print("\n❓ 이거는 어디에서 찍은 사진이야?")
print(session.ask("이거는 어디에서 찍은 사진이야?"))

# 질문 2
print("\n❓ 이 문서는 어떤 내용을 담고 있어?")
print(session.ask("이 문서는 어떤 내용을 담고 있어?"))