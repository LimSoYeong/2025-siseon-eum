# backend/runnables/vlm_chat_runnable.py

from langchain_core.runnables import Runnable
from test.conversation_session import ConversationSession

class ImageChatRunnable(Runnable):
    def __init__(self, image_path: str):
        self.session = ConversationSession(image_path)

    def invoke(self, input_text: str) -> str:
        return self.session.ask(input_text)