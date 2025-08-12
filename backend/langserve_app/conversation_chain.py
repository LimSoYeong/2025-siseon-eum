# backend/langserve_app/conversation_chain.py

from langchain_core.runnables import Runnable
from .conversation_session import ConversationSession

class ImageChatRunnable(Runnable):
    def __init__(self, image_path: str):
        self.session = ConversationSession(image_path)

    def invoke(self, input_text: str) -> str:
        return self.session.ask(input_text)

    def classify(self) -> str:
        return self.session.classify_document()

    def prompt_for(self, doc_type: str) -> str:
        return self.session.get_prompt_for_type(doc_type)