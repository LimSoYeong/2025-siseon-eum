# backend/langserve_app/conversation_chain.py

from langchain_core.runnables import Runnable
from conversation_session import ConversationSession

class ImageChatRunnable(Runnable):
    def __init__(self, image_path: str):
        self.session = ConversationSession(image_path)

    def invoke(self, input_text: str) -> str:
        return self.session.ask(input_text)