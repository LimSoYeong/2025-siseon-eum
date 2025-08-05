# backend/langserve_app/conversation_session.py

from PIL import Image
import torch
from langserve_app.model_loader import get_model, get_processor
from qwen_vl_utils import process_vision_info
from langchain.memory import ConversationBufferMemory
from langchain.schema import HumanMessage, AIMessage
import time

from functools import lru_cache

@lru_cache
def _get_model():
    return get_model()

@lru_cache
def _get_processor():
    return get_processor()

class ConversationSession:
    def __init__(self, img_path, initial_prompt: str = "이 이미지를 노인을 위해 쉽게 설명해줘"):
        self.image = Image.open(img_path).convert("RGB")
        self.memory = ConversationBufferMemory(return_messages=True)

        # 최초 메시지는 이미지만
        self.messages = [
            {"role": "user", "content": [{"type": "image", "image": self.image}]}
        ]
        self.image_features = self._extract_cached_vision_inputs(self.image)
        self.last_response = None

        # LangChain memory에 이미지 설명을 위한 초기 프롬프트를 자동 호출
        if initial_prompt:
            self.ask(initial_prompt)

    def _extract_cached_vision_inputs(self, image):
        """이미지 전처리 후 pixel_values와 attention_mask만 캐시"""
        messages = [{"role": "user", "content": [{"type": "image", "image": self.image}]}]
        start_embedd = time.time()
        # 반환값 하나만 받도록 수정
        with torch.no_grad():
            image_inputs, _ = process_vision_info(messages)
        end_embedd = time.time()
        print(f"[DEBUG] process_vision_info 소요 시간: {round(end_embedd - start_embedd, 2)}초")
        return image_inputs

    def ask(self, user_input: str) -> str:
        # 사용자 입력 추가
        self.messages.append({"role": "user", "content": [{"type": "text", "text": user_input}]})
        self.memory.chat_memory.add_user_message(user_input)

        # 템플릿 생성
        text = _get_processor().apply_chat_template(self.messages, tokenize=False, add_generation_prompt=True)

        # 텍스트 토크나이즈
        inputs = _get_processor()(
                    text=[text], images=self.image_features, return_tensors="pt"
                ).to(_get_model().device)

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