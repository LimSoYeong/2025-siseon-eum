# backend/langserve_app/conversation_session.py

from PIL import Image
import torch
from model_loader import model, processor
from qwen_vl_utils import process_vision_info
from langchain.memory import ConversationBufferMemory
from langchain.schema import HumanMessage, AIMessage

class ConversationSession:
    def __init__(self, img_path, initial_prompt: str = "이 이미지를 노인을 위해 쉽게 설명해줘"):
        self.image = Image.open(img_path).convert("RGB")
        self.memory = ConversationBufferMemory(return_messages=True)

        self.messages = [
            {"role": "user", 
            "content": [
                {"type": "image", "image": self.image},
                {"type": "text", "text": initial_prompt}
                ]
            }
        ]
        self.image_features = self._extract_cached_vision_inputs(self.image)
        self.last_response = None

        # LangChain memory에도 저장
        self.memory.chat_memory.add_user_message(initial_prompt)

    def _extract_cached_vision_inputs(self, image):
        """이미지 전처리 후 pixel_values와 attention_mask만 캐시"""
        messages = [{"role": "user", "content": [{"type": "image", "image": self.image}]}]
        # 반환값 하나만 받도록 수정
        with torch.no_grad():
            image_inputs, _ = process_vision_info(messages)

        return image_inputs

    def ask(self, user_input: str) -> str:
        # 사용자 입력 추가
        self.messages.append({"role": "user", "content": [{"type": "text", "text": user_input}]})
        self.memory.chat_memory.add_user_message(user_input)

        # 템플릿 생성
        text = processor.apply_chat_template(self.messages, tokenize=False, add_generation_prompt=True)

        # 텍스트 토크나이즈
        inputs = processor(
            text=[text],
            images=self.image_features,
            return_tensors="pt"
        ).to(model.device)

        # 추론
        with torch.no_grad(): # no_grad : 추론시에만 사용. gradient를 계산하지 않는다는 뜻
            generated_ids = model.generate(
                **inputs,
                max_new_tokens=128,
                do_sample=False
            )

        # 출력 후처리
        generated_ids_trimmed = [
            out_ids[len(in_ids):] for in_ids, out_ids in zip(inputs.input_ids, generated_ids)
        ]
        output = processor.batch_decode(
            generated_ids_trimmed,
            skip_special_tokens=True,
            clean_up_tokenization_spaces=False
        )[0]

        # 응답 저장
        self.messages.append({"role": "assistant", "content": output})
        self.memory.chat_memory.add_ai_message(output)
        self.last_response = output
        return output