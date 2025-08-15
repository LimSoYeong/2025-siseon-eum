# backend/models.py
from sqlalchemy import Column, Integer, String, Text, DateTime
from datetime import datetime
from db_config import Base

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    doc_id = Column(String, index=True)
    role = Column(String)  # "user" 또는 "assistant"
    text = Column(Text)
    ts = Column(DateTime, default=datetime.utcnow)

class RecentDoc(Base):
    __tablename__ = "recent_docs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    doc_id = Column(String, index=True)
    path = Column(Text)
    mtime = Column(DateTime, default=datetime.utcnow)
    title = Column(String)
    doc_type = Column(String)

class Feedback(Base):
    __tablename__ = "feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    doc_id = Column(String, index=True)
    image_path = Column(Text)
    prompt = Column(Text)
    output = Column(Text)
    feedback = Column(String)
    improved = Column(Text)
    note = Column(Text)
    ts = Column(DateTime, default=datetime.utcnow)
