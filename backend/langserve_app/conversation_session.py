# backend/langserve_app/conversation_session.py

from PIL import Image
import torch
from langserve_app.model_loader import get_model, get_processor
from qwen_vl_utils import process_vision_info
from langchain.memory import ConversationBufferMemory
from langchain.schema import HumanMessage, AIMessage
import time

from functools import lru_cache
from faiss_db.db import SimpleFaissDB
import numpy as np

@lru_cache
def _get_model():
    return get_model()

@lru_cache
def _get_processor():
    return get_processor()

class ConversationSession:
    def __init__(self, img_path):
        self.image = Image.open(img_path).convert("RGB")
        self.memory = ConversationBufferMemory(return_messages=True)

        # 최초 메시지는 이미지만
        self.messages = [
            {"role": "user", "content": [{"type": "image", "image": self.image}]}
        ]
        self.image_features = self._extract_cached_vision_inputs(self.image)
        self.last_response = None

    def _extract_cached_vision_inputs(self, image):
        """이미지 전처리 후 pixel_values와 attention_mask만 캐시"""
        messages = [{"role": "user", "content": [{"type": "image", "image": self.image}]}]
        start_embedd = time.time()
        with torch.no_grad():
            image_inputs, _ = process_vision_info(messages)
        end_embedd = time.time()
        print(f"[DEBUG] process_vision_info 소요 시간: {round(end_embedd - start_embedd, 2)}초")
        # Qwen-VL 유틸은 images를 리스트(PIL.Image 등)로 반환하며, processor(images=...)에 그대로 넣어야 함
        return image_inputs

    def ask(self, user_input: str) -> str:
        # 사용자 입력 추가
        self.messages.append({"role": "user", "content": [{"type": "text", "text": user_input}]})
        self.memory.chat_memory.add_user_message(user_input)

        # 템플릿 생성
        text = _get_processor().apply_chat_template(self.messages, tokenize=False, add_generation_prompt=True)

        # 텍스트 + 이미지 동시 토크나이즈 (이미지는 캐시된 image_inputs를 재사용)
        inputs = _get_processor()(text=[text], images=self.image_features, return_tensors="pt").to(_get_model().device)

        # 추론
        inference_start = time.time()
        with torch.no_grad(): # no_grad : 추론시에만 사용. gradient를 계산하지 않는다는 뜻
            generated_ids = _get_model().generate(
                **inputs,
                max_new_tokens=128,
                do_sample=False,
                temperature=None,   # 불필요한 파라미터 제거
            )
        inference_end = time.time()
        # 출력 후처리
        generated_ids_trimmed = [
            out_ids[len(in_ids):] for in_ids, out_ids in zip(inputs.input_ids, generated_ids)
        ]
        output = _get_processor().batch_decode(
            generated_ids_trimmed,
            skip_special_tokens=True,
            clean_up_tokenization_spaces=False
        )[0]
        
        print(f"[DEBUG] inference 소요 시간: {round(inference_end - inference_start, 2)}초")
        # 응답 저장
        self.messages.append({"role": "assistant", "content": output})
        self.memory.chat_memory.add_ai_message(output)
        self.last_response = output
        return output