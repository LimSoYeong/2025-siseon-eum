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
        self.image_inputs = self._extract_cached_vision_inputs(self.image)
        self.last_response = None

        # 유형 분류 및 요약용 프롬프트
        self.DOC_TYPE_PROMPT = (
            """
            다음 문서가 어떤 유형인지 하나만 선택해서 출력하세요. 문서가 아닌 경우 모두 기타로 분류하세요.
            - 고지서
            - 안내문-건강
            - 안내문-생활
            - 안내문-금융
            - 기타
            
            조건:
            - 유형 이름만 정확히 출력하세요 (예: 고지서, 안내문-생활, 안내문-건강, 안내문-금융, 기타)
            - 다른 설명은 출력하지 마세요
            """.strip()
        )

        self.PROMPT_BILL = (
            """
            다음 문서를 보고 어르신이 이해하기 쉬운 2~3문장으로 요약하세요.

            단계:
            1. 문서를 읽고 1차 요약을 작성하세요.
            2. 아래 질문을 스스로에게 하며 검토하고, 수정이 필요하다면 보완하여 최종 요약을 작성하세요.

            검토 질문:
            - 빠뜨린 중요한 항목(금액, 날짜, 납부 마감일 등)은 없나요?
            - 어르신이 듣기에 이해하기 어려운 표현은 없나요?
            - 금액과 마감일은 친숙한 단위와 말투로 표현되었나요?

            출력 조건:
            - 최종 2~3문장 요약만 출력하세요.
            - 검토 과정이나 중간 요약은 출력하지 마세요.
            """.strip()
        )

        self.PROMPT_HEALTH = (
            """
            다음 건강 안내문을 분석하여 어르신이 이해하기 쉬운 요약을 작성하세요.  
            예시, 자가 점검 질문, 핵심 요소를 참고하되,  
            중간 과정은 출력하지 말고, '쉬운 말 요약:' 한 줄만 출력하세요.

            예시:
                원문:
                "○ 8월 10일 오전 9시부터 무료 건강검진이 진행됩니다.
                ○ 장소: ○○보건소
                ○ 준비물: 신분증 지참"
                쉬운 말 요약:
                "어르신, 8월 10일 오전 9시에 ○○보건소에서 건강검진이 있어요. 신분증 꼭 챙기세요."

            질문:
            1. 날짜와 시간이 명확한가요?
            2. 장소와 준비물이 빠지지 않았나요?
            3. 어르신이 이해할 수 있는 말투로 표현되었나요?

            필수 요소:
            - 날짜와 시간
            - 장소
            - 대상자 또는 신청 조건
            - 준비물 (예: 신분증)
            - 주의사항 (있는 경우)

            단계:
                1단계: 위 항목을 표처럼 정리하고 요약 후보를 작성하세요.  
                2단계: 빠진 정보 보완 후 5문장 요약으로 압축하세요.  
                3단계: 문장 수를 줄이며 불필요한 표현은 제거하세요.  
                4단계: 핵심만 남겨 2~3문장으로 정리하세요.  
                5단계: 말투를 어르신께 친근하게 다듬으세요.

            출력 조건:
            - 반드시 '쉬운 말 요약:'으로 시작하는 2~3문장만 출력하세요.
            - 1~4 단계는 절대 출력하지 마세요.
            """.strip()
        )

        self.PROMPT_LIFE = (
            """
            다음 생활 안내문을 요약할 때, 아래의 필수 정보가 포함되도록  
            스스로 점검하며 문장을 정리하고, 최종 요약은 2~3문장으로 압축하세요.

            반드시 포함할 정보:
            - 행사명 또는 목적
            - 날짜와 시간
            - 장소
            - 신청 방법 또는 연락처
            - 유의사항 또는 준비물

            스스로 점검하세요:
            - 일정, 장소, 신청 방법이 명확하게 전달되었나요?
            - 너무 딱딱하거나 어색한 표현은 없나요?
            - 어르신이 혼동 없이 이해할 수 있을까요?

            단계:
            1. 위 정보를 포함한 상세한 문장을 떠올려보세요.
            2. 중복되거나 불필요한 표현을 정리하고 문장을 압축하세요.
            3. 2~3문장으로 요약을 마무리하세요.

            출력 조건:
            - 최종 요약 2~3문장만 출력하세요.
            - 1~2 단계는 절대 출력하지 마세요.
            """.strip()
        )

        self.PROMPT_FINANCE = (
            """
            다음 금융 안내문을 보고 어르신이 이해하기 쉬운 요약을 2~3문장으로 작성하세요.

            단계:
            1. 혜택, 금액, 조건, 신청방법, 기한 등 중요한 정보를 항목별로 나열하세요.
            2. 항목들을 간단한 문장으로 바꾸세요.
            3. 비슷한 정보는 합치고 불필요한 설명은 줄이세요.
            4. 어르신이 이해하기 쉬운 말로 2~3문장으로 마무리 요약하세요.

            출력 조건:
            - 최종 요약만 출력하세요 (2~3문장)
            - 중간 단계는 출력하지 마세요
            """.strip()
        )

        # 기타 도메인용 단순 프롬프트
        self.PROMPT_SIMPLE = "노인분들에게 쉽게 설명해줘."

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
        inputs = _get_processor()(text=[text], images=self.image_inputs, return_tensors="pt").to(_get_model().device)

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
        # 응답 저장
        self.messages.append({"role": "assistant", "content": output})
        self.memory.chat_memory.add_ai_message(output)
        self.last_response = output
        return output

    def classify_document(self) -> str:
        """이미지에 대해 문서 유형을 간단히 분류합니다."""
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image", "image": self.image},
                    {"type": "text", "text": self.DOC_TYPE_PROMPT},
                ],
            }
        ]
        text = _get_processor().apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True
        )
        inputs = _get_processor()(text=[text], images=self.image_inputs, return_tensors="pt").to(
            _get_model().device
        )
        with torch.no_grad():
            generated_ids = _get_model().generate(
                **inputs,
                max_new_tokens=16,
                do_sample=False,
                temperature=None,
            )
        generated_ids_trimmed = [
            out_ids[len(in_ids):] for in_ids, out_ids in zip(inputs.input_ids, generated_ids)
        ]
        result = _get_processor().batch_decode(
            generated_ids_trimmed, skip_special_tokens=True, clean_up_tokenization_spaces=False
        )[0].strip()

        # 라벨 정규화
        normalized = (
            "고지서" if "고지서" in result else
            "안내문-건강" if ("안내문-건강" in result or "건강" in result) else
            "안내문-생활" if ("안내문-생활" in result or "생활" in result) else
            "안내문-금융" if ("안내문-금융" in result or "금융" in result) else
            "기타"
        )
        return normalized

    def get_prompt_for_type(self, doc_type: str) -> str:
        if doc_type == "고지서":
            return self.PROMPT_BILL
        if doc_type == "안내문-건강":
            return self.PROMPT_HEALTH
        if doc_type == "안내문-금융":
            return self.PROMPT_FINANCE
        if doc_type == "안내문-생활":
            return self.PROMPT_LIFE
        # 그 외: 단순 프롬프트
        return self.PROMPT_SIMPLE