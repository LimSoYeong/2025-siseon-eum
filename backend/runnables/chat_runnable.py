# backend/runnables/chat_runnable.py

# from langchain.agents import initialize_agent, AgentType
# from langchain.memory import ConversationBufferMemory
# from langchain.tools import Tool
# from langchain_core.runnables import Runnable
# from infrastructure.vlm_client import get_qwen_model_and_processor
# from infrastructure.vlm_client import generate_qwen_response_with_image  # 직접 만든 추론 함수
# from tools.describe_image import describe_image_tool  # 예시 Tool

# # ✅ Step 1. Qwen2.5-VL Wrapper (LLM처럼 쓰기)
# from langchain_core.language_models import BaseLanguageModel
# from typing import List, Optional

# class QwenVLWrapper(BaseLanguageModel):
#     def __init__(self, model, processor):
#         self.model = model
#         self.processor = processor

#     def _call(self, prompt: str, stop: Optional[List[str]] = None, image_path: Optional[str] = None) -> str:
#         return generate_qwen_response_with_image(prompt, image_path, self.model, self.processor)

#     @property
#     def _llm_type(self) -> str:
#         return "qwen2.5-vl"


# # ✅ Step 2. LangChain Agent 초기화
# # (이미지 기반 응답을 위한 Tool 포함 가능)
# def get_chat_agent() -> Runnable:
#     # 모델 및 프로세서 로드
#     model, processor = get_qwen_model_and_processor()
#     llm = QwenVLWrapper(model=model, processor=processor)

#     # 메모리 구성 (LangChain Memory)
#     memory = ConversationBufferMemory(memory_key="chat_history", return_messages=True)

#     # 필요한 Tool 목록
#     tools = [describe_image_tool]  # 이미지 설명 같은 Tool 추가 가능

#     # Agent 초기화
#     agent = initialize_agent(
#         tools=tools,
#         llm=llm,
#         agent=AgentType.OPENAI_FUNCTIONS,
#         memory=memory,
#         verbose=True,
#     )
#     return agent